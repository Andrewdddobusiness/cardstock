import crypto from "crypto";

export function fp(obj: unknown) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex")
    .slice(0, 16);
}