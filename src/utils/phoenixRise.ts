import {
  PhoenixHttpError,
  type PhoenixClient as RisePhoenixSdkClient,
  type RegisterIxInstruction,
} from "@ellipsis-labs/rise";
import {
  address,
  isSignerRole,
  isWritableRole,
  type Address,
  type Instruction,
} from "@solana/kit";
import {
  PublicKey,
  TransactionInstruction,
  type AccountMeta,
} from "@solana/web3.js";

export { PhoenixHttpError };

export type NormalizedRiseInstruction = {
  programId: Address;
  accounts: Array<{
    address: Address;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: number[];
};

type RiseExchangeApi = ReturnType<RisePhoenixSdkClient["api"]["exchange"]>;
type RiseTradersApi = ReturnType<RisePhoenixSdkClient["api"]["traders"]>;

/** The official Rise surfaces GLAM consumes and tests inject. */
export type PhoenixRiseClient = {
  api: {
    exchange(): Pick<
      RiseExchangeApi,
      "getSnapshot" | "buildRegisterIxs" | "sendRegisterIxs"
    >;
    traders(): Pick<RiseTradersApi, "getTrader" | "getTraderStateSnapshot">;
  };
  pda: Pick<
    RisePhoenixSdkClient["pda"],
    | "getProgramAddress"
    | "getLogAuthorityAddress"
    | "getGlobalConfigurationAddress"
    | "getTraderAddress"
    | "getSplineCollectionAddress"
    | "getGlobalVaultAddress"
    | "getEmberStateAddress"
    | "getEmberVaultAddress"
    | "getPermissionAddress"
  >;
  dispose(): void;
};

/** Convert a web3.js public key into a validated Kit address. */
export function toRiseAddress<TAddress extends Address = Address>(
  value: PublicKey | string,
): TAddress {
  return address(
    value instanceof PublicKey ? value.toBase58() : value,
  ) as TAddress;
}

/** Convert a Kit address into the SDK's web3.js representation. */
export function toWeb3PublicKey(value: Address | string): PublicKey {
  return new PublicKey(value);
}

/** Normalize either a Rise API instruction or a Rise Kit instruction. */
export function normalizeRiseInstruction(
  instruction: RegisterIxInstruction | Instruction,
): NormalizedRiseInstruction {
  if ("programId" in instruction) {
    return {
      programId: toRiseAddress(instruction.programId),
      accounts: instruction.keys.map((account) => ({
        address: toRiseAddress(account.pubkey),
        isSigner: account.isSigner,
        isWritable: account.isWritable,
      })),
      data: [...instruction.data],
    };
  }

  return {
    programId: instruction.programAddress,
    accounts: (instruction.accounts ?? []).map((account) => ({
      address: account.address,
      isSigner: isSignerRole(account.role),
      isWritable: isWritableRole(account.role),
    })),
    data: Array.from(instruction.data ?? []),
  };
}

/**
 * Compare an instruction returned by the Phoenix API with the canonical
 * instruction produced locally by Rise. Account ordering and privileges are
 * part of the comparison.
 */
export function assertRiseInstructionMatches(
  actual: RegisterIxInstruction,
  expected: Instruction,
): TransactionInstruction {
  const normalizedActual = normalizeRiseInstruction(actual);
  const normalizedExpected = normalizeRiseInstruction(expected);

  if (normalizedActual.programId !== normalizedExpected.programId) {
    throw new Error(
      `Phoenix returned program ${normalizedActual.programId}, expected ${normalizedExpected.programId}`,
    );
  }
  if (
    normalizedActual.data.length !== normalizedExpected.data.length ||
    normalizedActual.data.some(
      (byte, index) => byte !== normalizedExpected.data[index],
    )
  ) {
    throw new Error(
      "Phoenix returned unexpected delegated-onboarding instruction data",
    );
  }
  if (normalizedActual.accounts.length !== normalizedExpected.accounts.length) {
    throw new Error(
      `Phoenix returned ${normalizedActual.accounts.length} delegated-onboarding accounts; expected ${normalizedExpected.accounts.length}`,
    );
  }

  normalizedActual.accounts.forEach((account, index) => {
    const expectedAccount = normalizedExpected.accounts[index];
    if (
      account.address !== expectedAccount.address ||
      account.isSigner !== expectedAccount.isSigner ||
      account.isWritable !== expectedAccount.isWritable
    ) {
      throw new Error(
        `Phoenix delegated-onboarding account ${index} does not match the current Rise contract`,
      );
    }
  });

  return riseInstructionToWeb3(actual);
}

/** Convert a Rise instruction into the web3.js form used by GLAM wallets. */
export function riseInstructionToWeb3(
  instruction: RegisterIxInstruction | Instruction,
): TransactionInstruction {
  const normalized = normalizeRiseInstruction(instruction);
  const keys: AccountMeta[] = normalized.accounts.map((account) => ({
    pubkey: toWeb3PublicKey(account.address),
    isSigner: account.isSigner,
    isWritable: account.isWritable,
  }));
  return new TransactionInstruction({
    programId: toWeb3PublicKey(normalized.programId),
    keys,
    data: Buffer.from(normalized.data),
  });
}

/** Map Rise's typed HTTP 404 to the nullable read convention used by GLAM. */
export async function phoenixHttpNotFoundToNull<T>(
  request: () => Promise<T>,
): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof PhoenixHttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
