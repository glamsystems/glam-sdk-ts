import { PublicKey } from "@solana/web3.js";

const PUBKEY_LEN = 32;

const BANK_DISCRIMINATOR = Buffer.from([142, 49, 166, 242, 50, 66, 97, 188]);
const MARGINFI_ACCOUNT_DISCRIMINATOR = Buffer.from([
  67, 178, 130, 109, 126, 114, 28, 42,
]);

const BANK_MINT_OFFSET = 8;
const BANK_GROUP_OFFSET = 41;
const BANK_LIQUIDITY_VAULT_OFFSET = 112;
const BANK_ORACLE_KEYS_OFFSET = 610;
const BANK_INTEGRATION_ACC_1_OFFSET = 1560;
const BANK_INTEGRATION_ACC_2_OFFSET = 1592;
const BANK_ORACLE_KEYS_LEN = 5;

const MARGINFI_ACCOUNT_BALANCES_OFFSET = 72;
const MARGINFI_ACCOUNT_BALANCE_LEN = 104;
const MARGINFI_ACCOUNT_BALANCES_LEN = 16;
const MARGINFI_BALANCE_ACTIVE_OFFSET = 0;
const MARGINFI_BALANCE_BANK_OFFSET = 1;

export type DecodedMarginfiBank = {
  group: PublicKey;
  mint: PublicKey;
  liquidityVault: PublicKey;
  integrationAcc1: PublicKey;
  integrationAcc2: PublicKey;
  oracleKeys: PublicKey[];
};

export type DecodedMarginfiBalance = {
  active: number;
  bank: PublicKey;
};

function assertDiscriminator(
  data: Buffer,
  discriminator: Buffer,
  name: string,
) {
  if (!data.subarray(0, discriminator.length).equals(discriminator)) {
    throw new Error(`Invalid ${name} account discriminator`);
  }
}

function readPublicKey(data: Buffer, offset: number): PublicKey {
  return new PublicKey(data.subarray(offset, offset + PUBKEY_LEN));
}

export function decodeMarginfiBank(data: Buffer): DecodedMarginfiBank {
  assertDiscriminator(data, BANK_DISCRIMINATOR, "Marginfi bank");

  return {
    group: readPublicKey(data, BANK_GROUP_OFFSET),
    mint: readPublicKey(data, BANK_MINT_OFFSET),
    liquidityVault: readPublicKey(data, BANK_LIQUIDITY_VAULT_OFFSET),
    integrationAcc1: readPublicKey(data, BANK_INTEGRATION_ACC_1_OFFSET),
    integrationAcc2: readPublicKey(data, BANK_INTEGRATION_ACC_2_OFFSET),
    oracleKeys: Array.from({ length: BANK_ORACLE_KEYS_LEN }, (_, index) =>
      readPublicKey(data, BANK_ORACLE_KEYS_OFFSET + index * PUBKEY_LEN),
    ),
  };
}

export function decodeMarginfiBalances(data: Buffer): DecodedMarginfiBalance[] {
  assertDiscriminator(data, MARGINFI_ACCOUNT_DISCRIMINATOR, "Marginfi account");

  return Array.from({ length: MARGINFI_ACCOUNT_BALANCES_LEN }, (_, index) => {
    const offset =
      MARGINFI_ACCOUNT_BALANCES_OFFSET + index * MARGINFI_ACCOUNT_BALANCE_LEN;
    return {
      active: data[offset + MARGINFI_BALANCE_ACTIVE_OFFSET],
      bank: readPublicKey(data, offset + MARGINFI_BALANCE_BANK_OFFSET),
    };
  });
}
