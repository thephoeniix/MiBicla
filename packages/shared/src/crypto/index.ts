import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const VERSION = "v1";
function keyFromHex(keyHex = process.env.APP_ENCRYPTION_KEY): Buffer {
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex))
    throw new Error(
      "APP_ENCRYPTION_KEY debe contener exactamente 64 caracteres hexadecimales",
    );
  return Buffer.from(keyHex, "hex");
}
export function encrypt(value: string, keyHex?: string): string {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", keyFromHex(keyHex), iv),
    ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decrypt(payload: string, keyHex?: string): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined)
    throw new Error("Texto cifrado inválido");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromHex(keyHex),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
