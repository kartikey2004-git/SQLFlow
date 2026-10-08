import { randomBytes } from "crypto";
import { argon2id, argon2Verify } from "hash-wasm";

const ITERATIONS = 2;
const PARALLELISM = 1;
const MEMORY_SIZE_KIB = 19 * 1024;
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
      return false;
    }
  },
};
