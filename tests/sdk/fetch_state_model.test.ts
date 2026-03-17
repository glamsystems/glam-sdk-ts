import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { BaseClient } from "../../src/client/base";
import { StateAccountType, StateModel } from "../../src/models";
import { fetchMintAndTokenProgram } from "../../src/utils/accounts";
import { getMintPda, getRequestQueuePda } from "../../src/utils/glamPDAs";
import { getGlamMintProgramId } from "../../src/glamExports";

jest.mock("../../src/utils/accounts", () => {
  const actual = jest.requireActual("../../src/utils/accounts");
  return {
    ...actual,
    fetchMintAndTokenProgram: jest.fn(),
  };
});

describe("BaseClient.fetchStateModel", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("supports an explicit state PDA without a connected vault", async () => {
    const explicitStatePda = new PublicKey(
      "F13gB5VrzMyW7m2vYUYGvjbTQTCvZWBBAoY1qV4ugi7K",
    );
    const mintPubkey = new PublicKey(
      "GQ7gwYiW56W8zcuHz6ESKTX6jHc4wkv22yURfrgXVjhz",
    );
    const prodMintProgramId = getGlamMintProgramId(false);
    const stagingMintProgramId = getGlamMintProgramId(true);
    const detachedMintProgram = {
      programId: prodMintProgramId,
    } as any;
    const derivedMintPubkey = getMintPda(
      explicitStatePda,
      0,
      TOKEN_2022_PROGRAM_ID,
    );
    const expectedRequestQueuePda = getRequestQueuePda(
      mintPubkey,
      prodMintProgramId,
    );
    const stateAccount = {
      mint: mintPubkey,
      accountType: StateAccountType.TOKENIZED_VAULT,
      integrationAcls: [
        {
          integrationProgram: prodMintProgramId,
          protocolsBitmask: 1,
          protocolPolicies: [],
        },
      ],
    } as any;
    const requestQueue = { pendingRequests: [] } as any;
    const mint = { tlvData: Buffer.alloc(0) } as any;
    const expectedStateModel = { id: explicitStatePda } as StateModel;

    (fetchMintAndTokenProgram as jest.MockedFunction<
      typeof fetchMintAndTokenProgram
    >).mockResolvedValue({
      mint,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    } as any);

    const fromOnchainAccountsSpy = jest
      .spyOn(StateModel, "fromOnchainAccounts")
      .mockReturnValue(expectedStateModel);

    const client = {
      _statePda: undefined,
      provider: { connection: {} },
      mintProgram: { programId: stagingMintProgramId },
      staging: false,
      fetchStateAccount: jest.fn().mockResolvedValue(stateAccount),
      fetchRequestQueue: jest.fn().mockResolvedValue(requestQueue),
      getMintProgramForStateAccount: jest
        .fn()
        .mockReturnValue(detachedMintProgram),
      get statePda(): PublicKey {
        throw new Error("State PDA is not specified");
      },
    } as unknown as BaseClient;

    await expect(
      BaseClient.prototype.fetchStateModel.call(client, explicitStatePda),
    ).resolves.toBe(expectedStateModel);

    expect(client.fetchStateAccount).toHaveBeenCalledWith(explicitStatePda);
    expect(derivedMintPubkey.equals(mintPubkey)).toBe(false);
    expect(fetchMintAndTokenProgram).toHaveBeenCalledTimes(1);
    expect(fetchMintAndTokenProgram).toHaveBeenCalledWith(
      client.provider.connection,
      mintPubkey,
    );
    expect(client.getMintProgramForStateAccount).toHaveBeenCalledWith(
      stateAccount,
    );
    expect(client.fetchRequestQueue).toHaveBeenCalledTimes(1);
    expect(client.fetchRequestQueue).toHaveBeenCalledWith(
      expectedRequestQueuePda,
      detachedMintProgram,
    );
    expect(fromOnchainAccountsSpy).toHaveBeenCalledWith(
      explicitStatePda,
      stateAccount,
      false,
      mint,
      requestQueue,
    );
  });

  it("resolves the glam mint program from the state ACLs", () => {
    const prodMintProgramId = getGlamMintProgramId(false);
    const stagingMintProgramId = getGlamMintProgramId(true);
    const client = {
      mintProgram: { programId: stagingMintProgramId },
    } as unknown as BaseClient;
    const stateAccount = {
      integrationAcls: [
        {
          integrationProgram: prodMintProgramId,
          protocolsBitmask: 1,
          protocolPolicies: [],
        },
      ],
    } as any;

    const resolvedProgramId = (BaseClient.prototype as any)
      .getMintProgramIdForStateAccount.call(client, stateAccount);

    expect(resolvedProgramId.toBase58()).toBe(prodMintProgramId.toBase58());
  });
});
