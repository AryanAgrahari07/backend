import { v4 as uuidv4 } from "uuid";

/**
 * Test fixtures for OrderJi RMS.
 *
 * Context: launching for ~100 restaurants; extreme-case ceiling = 200 restaurants.
 * Each restaurant has on average 10 tables, 30 menu items, and handles 50-100 orders/day.
 */

/** Shared counter per test run to guarantee unique slugs/table-numbers */
let _seq = 0;
const seq = () => ++_seq;

export const fixtures = {
  /** A realistic Indian restaurant record */
  restaurant: (overrides = {}) => ({
    id: uuidv4(),
    name: `Spice Garden ${seq()}`,
    slug: `spice-garden-${Date.now()}-${seq()}`,
    type: "Restaurant",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    currency: "₹",
    taxRateGst: "5.00",
    taxRateService: "10.00",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /** Basic user (owner) */
  user: (overrides = {}) => ({
    id: uuidv4(),
    email: `owner-${seq()}@test.in`,
    passwordHash: "$2b$10$testhashedpassword",
    fullName: "Raj Kumar",
    role: "owner",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /** Dine-in table */
  table: (restaurantId, overrides = {}) => {
    const n = seq();
    return {
      id: uuidv4(),
      restaurantId,
      tableNumber: `T${n}`,
      capacity: 4,
      currentStatus: "AVAILABLE",
      qrCodePayload: `https://orderji.in/r/test-restaurant?table=T${n}`,
      qrCodeVersion: 1,
      isActive: true,
      floorSection: "Main Floor",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },

  /** Menu category */
  menuCategory: (restaurantId, overrides = {}) => ({
    id: uuidv4(),
    restaurantId,
    name: `Category ${seq()}`,
    sortOrder: seq(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /** Menu item */
  menuItem: (restaurantId, categoryId, overrides = {}) => ({
    id: uuidv4(),
    restaurantId,
    categoryId,
    name: `Dish ${seq()}`,
    description: "A delicious test dish",
    price: "150.00",
    isActive: true,
    isAvailable: true,
    sortOrder: seq(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /** An order in PENDING state */
  order: (restaurantId, overrides = {}) => ({
    id: uuidv4(),
    restaurantId,
    tableId: null,
    status: "PENDING",
    paymentStatus: "DUE",
    orderType: "DINE_IN",
    subtotalAmount: "300.00",
    gstAmount: "15.00",
    serviceTaxAmount: "30.00",
    discountAmount: "0.00",
    totalAmount: "345.00",
    paid_amount: "0.00",
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /** An order item */
  orderItem: (orderId, restaurantId, menuItemId, overrides = {}) => ({
    id: uuidv4(),
    orderId,
    restaurantId,
    menuItemId,
    itemName: "Paneer Tikka",
    status: "PENDING",
    unitPrice: "150.00",
    quantity: 2,
    totalPrice: "300.00",
    createdAt: new Date(),
    ...overrides,
  }),

  /** A guest queue entry */
  queueEntry: (restaurantId, overrides = {}) => ({
    id: uuidv4(),
    restaurantId,
    guestName: `Guest ${seq()}`,
    partySize: 2,
    phoneNumber: "+919876543210",
    status: "WAITING",
    entryTime: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  /** A landing page inquiry */
  inquiry: (overrides = {}) => ({
    fullName: `Rajesh Kumar ${seq()}`,
    phoneNumber: "+919876543210",
    restaurantName: `Hotel Saravana Bhavan ${seq()}`,
    message: "We need a QR menu system for 15 tables.",
    ...overrides,
  }),
};
