import {
  buildOnboardTraderDelegatedIxResolved,
  PhoenixHttpError,
  PHOENIX_GLOBAL_CONFIGURATION_ADDRESS,
  PHOENIX_LOG_AUTHORITY_ADDRESS,
  PHOENIX_PROGRAM_ADDRESS,
  RegisterIxInstructionSchema,
  type ActiveTraderBufferAddressArray,
  type Authority,
  type GlobalTraderIndexAddressArray,
  type TraderAddress,
} from "@ellipsis-labs/rise";
import { AccountRole, address, type Instruction } from "@solana/kit";
import { Keypair } from "@solana/web3.js";

import {
  assertRiseInstructionMatches,
  normalizeRiseInstruction,
  phoenixHttpNotFoundToNull,
  riseInstructionToWeb3,
  toRiseAddress,
  toWeb3PublicKey,
} from "../../src/utils/phoenixRise";

function randomAddress() {
  return toRiseAddress(Keypair.generate().publicKey);
}

function canonicalInstruction() {
  const onboarder = randomAddress() as Authority;
  const permission = randomAddress();
  const trader = randomAddress() as TraderAddress;
  const globalTraderIndex = [
    randomAddress(),
    randomAddress(),
  ] as unknown as GlobalTraderIndexAddressArray;
  const activeTraderBuffer = [
    randomAddress(),
    randomAddress(),
  ] as unknown as ActiveTraderBufferAddressArray;
  const expected = buildOnboardTraderDelegatedIxResolved({
    exchange: {
      phoenixProgramAddress: PHOENIX_PROGRAM_ADDRESS,
      logAuthorityAddress: PHOENIX_LOG_AUTHORITY_ADDRESS,
      globalConfigurationAddress: PHOENIX_GLOBAL_CONFIGURATION_ADDRESS,
      globalTraderIndex,
      activeTraderBuffer,
    },
    trader: {
      authority: onboarder,
      permissionAccount: permission,
      traderAccount: trader,
    },
  });
  const normalized = normalizeRiseInstruction(expected);
  const actual = RegisterIxInstructionSchema.parse({
    programId: normalized.programId,
    data: normalized.data,
    keys: normalized.accounts.map((account) => ({
      pubkey: account.address,
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
  });
  return { actual, expected };
}

describe("Phoenix Rise boundary", () => {
  it("round-trips Kit addresses and web3.js public keys", () => {
    const publicKey = Keypair.generate().publicKey;
    expect(toWeb3PublicKey(toRiseAddress(publicKey)).equals(publicKey)).toBe(
      true,
    );
  });

  it("converts every Kit account role without changing order", () => {
    const roles = [
      AccountRole.READONLY,
      AccountRole.WRITABLE,
      AccountRole.READONLY_SIGNER,
      AccountRole.WRITABLE_SIGNER,
    ];
    const accounts = roles.map((role) => ({ address: randomAddress(), role }));
    const instruction: Instruction = {
      programAddress: address(PHOENIX_PROGRAM_ADDRESS),
      accounts,
      data: new Uint8Array([1, 2, 3]),
    };

    const web3Instruction = riseInstructionToWeb3(instruction);

    expect(web3Instruction.keys).toEqual([
      expect.objectContaining({ isSigner: false, isWritable: false }),
      expect.objectContaining({ isSigner: false, isWritable: true }),
      expect.objectContaining({ isSigner: true, isWritable: false }),
      expect.objectContaining({ isSigner: true, isWritable: true }),
    ]);
    expect(web3Instruction.keys.map((key) => key.pubkey.toBase58())).toEqual(
      accounts.map((account) => account.address),
    );
    expect([...web3Instruction.data]).toEqual([1, 2, 3]);
  });

  it("maps only Rise HTTP 404 errors to null", async () => {
    await expect(
      phoenixHttpNotFoundToNull(async () => {
        throw new PhoenixHttpError(404, "not found");
      }),
    ).resolves.toBeNull();
    await expect(
      phoenixHttpNotFoundToNull(async () => {
        throw new PhoenixHttpError(500, "server error");
      }),
    ).rejects.toMatchObject({ status: 500 });
    await expect(
      phoenixHttpNotFoundToNull(async () => {
        throw { status: 404 };
      }),
    ).rejects.toEqual({ status: 404 });
  });

  it("accepts a delegated bundle produced by Rise", () => {
    const { actual, expected } = canonicalInstruction();
    const instruction = assertRiseInstructionMatches(actual, expected);

    expect(instruction.programId.toBase58()).toBe(actual.programId);
    expect([...instruction.data]).toEqual(actual.data);
    expect(instruction.keys.map((key) => key.pubkey.toBase58())).toEqual(
      actual.keys.map((key) => key.pubkey),
    );
  });

  it.each([
    "program",
    "data",
    "account",
    "ordering",
    "onboarder signer",
    "unexpected signer",
    "writability",
  ])("rejects a canonical-bundle mutation to %s", (mutation) => {
    const { actual, expected } = canonicalInstruction();
    const mutated = {
      ...actual,
      data: [...actual.data],
      keys: actual.keys.map((key) => ({ ...key })),
    };

    switch (mutation) {
      case "program":
        mutated.programId = randomAddress();
        break;
      case "data":
        mutated.data[0] ^= 1;
        break;
      case "account":
        mutated.keys[5].pubkey = randomAddress();
        break;
      case "ordering":
        [mutated.keys[6], mutated.keys[7]] = [mutated.keys[7], mutated.keys[6]];
        break;
      case "onboarder signer":
        mutated.keys[3].isSigner = false;
        break;
      case "unexpected signer":
        mutated.keys[5].isSigner = true;
        break;
      case "writability":
        mutated.keys[4].isWritable = false;
        break;
    }

    expect(() =>
      assertRiseInstructionMatches(
        RegisterIxInstructionSchema.parse(mutated),
        expected,
      ),
    ).toThrow();
  });
});
