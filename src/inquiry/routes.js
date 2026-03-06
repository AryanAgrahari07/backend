import { Router } from "express";
import { createInquiry } from "./service.js";

const router = Router();

/**
 * POST /api/inquiries
 * Public endpoint — no auth required (landing page form)
 */
router.post("/", async (req, res) => {
  try {
    const { fullName, phoneNumber, restaurantName, message } = req.body;
    const inquiry = await createInquiry({ fullName, phoneNumber, restaurantName, message });
    return res.status(201).json({ success: true, data: inquiry });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
});

export function registerInquiryRoutes(app) {
  app.use("/api/inquiries", router);
}
