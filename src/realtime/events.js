import { emitRestaurantEvent } from "./emitter.js";
import { getRedisClient } from "../redis/client.js";

async function invalidateKitchenOrdersCache(restaurantId) {
  const redis = getRedisClient();
  if (redis && redis.status === "ready") {
    await redis.del(`kds:active:${restaurantId}`).catch(() => {});
  }
}
export const RealtimeEvents = {
  OrderCreated: "order.created",
  OrderUpdated: "order.updated",
  OrderStatusChanged: "order.status_changed",
  OrderItemsAdded: "order.items_added",

  TableCreated: "table.created",
  TableUpdated: "table.updated",
  TableDeleted: "table.deleted",
  TableStatusChanged: "table.status_changed",

  QueueRegistered: "queue.registered",
  QueueUpdated: "queue.updated",
  QueueStatusChanged: "queue.status_changed",
  QueueCalled: "queue.called",
  QueueSeated: "queue.seated",
  QueueCancelled: "queue.cancelled",
  QueueBulkUpdated: "queue.bulk_updated",
};

export function emitOrderCreated(restaurantId, order) {
  invalidateKitchenOrdersCache(restaurantId);
  emitRestaurantEvent(restaurantId, RealtimeEvents.OrderCreated, { order });
}

export function emitOrderUpdated(restaurantId, order) {
  invalidateKitchenOrdersCache(restaurantId);
  emitRestaurantEvent(restaurantId, RealtimeEvents.OrderUpdated, { order });
}

export function emitOrderStatusChanged(restaurantId, order) {
  invalidateKitchenOrdersCache(restaurantId);
  emitRestaurantEvent(restaurantId, RealtimeEvents.OrderStatusChanged, { order });
}

export function emitOrderItemsAdded(restaurantId, orderId, newItems, order) {
  invalidateKitchenOrdersCache(restaurantId);
  emitRestaurantEvent(restaurantId, RealtimeEvents.OrderItemsAdded, {
    orderId,
    newItems,
    order,
  });
}

export function emitTableCreated(restaurantId, table) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.TableCreated, { table });
}

export function emitTableUpdated(restaurantId, table) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.TableUpdated, { table });
}

export function emitTableDeleted(restaurantId, table) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.TableDeleted, { table });
}

export function emitTableStatusChanged(restaurantId, table) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.TableStatusChanged, { table });
}

export function emitQueueRegistered(restaurantId, entry) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueRegistered, { entry });
}

export function emitQueueUpdated(restaurantId, entry) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueUpdated, { entry });
}

export function emitQueueStatusChanged(restaurantId, entry) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueStatusChanged, { entry });
}

export function emitQueueCalled(restaurantId, entry) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueCalled, { entry });
}

export function emitQueueSeated(restaurantId, entry, table) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueSeated, { entry, table });
}

export function emitQueueCancelled(restaurantId, entry) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueCancelled, { entry });
}

export function emitQueueBulkUpdated(restaurantId, entries) {
  emitRestaurantEvent(restaurantId, RealtimeEvents.QueueBulkUpdated, { entries });
}

