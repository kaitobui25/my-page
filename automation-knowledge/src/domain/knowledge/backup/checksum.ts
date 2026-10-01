const encoder = new TextEncoder();

export function textBytes(value: string) {
  return encoder.encode(value);
}

export async function sha256Bytes(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? textBytes(value) : value;
  const digestInput = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
