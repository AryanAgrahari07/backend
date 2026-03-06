import { db } from "../dbClient.js";
import { inquiries } from "../../shared/schema.js";

/**
 * Create a new inquiry from the landing page reachout form.
 * @param {{ fullName: string, phoneNumber: string, restaurantName: string, message?: string }} data
 * @returns {Promise<object>} The created inquiry record
 */
export async function createInquiry(data) {
  const { fullName, phoneNumber, restaurantName, message } = data;

  // Basic server-side validation
  if (!fullName || fullName.trim().length < 2) {
    throw Object.assign(new Error("Full name must be at least 2 characters."), { status: 400 });
  }
  if (!phoneNumber || phoneNumber.trim().length < 7) {
    throw Object.assign(new Error("A valid phone number is required."), { status: 400 });
  }
  if (!restaurantName || restaurantName.trim().length < 1) {
    throw Object.assign(new Error("Restaurant name is required."), { status: 400 });
  }

  const [inquiry] = await db
    .insert(inquiries)
    .values({
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      restaurantName: restaurantName.trim(),
      message: message ? message.trim() : null,
    })
    .returning();

  return inquiry;
}
