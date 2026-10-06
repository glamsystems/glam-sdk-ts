import { BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, StakeProgram } from "@solana/web3.js";
import { BaseClient } from "../../src/client/base";
import {
  StakePoolClient,
  decodeValidatorListEntries,
  validatorStakeAccountAddress,
} from "../../src/client/stake-pool";

// The stake pool program's ValidatorList: a header of 5 bytes, the entry count, then 73-byte
// entries laid out as its ValidatorStakeInfo (program/src/state.rs).
function validatorList(
  entries: { vote: PublicKey; active: BN; suffix?: number }[],
): Buffer {
  const data = Buffer.alloc(9 + entries.length * 73);
  data.writeUInt8(2, 0); // AccountType::ValidatorList
  data.writeUInt32LE(100, 1); // max_validators
  data.writeUInt32LE(entries.length, 5);
  entries.forEach(({ vote, active, suffix }, i) => {
    const at = 9 + i * 73;
    active.toArrayLike(Buffer, "le", 8).copy(data, at);
    new BN(0).toArrayLike(Buffer, "le", 8).copy(data, at + 8);
    new BN(700).toArrayLike(Buffer, "le", 8).copy(data, at + 16);
    new BN(0).toArrayLike(Buffer, "le", 8).copy(data, at + 24);
    data.writeUInt32LE(0, at + 32);
    data.writeUInt32LE(suffix ?? 0, at + 36);
    data.writeUInt8(0, at + 40); // StakeStatus::Active
    vote.toBuffer().copy(data, at + 41);
  });
  return data;
}

const RENT = 2_282_880;
// Mainnet's stake minimum delegation, one SOL.
const STAKE_MINIMUM_DELEGATION = 1_000_000_000;
const programId = Keypair.generate().publicKey;
const stakePool = Keypair.generate().publicKey;
const validatorListAddress = Keypair.generate().publicKey;
const preferred = Keypair.generate().publicKey;
const other = Keypair.generate().publicKey;

function makeClient(list: Buffer | null): StakePoolClient {
  const base = Object.create(BaseClient.prototype) as BaseClient;
  const connection = {
    getAccountInfo: jest.fn(async (address: PublicKey) =>
      list && address.equals(validatorListAddress)
        ? { data: list, owner: programId, lamports: 1, executable: false }
        : null,
    ),
    getMinimumBalanceForRentExemption: jest.fn(async (space: number) => {
      expect(space).toBe(StakeProgram.space);
      return RENT;
    }),
    getStakeMinimumDelegation: jest.fn(async () => ({
      context: { slot: 1 },
      value: STAKE_MINIMUM_DELEGATION,
    })),
  };
  Object.assign(base, {
    provider: { connection, publicKey: PublicKey.default },
  });
  return new StakePoolClient(base, {} as any, {} as any);
}

function poolData(preferredVote: PublicKey | null) {
  return {
    programId,
    depositAuthority: PublicKey.default,
    withdrawAuthority: PublicKey.default,
    poolMint: PublicKey.default,
    feeAccount: PublicKey.default,
    reserveStake: PublicKey.default,
    tokenProgramId: PublicKey.default,
    validatorList: validatorListAddress,
    preferredWithdrawValidatorVoteAddress: preferredVote,
    // 2 lamports per pool token, rounded up: (3 + 2 - 1) / 2
    totalLamports: new BN(3),
    poolTokenSupply: new BN(2),
  };
}

// rent + max(minimum delegation, 1_000_000) + lamports per pool token: the bound every deployed
// program forces the preferred validator above. SPL 2.2.0 adds one more minimum delegation to
// its own bound, and accepts the preferred validator as a source below it.
const BOUND = new BN(RENT + STAKE_MINIMUM_DELEGATION + 2);
const SPL_2_2_BOUND = BOUND.add(new BN(STAKE_MINIMUM_DELEGATION));

async function preferredAccount(list: Buffer, vote: PublicKey | null) {
  return makeClient(list).getPreferredWithdrawStakeAccount(
    stakePool,
    poolData(vote),
  );
}

const expectedAccount = (suffix?: Buffer) =>
  PublicKey.findProgramAddressSync(
    [preferred.toBuffer(), stakePool.toBuffer(), ...(suffix ? [suffix] : [])],
    programId,
  )[0];

describe("StakePoolClient.getPreferredWithdrawStakeAccount", () => {
  it("decodes the program's validator list layout", () => {
    const entries = decodeValidatorListEntries(
      validatorList([
        { vote: preferred, active: new BN(5), suffix: 3 },
        { vote: other, active: new BN(7) },
      ]),
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].voteAccountAddress.equals(preferred)).toBe(true);
    expect(entries[0].activeStakeLamports.toNumber()).toBe(5);
    expect(entries[0].validatorSeedSuffix).toBe(3);
    expect(entries[1].validatorSeedSuffix).toBe(0);
  });

  it("names no account when the pool has no preferred withdraw validator", async () => {
    const list = validatorList([{ vote: other, active: BOUND.addn(1) }]);
    expect(await preferredAccount(list, null)).toBeNull();
  });

  it("names no account when the list does not hold the preferred validator", async () => {
    const list = validatorList([{ vote: other, active: BOUND.addn(1) }]);
    expect(await preferredAccount(list, preferred)).toBeNull();
  });

  it("names no account while the preferred validator holds no more than the bound", async () => {
    const list = validatorList([{ vote: preferred, active: BOUND }]);
    expect(await preferredAccount(list, preferred)).toBeNull();
  });

  it("names the validator stake account once the preferred validator holds more than the bound", async () => {
    const list = validatorList([{ vote: preferred, active: BOUND.addn(1) }]);
    const got = await preferredAccount(list, preferred);
    expect(got?.equals(expectedAccount())).toBe(true);
  });

  it("holds to the lower bound, not SPL 2.2.0's: a validator between the two is taken", async () => {
    const list = validatorList([
      { vote: preferred, active: SPL_2_2_BOUND.subn(1) },
    ]);
    const got = await preferredAccount(list, preferred);
    expect(got?.equals(expectedAccount())).toBe(true);
  });

  it("appends a nonzero validator seed suffix to the seeds", async () => {
    const list = validatorList([
      { vote: preferred, active: BOUND.addn(1), suffix: 3 },
    ]);
    const suffix = Buffer.alloc(4);
    suffix.writeUInt32LE(3);
    const got = await preferredAccount(list, preferred);
    expect(got?.equals(expectedAccount(suffix))).toBe(true);
    expect(
      validatorStakeAccountAddress(programId, stakePool, {
        voteAccountAddress: preferred,
        validatorSeedSuffix: 3,
      }).equals(expectedAccount(suffix)),
    ).toBe(true);
  });
});
