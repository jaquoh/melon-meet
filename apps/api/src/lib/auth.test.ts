import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth";

describe("auth helpers", () => {
  it("hashes and verifies passwords", async () => {
    const password = "beachvolley123";
    const hash = await hashPassword(password);

    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
