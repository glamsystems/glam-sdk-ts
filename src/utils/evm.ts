import { PublicKey } from "@solana/web3.js";

export const evmAddressToBytes32 = (address: string): string =>
  `0x000000000000000000000000${address.replace("0x", "")}`;

export const hexToBytes = (hex: string) => {
  if (hex.startsWith("0x")) hex = hex.slice(2);
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.slice(c, c + 2), 16));
  return bytes;
};

export const evmAddressToPublicKey = (address: string): PublicKey => {
  return new PublicKey(hexToBytes(evmAddressToBytes32(address)));
};

export const bytesToHex = (bytes: number[] | Uint8Array): string => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const publicKeyToEvmAddress = (publicKey: PublicKey): string => {
  const bytes = publicKey.toBytes();
  const hex = bytesToHex(bytes);
  // EVM addresses are the last 20 bytes (40 hex characters) of the 32-byte public key
  const evmAddress = hex.slice(-40);
  return `0x${evmAddress}`;
};

/**
 * Validates if a string is a valid EVM address (40 hex characters)
 */
export const isValidEvmAddress = (addr: string): boolean => {
  const cleanAddr = addr.startsWith("0x") ? addr.slice(2) : addr;
  return /^[0-9a-fA-F]{40}$/.test(cleanAddr);
};
