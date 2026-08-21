import { randomBytes } from "crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// OWASP-recommended Argon2id parameters for interactive login (2024 cheat sheet).
// hash-wasm is a pure-WASM implementation (no native addon) - the native
// `argon2` package segfaults under this project's Node/tsx dev runtime even
// though it installs fine via bun, because bun can pull in a prebuilt binary
// built for Bun's own N-API ABI rather than Node's.
const ITERATIONS = 2;
const PARALLELISM = 1;
const MEMORY_SIZE_KIB = 19 * 1024; // 19 MiB
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

export const PasswordService = {
  async hash(plainPassword: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    return argon2id({
      password: plainPassword,
      salt,
      iterations: ITERATIONS,
      parallelism: PARALLELISM,
      memorySize: MEMORY_SIZE_KIB,
      hashLength: HASH_LENGTH,
      outputType: "encoded",
    });
  },

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2Verify({ hash, password: plainPassword });
    } catch {
      // Malformed/foreign hash (e.g. algorithm mismatch) - treat as mismatch, not a crash.
      return false;
    }
  },
};
