import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { EpiClient, parseWormholeSignedVaa } from "../../src/client/epi";
import { USDC } from "../../src/constants";

const EXT_EPI_PROGRAM = PublicKey.unique();
const STATE = PublicKey.unique();
const SIGNER = PublicKey.unique();

function makeSignedVaa(signatureCount = 2, guardianSetIndex = 7) {
  const body = Buffer.alloc(241, 0xab);
  const signedVaa = Buffer.alloc(6 + signatureCount * 66 + body.length);
  signedVaa[0] = 1;
  signedVaa.writeUInt32BE(guardianSetIndex, 1);
  signedVaa[5] = signatureCount;
  for (let i = 0; i < signatureCount; i++) {
    signedVaa[6 + i * 66] = i;
  }
  body.copy(signedVaa, 6 + signatureCount * 66);
  return { signedVaa, body };
}

function methodBuilder(instruction: TransactionInstruction) {
  const builder: {
    accountsPartial: jest.Mock;
    remainingAccounts: jest.Mock;
    instruction: jest.Mock;
  } = {
    accountsPartial: jest.fn(() => builder),
    remainingAccounts: jest.fn(() => builder),
    instruction: jest.fn(async () => instruction),
  };
  return builder;
}

describe("EPI Wormhole SDK helpers", () => {
  it("parses signed VAAs into guardian signatures and body", () => {
    const { signedVaa, body } = makeSignedVaa(2, 11);

    const parsed = parseWormholeSignedVaa(signedVaa);

    expect(parsed.version).toBe(1);
    expect(parsed.guardianSetIndex).toBe(11);
    expect(parsed.signatures).toHaveLength(2);
    expect(parsed.signatures[0]).toHaveLength(66);
    expect(parsed.vaaBody.equals(body)).toBe(true);
  });

  it("builds Wormhole submit without a caller-supplied NAV value", async () => {
    const { signedVaa, body } = makeSignedVaa(1, 3);
    const positionId = Buffer.alloc(32, 9);
    const submitBuilder = methodBuilder(
      new TransactionInstruction({
        programId: EXT_EPI_PROGRAM,
        keys: [],
        data: Buffer.alloc(0),
      }),
    );
    const submitMethod = jest.fn(() => submitBuilder);
    const client = new EpiClient({
      statePda: STATE,
      signer: SIGNER,
      extEpiProgram: {
        programId: EXT_EPI_PROGRAM,
        methods: {
          submitExternalObservationWormhole: submitMethod,
        },
      },
    } as any);

    await client.txBuilder.submitExternalObservationWormholeIx(
      {
        positionId,
        signedVaa,
      },
      PublicKey.unique(),
    );

    expect(submitMethod).toHaveBeenCalledTimes(1);
    const call = submitMethod.mock.calls[0] as any[];
    expect(call).toHaveLength(3);
    expect(call[0]).toEqual(Array.from(positionId));
    expect(typeof call[1]).toBe("number");
    expect(call[2].equals(body)).toBe(true);
    expect(submitBuilder.accountsPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        glamState: STATE,
        glamSigner: SIGNER,
      }),
    );
    expect(submitBuilder.accountsPartial.mock.calls[0][0]).not.toHaveProperty(
      "submitter",
    );
    expect(submitBuilder.remainingAccounts).toHaveBeenCalledTimes(1);
    expect(submitBuilder.remainingAccounts.mock.calls[0][0]).toHaveLength(1);
  });

  it("resolves oracle accounts for USD observations even with USDC base asset", async () => {
    const positionId = Buffer.alloc(32, 4);
    const solUsdOracle = PublicKey.unique();
    const baseAssetOracle = PublicKey.unique();
    const getAssetMeta = jest.fn(async () => ({ oracle: baseAssetOracle }));
    const client = new EpiClient({
      statePda: STATE,
      signer: SIGNER,
      extEpiProgram: {
        programId: EXT_EPI_PROGRAM,
        account: {
          observationState: {
            fetchNullable: jest.fn(async () => ({
              positionsLen: 1,
              positions: [
                {
                  positionId: Array.from(positionId),
                  hasPending: true,
                  pendingObservation: {
                    denomination: {
                      denom: { usd: {} },
                      mint: PublicKey.default,
                    },
                  },
                },
              ],
            })),
          },
        },
      },
      fetchStateAccount: jest.fn(async () => ({
        baseAssetMint: USDC,
        baseAssetDecimals: 6,
      })),
      getSolOracle: jest.fn(async () => solUsdOracle),
      getAssetMeta,
    } as any);

    const accounts = await client.resolveValidateExternalObservationAccounts({
      positionId,
    });

    expect(accounts.glamConfig).toBeTruthy();
    expect(accounts.solUsdOracle).toBe(solUsdOracle);
    expect(accounts.baseAssetOracle).toBe(baseAssetOracle);
    expect(accounts.remainingAccounts).toHaveLength(0);
    expect(getAssetMeta).toHaveBeenCalledWith(USDC);
  });
});
