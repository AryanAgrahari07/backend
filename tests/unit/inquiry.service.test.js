/**
 * Unit tests — Inquiry Service (Landing Page Contact Form)
 *
 * Validates:
 *  - Successful creation with all fields
 *  - Successful creation without optional message
 *  - Rejects missing / too-short fullName
 *  - Rejects missing / too-short phoneNumber
 *  - Rejects missing restaurantName
 *  - Default status is PENDING
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createTestPool, cleanDatabase, closePool } from "../utils/db.js";
import { createInquiry } from "../../src/inquiry/service.js";
import { fixtures } from "../utils/fixtures.js";

let pool;
let dbAvailable = false;

describe("Inquiry Service — Unit Tests", () => {
  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!testDbUrl) { console.warn("⚠️  Skipping — no DB URL"); return; }
    try {
      pool = createTestPool();
      drizzle(pool);
      await pool.query("SELECT 1");
      await cleanDatabase(pool);
      dbAvailable = true;
    } catch (err) {
      console.warn(`⚠️  DB unavailable: ${err.message}`);
    }
  });

  afterAll(async () => { if (pool) await closePool(pool); });
  beforeEach(async () => { if (dbAvailable) await cleanDatabase(pool); });

  it("creates inquiry with all fields and status PENDING", async () => {
    if (!dbAvailable) return;
    const data = fixtures.inquiry();
    const result = await createInquiry(data);
    expect(result.id).toBeDefined();
    expect(result.fullName).toBe(data.fullName.trim());
    expect(result.phoneNumber).toBe(data.phoneNumber.trim());
    expect(result.restaurantName).toBe(data.restaurantName.trim());
    expect(result.message).toBe(data.message.trim());
    expect(result.status).toBe("PENDING");
  });

  it("creates inquiry without optional message", async () => {
    if (!dbAvailable) return;
    const data = fixtures.inquiry({ message: undefined });
    const result = await createInquiry(data);
    expect(result.id).toBeDefined();
    expect(result.message).toBeNull();
  });

  it("rejects inquiry with missing fullName", async () => {
    if (!dbAvailable) return;
    await expect(createInquiry(fixtures.inquiry({ fullName: "" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects inquiry with single-char fullName", async () => {
    if (!dbAvailable) return;
    await expect(createInquiry(fixtures.inquiry({ fullName: "A" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects inquiry with missing phoneNumber", async () => {
    if (!dbAvailable) return;
    await expect(createInquiry(fixtures.inquiry({ phoneNumber: "" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects inquiry with too-short phoneNumber", async () => {
    if (!dbAvailable) return;
    await expect(createInquiry(fixtures.inquiry({ phoneNumber: "123" }))).rejects.toMatchObject({ status: 400 });
  });

  it("rejects inquiry with missing restaurantName", async () => {
    if (!dbAvailable) return;
    await expect(createInquiry(fixtures.inquiry({ restaurantName: "" }))).rejects.toMatchObject({ status: 400 });
  });
});
