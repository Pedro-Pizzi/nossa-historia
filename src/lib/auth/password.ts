import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 131072, r = 8, p = 1, length = 64;
const pattern = /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
let pending = Promise.resolve();

/** Limitar a uma derivação simultânea mantém previsível o uso de memória. */
function derive(password: string, salt: Buffer): Promise<Buffer> {
  const result = pending.then(() => new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, { N, r, p, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
  }));
  pending = result.then(() => undefined, () => undefined);
  return result;
}

export function validPasswordHash(value: string) { return pattern.test(value); }
export function validNewPassword(value: string) { return value.length >= 12 && value.length <= 128; }

export async function hashPassword(password: string) {
  if (!validNewPassword(password)) throw new Error("Use uma senha de 12 a 128 caracteres.");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

const dummyHash = `scrypt$${N}$${r}$${p}$${randomBytes(16).toString("hex")}$${randomBytes(length).toString("hex")}`;
export async function verifyPassword(password: string, hash?: string) {
  const match = (hash && validPasswordHash(hash) ? hash : dummyHash).match(pattern)!;
  const key = await derive(password, Buffer.from(match[1], "hex"));
  const matches = timingSafeEqual(key, Buffer.from(match[2], "hex"));
  return !!hash && validPasswordHash(hash) && matches;
}
