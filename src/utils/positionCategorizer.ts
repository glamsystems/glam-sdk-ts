import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  DRIFT_PROGRAM_ID,
  DRIFT_VAULTS_PROGRAM_ID,
  DRIFT_VAULT_DEPOSITOR_SIZE,
  KAMINO_LENDING_PROGRAM,
  KAMINO_OBTRIGATION_SIZE,
} from "../constants";
import { PkSet } from "./pkset";

/**
 * Categorized external positions by protocol type.
 */
export interface CategorizedPositions {
  /** Direct drift user PDAs controlled by the vault */
  driftUsers: PublicKey[];
  /** Drift vault depositor accounts */
  driftVaultDepositors: PublicKey[];
  /** Kamino lending obligation accounts */
  kaminoObligations: PublicKey[];
  /** Kamino vault share token accounts */
  kaminoVaultShareAtas: PublicKey[];
  /** Positions that couldn't be categorized */
  unknown: PublicKey[];
}

/**
 * Utility class for categorizing external positions by protocol type.
 *
 * External positions in GLAM vaults can be:
 * - Drift user PDAs (direct trading positions)
 * - Drift vault depositor accounts (shares in drift vaults)
 * - Kamino obligation accounts (lending positions)
 * - Kamino vault share ATAs (shares in kamino vaults)
 *
 * This class determines the type of each position to enable proper pricing.
 */
export class PositionCategorizer {
  private readonly possibleDriftUserPdas: PkSet;

  constructor(
    private readonly connection: Connection,
    private readonly vaultPda: PublicKey,
  ) {
    // Pre-compute all possible drift user PDAs for subAccountIds 0-99
    // This allows O(1) lookup without RPC calls
    this.possibleDriftUserPdas = new PkSet();
    for (let i = 0; i < 100; i++) {
      this.possibleDriftUserPdas.add(this.getDriftUserPda(this.vaultPda, i));
    }
  }

  /**
   * Derives a drift user PDA for a given authority and subAccountId.
   */
  private getDriftUserPda(
    authority: PublicKey,
    subAccountId: number,
  ): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("user"),
        authority.toBuffer(),
        new BN(subAccountId).toArrayLike(Buffer, "le", 2),
      ],
      DRIFT_PROGRAM_ID,
    )[0];
  }

  /**
   * Checks if a pubkey matches any drift user PDA for subAccountIds 0-99.
   * This is a pure computation - no RPC calls needed.
   */
  isDriftUserPda(pubkey: PublicKey): boolean {
    return this.possibleDriftUserPdas.has(pubkey);
  }

  /**
   * Categorizes external positions by protocol type.
   *
   * Algorithm:
   * 1. Identify drift users by matching against pre-computed PDAs (no RPC)
   * 2. Batch fetch remaining positions to determine their type
   * 3. Categorize based on account owner and size
   *
   * @param externalPositions - Array of external position pubkeys from state account
   * @returns Categorized positions by protocol type
   */
  async categorizePositions(
    externalPositions: PublicKey[],
    commitment: Commitment,
  ): Promise<CategorizedPositions> {
    const result: CategorizedPositions = {
      driftUsers: [],
      driftVaultDepositors: [],
      kaminoObligations: [],
      kaminoVaultShareAtas: [],
      unknown: [],
    };

    if (externalPositions.length === 0) {
      return result;
    }

    // Step 1: Separate drift users (known via PDA derivation) from others
    const positionsNeedingRpc: PublicKey[] = [];
    for (const pos of externalPositions) {
      if (this.isDriftUserPda(pos)) {
        result.driftUsers.push(pos);
      } else {
        positionsNeedingRpc.push(pos);
      }
    }

    if (positionsNeedingRpc.length === 0) {
      return result;
    }

    // Step 2: Batch fetch account info for remaining positions
    // Split into chunks of 100 to stay under RPC limits
    const chunkSize = 100;
    const accountsInfo: (Awaited<
      ReturnType<Connection["getAccountInfo"]>
    > | null)[] = [];

    for (let i = 0; i < positionsNeedingRpc.length; i += chunkSize) {
      const chunk = positionsNeedingRpc.slice(i, i + chunkSize);
      const chunkInfo = await this.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accountsInfo.push(...chunkInfo);
    }

    // Step 3: Categorize based on owner and size
    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      const pubkey = positionsNeedingRpc[i];

      if (!info) {
        // Account doesn't exist - may have been closed
        result.unknown.push(pubkey);
        continue;
      }

      const owner = info.owner;
      const size = info.data.length;

      if (
        owner.equals(DRIFT_VAULTS_PROGRAM_ID) &&
        size === DRIFT_VAULT_DEPOSITOR_SIZE
      ) {
        result.driftVaultDepositors.push(pubkey);
      } else if (
        owner.equals(KAMINO_LENDING_PROGRAM) &&
        size === KAMINO_OBTRIGATION_SIZE
      ) {
        result.kaminoObligations.push(pubkey);
      } else if (owner.equals(TOKEN_PROGRAM_ID)) {
        // Token accounts are assumed to be kamino vault share ATAs
        // since they're in externalPositions (not regular token holdings)
        result.kaminoVaultShareAtas.push(pubkey);
      } else {
        result.unknown.push(pubkey);
      }
      // TODO: support stake accounts
    }

    return result;
  }
}
