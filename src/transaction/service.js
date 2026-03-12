import { eq, and, desc, sql, gte, lte, or, ilike } from "drizzle-orm";
import { transactions, orders, orderItems, tables, staff, restaurants } from "../../shared/schema.js";
import { db } from "../dbClient.js";
import { emitTableStatusChanged } from "../realtime/events.js";

/**
 * Create a transaction when an order is paid
 * @param {string} restaurantId - Restaurant ID
 * @param {string} orderId - Order ID
 * @param {object} data - Transaction data
 * @param {object} [dbToUse=db] - Optional database connection/transaction object
 * @returns {Promise<object>} Created transaction
 */
export async function createTransaction(restaurantId, orderId, data, dbToUse = db) {
  const {
    billNumber,
    paymentMethod,
    paymentReference,
    combinedSubtotal,
    combinedGst,
    combinedService,
    combinedTotal,
  } = data;

  const orderRows = await dbToUse
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.id, orderId)
      )
    )
    .limit(1);

  const order = orderRows[0];
  if (!order) {
    throw new Error("Order not found");
  }

  const subtotal = combinedSubtotal !== undefined ? combinedSubtotal : order.subtotalAmount;
  const gst = combinedGst !== undefined ? combinedGst : order.gstAmount;
  const service = combinedService !== undefined ? combinedService : order.serviceTaxAmount;
  const total = combinedTotal !== undefined ? combinedTotal : order.totalAmount;

  // Snapshot the tax rates used at the time of payment so receipts remain historical
  const restaurantRows = await dbToUse
    .select({ taxRateGst: restaurants.taxRateGst, taxRateService: restaurants.taxRateService })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);
  const restaurant = restaurantRows[0];

  const transactionRows = await dbToUse
    .insert(transactions)
    .values({
      restaurantId,
      orderId,
      billNumber,
      subtotal: subtotal.toString(),
      gstAmount: gst.toString(),
      serviceTaxAmount: service.toString(),
      discountAmount: order.discountAmount || "0",
      grandTotal: total.toString(),

      // Rate snapshots
      taxRateGst: restaurant?.taxRateGst ?? null,
      taxRateService: restaurant?.taxRateService ?? null,

      paymentMethod,
      paymentReference: paymentReference || null,
    })
    .returning();

  const transaction = transactionRows[0];

  if (order.tableId && order.orderType === "DINE_IN") {
    const activeOrdersForTable = await dbToUse
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          eq(orders.tableId, order.tableId),
          sql`${orders.status} IN ('PENDING', 'PREPARING', 'READY', 'SERVED')`,
          sql`${orders.id} != ${order.id}`
        )
      )
      .limit(1);

    if (activeOrdersForTable.length === 0) {
      const tableRows = await dbToUse
        .update(tables)
        .set({
          currentStatus: "AVAILABLE",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            eq(tables.id, order.tableId)
          )
        )
        .returning();
      
      if (tableRows[0]) {
        emitTableStatusChanged(restaurantId, tableRows[0]);
      }
    }
  }

  return transaction;
}

/**
 * List transactions for a restaurant with pagination and search (OPTIMIZED)
 * Only fetches essential fields for list view
 * @param {string} restaurantId - Restaurant ID
 * @param {object} filters - Filter options
 * @returns {Promise<object>} Transactions with pagination info
 */
export async function listTransactions(restaurantId, filters = {}) {
  const {
    fromDate,
    toDate,
    paymentMethod,
    orderType,
    search,
    limit = 20,
    offset = 0,
  } = filters;

  // Build WHERE conditions
  let conditions = [eq(transactions.restaurantId, restaurantId)];

  if (fromDate) {
    conditions.push(gte(transactions.paidAt, new Date(fromDate)));
  }
  if (toDate) {
    // Add 1 day to include the entire end date
    const endDate = new Date(toDate);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lte(transactions.paidAt, endDate));
  }
  if (paymentMethod) {
    conditions.push(eq(transactions.paymentMethod, paymentMethod));
  }
  if (orderType) {
    // Note: since orderType is on orders table, this condition will be processed
    // after the join in the query
    conditions.push(eq(orders.orderType, orderType));
  }

  // OPTIMIZATION: Select only necessary fields for list view
  let baseQuery = db
    .select({
      // Transaction essentials
      id: transactions.id,
      // Transaction details
      billNumber: transactions.billNumber,
      paidAt: transactions.paidAt,
      paymentMethod: transactions.paymentMethod,
      grandTotal: transactions.grandTotal,
      subtotal: transactions.subtotal,
      gstAmount: transactions.gstAmount,
      serviceTaxAmount: transactions.serviceTaxAmount,
      discountAmount: transactions.discountAmount,
      taxRateGst: transactions.taxRateGst,
      taxRateService: transactions.taxRateService,
      
      // Order info
      orderId: orders.id,
      orderType: orders.orderType,
      status: orders.status,
      guestName: orders.guestName,
      
      // Minimal table info (only what's displayed)
      tableNumber: tables.tableNumber,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(tables, eq(orders.tableId, tables.id));

  // Apply base conditions
  let query = baseQuery.where(and(...conditions));

  // Add search filter if provided
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    const searchConditions = [
      ...conditions,
      or(
        ilike(transactions.billNumber, searchTerm),
        sql`CAST(${tables.tableNumber} AS TEXT) ILIKE ${searchTerm}`,
        ilike(orders.guestName, searchTerm)
      )
    ];
    query = baseQuery.where(and(...searchConditions));
  }

  // Count query - optimized with specific fields
  let countConditions = [...conditions];
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    countConditions.push(
      or(
        ilike(transactions.billNumber, searchTerm),
        sql`CAST(${tables.tableNumber} AS TEXT) ILIKE ${searchTerm}`,
        ilike(orders.guestName, searchTerm)
      )
    );
  }

  const countQuery = db
    .select({ count: sql`count(*)::int` })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(tables, eq(orders.tableId, tables.id))
    .where(and(...countConditions));

  // Execute queries in parallel
  const [transactionsList, totalCountResult] = await Promise.all([
    query
      .orderBy(desc(transactions.paidAt))
      .limit(limit)
      .offset(offset),
    countQuery
  ]);

  const total = totalCountResult[0]?.count || 0;

  // OPTIMIZATION: Return lightweight transaction objects for list view
  // No need to fetch order items or staff info for the list
  const lightweightTransactions = transactionsList.map(row => ({
    id: row.id,
    billNumber: row.billNumber,
    paidAt: row.paidAt,
    paymentMethod: row.paymentMethod,
    grandTotal: row.grandTotal,
    subtotal: row.subtotal,
    gstAmount: row.gstAmount,
    serviceTaxAmount: row.serviceTaxAmount,
    discountAmount: row.discountAmount,
    taxRateGst: row.taxRateGst,
    taxRateService: row.taxRateService,
    order: row.orderId ? {
      id: row.orderId,
      orderType: row.orderType,
      status: row.status,
      guestName: row.guestName,
      table: row.tableNumber ? {
        tableNumber: row.tableNumber,
      } : null,
    } : null,
  }));

  return {
    transactions: lightweightTransactions,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      totalPages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
}

/** Maximum number of rows the CSV export will ever produce.
 * Prevents runaway queries / OOM on large date ranges.
 */
const MAX_CSV_ROWS = 5_000;

/**
 * Stream transactions as CSV data
 * @param {string} restaurantId - Restaurant ID
 * @param {object} filters - Filter options
 * @param {import("express").Response} res - Express Response object for streaming
 */
export async function streamTransactionsCSV(restaurantId, filters, res) {
  const {
    fromDate,
    toDate,
    paymentMethod,
    tableId,
    search,
  } = filters;

  // Chunk size — fetch this many rows per DB round-trip
  const CHUNK_SIZE = 1000;
  let offset = 0;
  let totalFetched = 0;
  let hasMore = true;

  // Import stringify dynamically to keep dependencies clean at top level
  const { stringify } = await import("csv-stringify/sync");

  // Define headers for the CSV
  const headers = [
    'Bill Number',
    'Date & Time',
    'Table/Guest',
    'Payment Method',
    'Subtotal',
    'CGST',
    'SGST',
    'Service Charge',
    'Discount',
    'Round Off',
    'Grand Total',
    'Cashier',
  ];

  // Write header to response stream
  res.write(stringify([headers]));

  while (hasMore) {
    let conditions = [eq(transactions.restaurantId, restaurantId)];

    if (fromDate) {
      conditions.push(gte(transactions.paidAt, new Date(fromDate)));
    }
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setDate(endDate.getDate() + 1);
      conditions.push(lte(transactions.paidAt, endDate));
    }
    if (paymentMethod) {
      conditions.push(eq(transactions.paymentMethod, paymentMethod));
    }
    if (tableId) {
       // Requires joining orders anyway below, so we can filter by tableId on the join later if needed.
       // For now, this is kept simpler.
    }

    let baseQuery = db
      .select({
        billNumber: transactions.billNumber,
        paidAt: transactions.paidAt,
        paymentMethod: transactions.paymentMethod,
        subtotal: transactions.subtotal,
        gstAmount: transactions.gstAmount,
        serviceTaxAmount: transactions.serviceTaxAmount,
        discountAmount: transactions.discountAmount,
        grandTotal: transactions.grandTotal,
        taxRateGst: transactions.taxRateGst,
        tableNumber: tables.tableNumber,
        guestName: orders.guestName,
        staffName: sql`${staff.fullName}`,
      })
      .from(transactions)
      .leftJoin(orders, eq(transactions.orderId, orders.id))
      .leftJoin(tables, eq(orders.tableId, tables.id))
      .leftJoin(staff, eq(orders.placedByStaffId, staff.id));

    // Apply conditions
    let query = baseQuery.where(and(...conditions));
    
    // Apply search if needed (same logic as listTransactions)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      const searchConditions = [
        ...conditions,
        or(
          ilike(transactions.billNumber, searchTerm),
          sql`CAST(${tables.tableNumber} AS TEXT) ILIKE ${searchTerm}`,
          ilike(orders.guestName, searchTerm)
        )
      ];
      query = baseQuery.where(and(...searchConditions));
    }

    // How many rows can we still safely fetch?
    const remaining = MAX_CSV_ROWS - totalFetched;
    if (remaining <= 0) {
      hasMore = false;
      break;
    }
    const fetchLimit = Math.min(CHUNK_SIZE, remaining);

    // Fetch chunk
    const chunk = await query
      .orderBy(desc(transactions.paidAt))
      .limit(fetchLimit)
      .offset(offset);

    if (chunk.length === 0) {
      hasMore = false;
      break;
    }

    // Format chunk rows
    const csvRows = chunk.map((row) => {
      let cgst = 0;
      let sgst = 0;
      const gstAmt = parseFloat(row.gstAmount || "0");
      
      if (gstAmt > 0) {
          cgst = gstAmt / 2;
          sgst = gstAmt / 2;
      }

      const sub = parseFloat(row.subtotal || "0");
      const srv = parseFloat(row.serviceTaxAmount || "0");
      const disc = Math.abs(parseFloat(row.discountAmount || "0"));
      const gt = parseFloat(row.grandTotal || "0");
      
      const expectedTotal = sub + gstAmt + srv - disc;
      const roundOff = gt - expectedTotal;

      return [
        row.billNumber,
        new Date(row.paidAt).toLocaleString('en-IN'),
        row.tableNumber ? `Table ${row.tableNumber}` : (row.guestName || 'N/A'),
        row.paymentMethod,
        sub.toFixed(2),
        cgst.toFixed(2),
        sgst.toFixed(2),
        srv.toFixed(2),
        disc.toFixed(2),
        Math.abs(roundOff) > 0.01 ? roundOff.toFixed(2) : "0.00",
        gt.toFixed(2),
        row.staffName || 'System',
      ];
    });

    // Write formatted chunk to response stream
    res.write(stringify(csvRows));
    
    totalFetched += chunk.length;
    offset += chunk.length;
    
    // Stop if we've hit the hard cap or got fewer rows than requested
    if (totalFetched >= MAX_CSV_ROWS || chunk.length < fetchLimit) {
      hasMore = false;
    }
  }

  // Append a note if the export was truncated
  if (totalFetched >= MAX_CSV_ROWS) {
    res.write(stringify([[
      `NOTE: Export limited to ${MAX_CSV_ROWS.toLocaleString()} rows. Use a narrower date range to get all records.`,
      '', '', '', '', '', '', '', '', '', '', ''
    ]]));
  }

  // End the stream
  res.end();
}

/**
 * Get transaction by ID with FULL details (for detail view/bill modal)
 * @param {string} restaurantId - Restaurant ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<object|null>} Transaction with order info
 */
export async function getTransaction(restaurantId, transactionId) {
  const transactionRows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.restaurantId, restaurantId),
        eq(transactions.id, transactionId)
      )
    )
    .limit(1);

  const transaction = transactionRows[0];
  if (!transaction) return null;

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.id, transaction.orderId))
    .limit(1);

  const order = orderRows[0];
  
  const items = order ? await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, transaction.orderId)) : [];

  let tableInfo = null;
  if (order?.tableId) {
    const tableRows = await db
      .select()
      .from(tables)
      .where(eq(tables.id, order.tableId))
      .limit(1);
    tableInfo = tableRows[0] ? {
      id: tableRows[0].id,
      tableNumber: tableRows[0].tableNumber,
      floorSection: tableRows[0].floorSection,
    } : null;
  }

  let staffInfo = null;
  if (order?.placedByStaffId) {
    const { staff } = await import("../../shared/schema.js");
    const staffRows = await db
      .select({
        id: staff.id,
        fullName: staff.fullName,
        role: staff.role,
      })
      .from(staff)
      .where(eq(staff.id, order.placedByStaffId))
      .limit(1);
    staffInfo = staffRows[0] || null;
  }

  return {
    ...transaction,
    order: order ? {
      ...order,
      items: items,
      table: tableInfo,
      placedByStaff: staffInfo,
    } : null,
  };
}


/**
 * Get recent transactions summary (lightweight for widgets/dashboards)
 * Only fetches essential fields needed for display
 * @param {string} restaurantId - Restaurant ID
 * @param {number} limit - Number of recent transactions to fetch (default 5)
 * @returns {Promise<Array>} Lightweight transaction summaries
 */
export async function getRecentTransactionsSummary(restaurantId, limit = 5) {
  // OPTIMIZATION: Only select the bare minimum fields needed for the widget
  const recentTransactions = await db
    .select({
      // Transaction essentials only
      id: transactions.id,
      billNumber: transactions.billNumber,
      paidAt: transactions.paidAt,
      paymentMethod: transactions.paymentMethod,
      grandTotal: transactions.grandTotal,
      
      // Minimal order info
      orderType: orders.orderType,
      guestName: orders.guestName,
      
      // Only table number (not full table object)
      tableNumber: tables.tableNumber,
      
      // Only staff name (not full staff object)
      staffName: sql`${staff.fullName}`,
    })
    .from(transactions)
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(tables, eq(orders.tableId, tables.id))
    .leftJoin(staff, eq(orders.placedByStaffId, staff.id))
    .where(eq(transactions.restaurantId, restaurantId))
    .orderBy(desc(transactions.paidAt))
    .limit(limit);

  // Return lightweight objects - no nested structures
  return recentTransactions.map(row => ({
    id: row.id,
    billNumber: row.billNumber,
    paidAt: row.paidAt,
    paymentMethod: row.paymentMethod,
    grandTotal: row.grandTotal,
    orderType: row.orderType,
    guestName: row.guestName,
    tableNumber: row.tableNumber,
    staffName: row.staffName,
  }));
}