/**
 * Browsers expose crypto.randomUUID only on secure origins (https, localhost). On a plain-http address, such as the
 * local demo opened over Wi-Fi, it is missing and every screen that names a new record or request would fail. The same
 * version 4 UUID is built there from crypto.getRandomValues, which every origin has. On https this does nothing.
 */
const browserCrypto = globalThis.crypto as Crypto | undefined;
if (browserCrypto && typeof browserCrypto.randomUUID !== "function" && typeof browserCrypto.getRandomValues === "function") {
  Object.defineProperty(browserCrypto, "randomUUID", {
    configurable: true,
    writable: true,
    value: function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
      const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
  });
}

export {};
