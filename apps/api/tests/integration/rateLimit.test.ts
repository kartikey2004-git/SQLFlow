import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

// Own file so its own module registry gets a fresh in-memory rate-limit
// store (vitest isolates module state per test file by default) - it
// wouldn't be safe to run this alongside other tests hitting /auth/sign-in/email
// in the same file/instance.
const app = createApp();

describe("Login rate limiting", () => {
  it("locks out after repeated failed attempts from the same IP+email", async () => {
    const email = "brute-force-target@example.com";
    const attempts = Array.from({ length: 10 }, () =>
      request(app).post("/auth/sign-in/email").send({ email, password: "wrong-password" }),
    );

    const responses = [];
    for (const attempt of attempts) {
      responses.push(await attempt); // sequential - rate limiting is about request count, not concurrency
    }

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 401).length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // The last few of 10 attempts (limit is 8) must be locked out.
    expect(statuses.slice(-2)).toEqual([429, 429]);
  });
});
