// Symmetric encryption for user-supplied secrets (e.g. OpenRouter API keys).
//
// Production path: AWS/GCP KMS (key never leaves HSM).
// Hackathon path: AES-256-GCM with MAP_ENCRYPTION_KEY env var.
//
// Same interface either way — swap `encrypt`/`decrypt` impl when wiring KMS.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

function getKey(): Buffer {
  const hex = process.env.MAP_ENCRYPTION_KEY;
  if (!hex) throw new Error("missing env: MAP_ENCRYPTION_KEY");
  if (hex.length === 64) return Buffer.from(hex, "hex"); // 32-byte key
  // Tolerate non-hex keys by hashing — strictly for dev convenience.
  return createHash("sha256").update(hex).digest();
}

/** Encrypt to base64(iv || authTag || ciphertext). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypt base64(iv || authTag || ciphertext). */
export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
