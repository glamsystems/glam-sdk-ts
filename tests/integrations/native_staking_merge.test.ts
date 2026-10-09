import { BN, Wallet } from "@coral-xyz/anchor";
import {
  AccountInfo,
  Keypair,
  ParsedAccountData,
  PublicKey,
  StakeProgram,
  SYSVAR_STAKE_HISTORY_PUBKEY,
} from "@solana/web3.js";

import {
  airdrop,
  createGlamStateForTest,
  sleep,
  defaultInitStateParams,
} from "../glam_protocol/setup";
import {
  GlamClient,
  nameToChars,
  STAKE_ACCOUNT_SIZE,
  STAKE_PROTOCOL,
  SYSTEM_PROTOCOL,
} from "../../src";
import { GlamError } from "../../src/error";
import { getStakeAccountsWithStates } from "../../src/utils/accounts";

// The Stake program's minimum delegation on this validator is 1 SOL.
const DELEGATED_LAMPORTS = 1_000_000_000;
const UNDELEGATED_LAMPORTS = 500_000_000;

// GLAM refuses a merge into a destination in its activation epoch.
const STAKE_MERGE_DESTINATION_ACTIVATING = 52013;
// The Stake program's own refusals (StakeError).
const MERGE_TRANSIENT_STAKE = 5;
const MERGE_MISMATCH = 6;

// The Stake program refuses its instructions while an epoch's rewards are paid
// out, in the epoch's first slots.
const REWARDS_PAYOUT_SLOTS = 3;
// Room for a delegation and the merge after it to land in one epoch.
const SAME_EPOCH_SLOTS = 16;

type Account = AccountInfo<Buffer | ParsedAccountData> | null;
type Delegation = {
  stake: string;
  activationEpoch: string;
  deactivationEpoch: string;
};
type StakeHistoryEntry = {
  epoch: number;
  stakeHistory: { activating: number; deactivating: number };
};

const parsedStake = (account: Account) =>
  (account?.data as ParsedAccountData | undefined)?.parsed;
const delegationOf = (account: Account): Delegation | undefined =>
  parsedStake(account)?.info?.stake?.delegation;
// A balance below 2^53, where a JavaScript number holds it exactly.
const exact = (lamports: number) => {
  expect(Number.isSafeInteger(lamports)).toBe(true);
  return lamports;
};

describe("native_staking_merge", () => {
  // An owner of its own, which signs and pays: the default wallet holds more
  // lamports than a JavaScript number carries exactly, and every check here is
  // to the lamport.
  const owner = Keypair.generate();
  const glamClient = new GlamClient({ wallet: new Wallet(owner) });
  const connection = glamClient.provider.connection;
  // Every signature the client sends, a failed merge's included.
  const sentSignatures: string[] = [];

  let defaultVote: PublicKey; // the test validator's default vote account
  let reserve: number; // the Rent sysvar minimum for a stake account
  let epochOf: (slot: number) => number;

  // Delegated before the activation-epoch cases so they warm up meanwhile;
  // each case still merges accounts of its own.
  let fullyActive: PublicKey[];
  let mismatchDestination: PublicKey;
  let deactivating: PublicKey[];
  let deactivated: PublicKey[];

  beforeAll(async () => {
    const voteAccountStatus = await connection.getVoteAccounts();
    const vote = voteAccountStatus.current.sort(
      (a, b) => b.activatedStake - a.activatedStake,
    )[0].votePubkey;
    defaultVote = new PublicKey(vote);

    reserve =
      await connection.getMinimumBalanceForRentExemption(STAKE_ACCOUNT_SIZE);
    const epochSchedule = await connection.getEpochSchedule();
    epochOf = (slot) => epochSchedule.getEpoch(slot);
    glamClient.onSentListeners.add((signature) =>
      sentSignatures.push(signature),
    );
  });

  // Waits until past the rewards payout with `slotsNeeded` slots of the epoch
  // left, so what follows lands in one epoch.
  const waitForEpochWindow = async (slotsNeeded: number) => {
    for (;;) {
      const { slotIndex, slotsInEpoch } =
        await connection.getEpochInfo("confirmed");
      if (
        slotIndex >= REWARDS_PAYOUT_SLOTS &&
        slotsInEpoch - slotIndex >= slotsNeeded
      ) {
        return;
      }
      await sleep(500);
    }
  };

  // getStakeAccountsWithStates says "active" once the activation epoch has
  // passed and "inactive" once the deactivation epoch has, while the Stake
  // program merges only stake that has finished warming up or cooling down.
  // The newest StakeHistory entry records the epoch just ended: nothing
  // activating there means every earlier delegation is fully effective, and
  // nothing deactivating means every earlier deactivation is complete.
  const waitUntilSettled = async (
    accounts: PublicKey[],
    state: "active" | "inactive",
    timeoutMs: number,
  ) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const [stakeAccounts, history, { epoch }] = await Promise.all([
        getStakeAccountsWithStates(connection, glamClient.vaultPda),
        connection.getParsedAccountInfo(
          SYSVAR_STAKE_HISTORY_PUBKEY,
          "confirmed",
        ),
        connection.getEpochInfo("confirmed"),
      ]);
      const entries: StakeHistoryEntry[] = (
        history.value?.data as ParsedAccountData
      ).parsed.info;
      const newest = entries.reduce((a, b) => (b.epoch > a.epoch ? b : a));
      const states = accounts.map(
        (account) =>
          stakeAccounts.find((stake) => stake.address.equals(account))?.state,
      );
      const pending =
        state === "active"
          ? newest.stakeHistory.activating
          : newest.stakeHistory.deactivating;
      if (
        states.every((s) => s === state) &&
        newest.epoch === epoch - 1 &&
        pending === 0
      ) {
        return;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `stake not settled ${state} in epoch ${epoch}: ${JSON.stringify({ states, newest })}`,
        );
      }
      await sleep(2_000);
    }
  };

  // A tracked stake account initialized through GLAM and funded by the vault,
  // not delegated.
  const createUndelegated = async (lamports: number) => {
    await waitForEpochWindow(4);
    const glamSigner = glamClient.signer;
    const glamState = glamClient.statePda;
    const [stake, createStakeAccountIx] =
      await glamClient.stake.createStakeAccount(glamSigner);
    const initStakeIx = await (glamClient.protocolProgram.methods as any)
      .stakeInitialize()
      .accounts({ glamState, glamSigner, stake })
      .instruction();
    const fundStakeIx = await glamClient.protocolProgram.methods
      .systemTransfer(new BN(lamports))
      .accounts({ glamState, glamSigner, to: stake })
      .instruction();
    const tx = await glamClient.stake.txBuilder.buildVersionedTx(
      [createStakeAccountIx, initStakeIx, fundStakeIx],
      { simulate: true },
    );
    await glamClient.sendAndConfirm(tx);
    return stake;
  };

  const createDelegated = async (lamports: number) => {
    await waitForEpochWindow(4);
    const [tx, stake] =
      await glamClient.stake.txBuilder.initializeAndDelegateStakeTx(
        defaultVote,
        new BN(lamports),
        { simulate: true },
      );
    await glamClient.sendAndConfirm(tx);
    return stake;
  };

  // The signer, the vault and both stake accounts, read at one slot.
  const snapshot = async (destination: PublicKey, source: PublicKey) => {
    const { context, value } = await connection.getMultipleParsedAccounts(
      [glamClient.signer, glamClient.vaultPda, destination, source],
      { commitment: "confirmed" },
    );
    return {
      epoch: epochOf(context.slot),
      signer: exact(value[0]!.lamports),
      vault: exact(value[1]!.lamports),
      destination: value[2],
      source: value[3],
    };
  };

  const confirmedTransaction = async (signature: string) => {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta) throw new Error(`no transaction ${signature}`);
    const { meta } = tx;
    const keys = tx.transaction.message
      .getAccountKeys({ accountKeysFromLookups: meta.loadedAddresses })
      .keySegments()
      .flat();
    // The account's lamports when the transaction started and when it ended.
    const balances = (account: PublicKey) => {
      const index = keys.findIndex((key) => key.equals(account));
      if (index < 0) throw new Error(`${account} not in ${signature}`);
      return {
        pre: exact(meta.preBalances[index]),
        post: exact(meta.postBalances[index]),
      };
    };
    return {
      epoch: epochOf(tx.slot),
      fee: meta.fee,
      err: meta.err,
      logs: meta.logMessages ?? [],
      balances,
    };
  };

  const tracked = async (...accounts: PublicKey[]) => {
    const { externalPositions } = await glamClient.fetchStateModel();
    return accounts.map((account) =>
      externalPositions.some((position) => position.equals(account)),
    );
  };

  // The survivor holds both balances less the source's reserve, which goes to
  // the transaction's signer (here also the one that paid it); the vault is
  // untouched and the source closed.
  const expectMerge = async (
    destination: PublicKey,
    source: PublicKey,
    slotsNeeded = 8,
  ) => {
    await waitForEpochWindow(slotsNeeded);
    const before = await snapshot(destination, source);
    const signature = await glamClient.stake.merge(destination, source);
    const after = await snapshot(destination, source);
    const tx = await confirmedTransaction(signature);

    // One epoch from the first read to the last, so no rewards in between.
    expect([tx.epoch, after.epoch]).toEqual([before.epoch, before.epoch]);

    const signer = tx.balances(glamClient.signer);
    const vault = tx.balances(glamClient.vaultPda);
    const survivor = tx.balances(destination);
    const closed = tx.balances(source);
    expect(survivor.post).toEqual(survivor.pre + closed.pre - reserve);
    expect(closed.post).toEqual(0);
    expect(signer.post).toEqual(signer.pre + reserve - tx.fee);
    expect(vault.post).toEqual(vault.pre);

    expect(after.signer).toEqual(before.signer + reserve - tx.fee);
    expect(after.destination?.lamports).toEqual(
      before.destination!.lamports + before.source!.lamports - reserve,
    );
    expect(after.source).toBeNull();
    expect(after.vault).toEqual(before.vault);
    expect(await tracked(destination, source)).toEqual([true, false]);

    console.log("merge tx:", signature, {
      reserve,
      fee: tx.fee,
      destination: before.destination!.lamports,
      source: before.source!.lamports,
      survivor: after.destination?.lamports,
      signerChange: after.signer - before.signer,
    });
    return { before, after, tx };
  };

  // The merge lands and fails with `code` from `program`; only the fee moves.
  const expectMergeRefused = async (
    destination: PublicKey,
    source: PublicKey,
    program: PublicKey,
    code: number,
    slotsNeeded = 8,
  ) => {
    await waitForEpochWindow(slotsNeeded);
    const before = await snapshot(destination, source);
    const sent = sentSignatures.length;
    const error = await glamClient.stake.merge(destination, source).then(
      () => undefined,
      (e: unknown) => e,
    );
    const after = await snapshot(destination, source);

    const instructionError = {
      InstructionError: [expect.any(Number), { Custom: code }],
    };
    expect(error).toBeInstanceOf(GlamError);
    expect((error as GlamError).rawError).toEqual(instructionError);
    expect(sentSignatures.length).toEqual(sent + 1);
    const tx = await confirmedTransaction(sentSignatures[sent]);
    expect(tx.err).toEqual(instructionError);
    expect(tx.logs).toContain(
      `Program ${program} failed: custom program error: 0x${code.toString(16)}`,
    );
    expect([tx.epoch, after.epoch]).toEqual([before.epoch, before.epoch]);

    for (const account of [destination, source, glamClient.vaultPda]) {
      const { pre, post } = tx.balances(account);
      expect(post).toEqual(pre);
    }
    const signer = tx.balances(glamClient.signer);
    expect(signer.post).toEqual(signer.pre - tx.fee);

    expect(after.signer).toEqual(before.signer - tx.fee);
    expect(after.vault).toEqual(before.vault);
    expect(after.destination).toEqual(before.destination);
    expect(after.source).toEqual(before.source);
    expect(await tracked(destination, source)).toEqual([true, true]);
    return { before, tx };
  };

  const invokesStakeProgram = (logs: string[]) =>
    logs.some((log) =>
      log.startsWith(`Program ${StakeProgram.programId} invoke`),
    );

  it("Fund the signer and create a vault with 100 SOL", async () => {
    await airdrop(connection, owner.publicKey, 10_000_000_000);
    expect(await connection.getBalance(owner.publicKey)).toEqual(
      10_000_000_000,
    );

    const integrationAcls = [
      {
        integrationProgram: glamClient.protocolProgram.programId,
        protocolsBitmask: SYSTEM_PROTOCOL | STAKE_PROTOCOL,
        protocolPolicies: [],
      },
    ];
    const { statePda, vaultPda } = await createGlamStateForTest(glamClient, {
      ...defaultInitStateParams,
      name: nameToChars("Stake Merge Tests"),
      integrationAcls,
    });
    console.log("State PDA:", statePda);
    console.log("Vault PDA:", vaultPda);

    await airdrop(connection, vaultPda, 100_000_000_000);
    expect(await glamClient.getVaultLamports()).toBeGreaterThanOrEqual(
      100_000_000_000,
    );
  }, 30_000);

  it("Delegate the accounts the fully active and deactivated cases merge", async () => {
    fullyActive = [
      await createDelegated(DELEGATED_LAMPORTS),
      await createDelegated(DELEGATED_LAMPORTS),
    ];
    mismatchDestination = await createDelegated(DELEGATED_LAMPORTS);
    deactivating = [
      await createDelegated(DELEGATED_LAMPORTS),
      await createDelegated(DELEGATED_LAMPORTS),
    ];
    deactivated = [
      await createDelegated(DELEGATED_LAMPORTS),
      await createDelegated(DELEGATED_LAMPORTS),
    ];
    const accounts = [
      ...fullyActive,
      mismatchDestination,
      ...deactivating,
      ...deactivated,
    ];
    expect(await tracked(...accounts)).toEqual(accounts.map(() => true));
  }, 90_000);

  it("Merge two undelegated accounts", async () => {
    const destination = await createUndelegated(UNDELEGATED_LAMPORTS);
    const source = await createUndelegated(UNDELEGATED_LAMPORTS);

    const { after } = await expectMerge(destination, source);
    expect(parsedStake(after.destination)?.type).toEqual("initialized");
  }, 60_000);

  it("Merge a source delegated this epoch into an undelegated destination, which stays undelegated", async () => {
    const destination = await createUndelegated(UNDELEGATED_LAMPORTS);
    await waitForEpochWindow(SAME_EPOCH_SLOTS);
    const source = await createDelegated(DELEGATED_LAMPORTS);

    const { before, after, tx } = await expectMerge(destination, source, 4);
    expect(parsedStake(before.destination)?.type).toEqual("initialized");
    expect(delegationOf(before.source)?.activationEpoch).toEqual(
      String(tx.epoch),
    );
    expect(parsedStake(after.destination)?.type).toEqual("initialized");
  }, 60_000);

  it("Refuse, before any CPI, a merge into a destination delegated this epoch", async () => {
    const source = await createUndelegated(UNDELEGATED_LAMPORTS);
    await waitForEpochWindow(SAME_EPOCH_SLOTS);
    const destination = await createDelegated(DELEGATED_LAMPORTS);

    const { before, tx } = await expectMergeRefused(
      destination,
      source,
      glamClient.protocolProgram.programId,
      STAKE_MERGE_DESTINATION_ACTIVATING,
      4,
    );
    expect(delegationOf(before.destination)?.activationEpoch).toEqual(
      String(tx.epoch),
    );
    expect(parsedStake(before.source)?.type).toEqual("initialized");
    expect(invokesStakeProgram(tx.logs)).toBe(false);
  }, 60_000);

  it("Refuse, before any CPI, a merge of two accounts delegated this epoch", async () => {
    await waitForEpochWindow(SAME_EPOCH_SLOTS + 4);
    const destination = await createDelegated(DELEGATED_LAMPORTS);
    const source = await createDelegated(DELEGATED_LAMPORTS);

    const { before, tx } = await expectMergeRefused(
      destination,
      source,
      glamClient.protocolProgram.programId,
      STAKE_MERGE_DESTINATION_ACTIVATING,
      4,
    );
    expect(delegationOf(before.destination)?.activationEpoch).toEqual(
      String(tx.epoch),
    );
    expect(delegationOf(before.source)?.activationEpoch).toEqual(
      String(tx.epoch),
    );
    expect(invokesStakeProgram(tx.logs)).toBe(false);
  }, 60_000);

  it("Merge two fully active accounts; the source's reserve is not staked", async () => {
    await waitUntilSettled(fullyActive, "active", 150_000);
    const [destination, source] = fullyActive;

    const { before, after } = await expectMerge(destination, source);
    expect(BigInt(delegationOf(after.destination)!.stake)).toEqual(
      BigInt(delegationOf(before.destination)!.stake) +
        BigInt(delegationOf(before.source)!.stake),
    );
  }, 180_000);

  it("Refuse a merge of an undelegated source into a fully active destination (MergeMismatch)", async () => {
    const source = await createUndelegated(UNDELEGATED_LAMPORTS);
    await waitUntilSettled([mismatchDestination], "active", 150_000);

    await expectMergeRefused(
      mismatchDestination,
      source,
      StakeProgram.programId,
      MERGE_MISMATCH,
    );
  }, 180_000);

  it("Refuse a merge of two accounts deactivated this epoch (MergeTransientStake)", async () => {
    await waitUntilSettled(deactivating, "active", 150_000);
    await waitForEpochWindow(SAME_EPOCH_SLOTS);
    await glamClient.stake.deactivate(deactivating);
    const [destination, source] = deactivating;

    const { before, tx } = await expectMergeRefused(
      destination,
      source,
      StakeProgram.programId,
      MERGE_TRANSIENT_STAKE,
      4,
    );
    expect(delegationOf(before.destination)?.deactivationEpoch).toEqual(
      String(tx.epoch),
    );
    expect(delegationOf(before.source)?.deactivationEpoch).toEqual(
      String(tx.epoch),
    );
  }, 180_000);

  it("Merge two fully deactivated accounts", async () => {
    await waitUntilSettled(deactivated, "active", 150_000);
    await waitForEpochWindow(4);
    await glamClient.stake.deactivate(deactivated);
    await waitUntilSettled(deactivated, "inactive", 150_000);
    const [destination, source] = deactivated;

    const { after } = await expectMerge(destination, source);
    expect(parsedStake(after.destination)?.type).toEqual("delegated");
  }, 240_000);
});
