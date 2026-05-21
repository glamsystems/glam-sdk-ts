import { Commitment, Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  KAMINO_LENDING_PROGRAM,
  KAMINO_OBTRIGATION_SIZE,
  ORCA_POSITION_DISCRIMINATOR,
  ORCA_WHIRLPOOLS_PROGRAM_ID,
} from "../constants";

/**
 * Categorized external positions by protocol type.
 */
export interface CategorizedPositions {
  /** Kamino lending obligation accounts */
  kaminoObligations: PublicKey[];
  /** Kamino vault share token accounts */
  kaminoVaultShareAtas: PublicKey[];
  /** Orca Whirlpools position PDA accounts */
  orcaWhirlpoolPositions: PublicKey[];
  /** Positions that couldn't be categorized */
  unknown: PublicKey[];
}

/**
 * Utility class for categorizing external positions by protocol type.
 *
 * External positions in GLAM vaults can be:
 * - Kamino obligation accounts (lending positions)
 * - Kamino vault share ATAs (shares in kamino vaults)
 *
 * This class determines the type of each position to enable proper pricing.
 */
export class PositionCategorizer {
  constructor(
    private readonly connection: Connection,
    _vaultPda?: PublicKey,
  ) {}

  /**
   * Categorizes external positions by protocol type.
   *
   * Algorithm:
   * 1. Batch fetch positions
   * 2. Categorize based on account owner and size
   *
   * @param externalPositions - Array of external position pubkeys from state account
   * @returns Categorized positions by protocol type
   */
  async categorizePositions(
    externalPositions: PublicKey[],
    commitment: Commitment,
  ): Promise<CategorizedPositions> {
    const result: CategorizedPositions = {
      kaminoObligations: [],
      kaminoVaultShareAtas: [],
      orcaWhirlpoolPositions: [],
      unknown: [],
    };

    if (externalPositions.length === 0) {
      return result;
    }

    // Batch fetch account info for positions
    // Split into chunks of 100 to stay under RPC limits
    const chunkSize = 100;
    const accountsInfo: (Awaited<
      ReturnType<Connection["getAccountInfo"]>
    > | null)[] = [];

    for (let i = 0; i < externalPositions.length; i += chunkSize) {
      const chunk = externalPositions.slice(i, i + chunkSize);
      const chunkInfo = await this.connection.getMultipleAccountsInfo(
        chunk,
        commitment,
      );
      accountsInfo.push(...chunkInfo);
    }

    // Step 3: Categorize based on owner and size
    for (let i = 0; i < accountsInfo.length; i++) {
      const info = accountsInfo[i];
      const pubkey = externalPositions[i];

      if (!info) {
        // Account doesn't exist - may have been closed
        result.unknown.push(pubkey);
        continue;
      }

      const owner = info.owner;
      const size = info.data.length;

      if (
        owner.equals(KAMINO_LENDING_PROGRAM) &&
        size === KAMINO_OBTRIGATION_SIZE
      ) {
        result.kaminoObligations.push(pubkey);
      } else if (
        owner.equals(ORCA_WHIRLPOOLS_PROGRAM_ID) &&
        ORCA_POSITION_DISCRIMINATOR.every(
          (byte, offset) => info.data[offset] === byte,
        )
      ) {
        result.orcaWhirlpoolPositions.push(pubkey);
      } else if (
        owner.equals(TOKEN_PROGRAM_ID) ||
        owner.equals(TOKEN_2022_PROGRAM_ID)
      ) {
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
