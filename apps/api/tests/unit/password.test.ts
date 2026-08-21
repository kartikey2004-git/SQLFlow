import { describe, it, expect } from "vitest";
import { PasswordService } from "@sql-learn/auth";

describe("PasswordService", () => {
  it("produces a verifiable Argon2id hash", async () => {
    const hash = await PasswordService.hash("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await PasswordService.verify(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await PasswordService.hash("correct horse battery staple");
    expect(await PasswordService.verify(hash, "wrong password")).toBe(false);
  });

  it("does not throw on a malformed hash - treats it as a mismatch", async () => {
    await expect(PasswordService.verify("not-a-real-hash", "anything")).resolves.toBe(false);
  });

  it("salts hashes so the same password produces different output", async () => {
    const a = await PasswordService.hash("same-password");
    const b = await PasswordService.hash("same-password");
    expect(a).not.toBe(b);
  });
});
