import { BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { RpiClient, parseWormholeSignedVaa } from "../../src/client/rpi";
import { USDC } from "../../src/constants";

const EXT_RPI_PROGRAM = PublicKey.unique();
const STATE = PublicKey.unique();
const SIGNER = PublicKey.unique();
const VAULT = PublicKey.unique();
const GLAM_PROTOCOL = PublicKey.unique();

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

describe("RPI Wormhole SDK helpers", () => {
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
        programId: EXT_RPI_PROGRAM,
        keys: [],
        data: Buffer.alloc(0),
      }),
    );
    const submitMethod = jest.fn(() => submitBuilder);
    const client = new RpiClient({
      statePda: STATE,
      signer: SIGNER,
      extRpiProgram: {
        programId: EXT_RPI_PROGRAM,
        methods: {
          submitObservationWormhole: submitMethod,
        },
      },
    } as any);
    const observationState = client.getObservationStatePda();

    await client.txBuilder.submitObservationWormholeIx(
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
        observationState,
      }),
    );
    expect(submitBuilder.accountsPartial.mock.calls[0][0]).not.toHaveProperty(
      "submitter",
    );
    expect(submitBuilder.remainingAccounts).toHaveBeenCalledTimes(1);
    expect(submitBuilder.remainingAccounts.mock.calls[0][0]).toHaveLength(1);
  });

  it("passes the vault observation state to core RPI instruction builders", async () => {
    const instruction = new TransactionInstruction({
      programId: EXT_RPI_PROGRAM,
      keys: [],
      data: Buffer.alloc(0),
    });
    const upsertBuilder = methodBuilder(instruction);
    const submitBuilder = methodBuilder(instruction);
    const validateBuilder = methodBuilder(instruction);
    const removeBuilder = methodBuilder(instruction);
    const client = new RpiClient({
      statePda: STATE,
      signer: SIGNER,
      vaultPda: VAULT,
      protocolProgram: { programId: GLAM_PROTOCOL },
      extRpiProgram: {
        programId: EXT_RPI_PROGRAM,
        methods: {
          upsertRegisteredPosition: jest.fn(() => upsertBuilder),
          submitObservation: jest.fn(() => submitBuilder),
          validateObservation: jest.fn(() => validateBuilder),
          removeRegisteredPosition: jest.fn(() => removeBuilder),
        },
        account: {
          observationState: {
            fetchNullable: jest.fn(async () => null),
          },
        },
      },
    } as any);
    jest
      .spyOn(client.txBuilder as any, "buildVersionedTx")
      .mockResolvedValue({} as any);

    const positionId = Buffer.alloc(32, 6);
    const observationState = client.getObservationStatePda();
    const integrationAuthority = client.getIntegrationAuthorityPda();

    await client.txBuilder.upsertRegisteredPositionIx({
      positionId,
      positionType: { valued: {} },
      sourceType: { trusted: {} },
      denomination: { denom: { usd: {} }, mint: PublicKey.default },
    });
    await client.txBuilder.submitObservationIx({
      positionId,
      amount: new BN(1),
      denomination: { denom: { usd: {} }, mint: PublicKey.default },
      observationTimestamp: new BN(1),
    });
    await client.txBuilder.validateObservationIx(positionId);
    await client.txBuilder.removeRegisteredPositionTx(positionId);

    expect(upsertBuilder.accountsPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        observationState,
        integrationAuthority,
      }),
    );
    expect(submitBuilder.accountsPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        observationState,
      }),
    );
    expect(validateBuilder.accountsPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        observationState,
      }),
    );
    expect(removeBuilder.accountsPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        observationState,
        integrationAuthority,
      }),
    );
  });

  it("resolves oracle accounts for USD observations even with USDC base asset", async () => {
    const positionId = Buffer.alloc(32, 4);
    const solUsdOracle = PublicKey.unique();
    const baseAssetOracle = PublicKey.unique();
    const getAssetMeta = jest.fn(async () => ({
      oracle: baseAssetOracle,
      oracleSource: "KaminoReserve",
    }));
    const client = new RpiClient({
      statePda: STATE,
      signer: SIGNER,
      extRpiProgram: {
        programId: EXT_RPI_PROGRAM,
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

    const accounts = await client.resolveValidateObservationAccounts({
      positionId,
    });

    expect(accounts.glamConfig).toBeTruthy();
    expect(accounts.solUsdOracle).toBe(solUsdOracle);
    expect(accounts.baseAssetOracle).toBe(baseAssetOracle);
    expect(accounts.remainingAccounts).toHaveLength(0);
    expect(accounts.kaminoReservesToRefresh).toEqual([baseAssetOracle]);
    expect(getAssetMeta).toHaveBeenCalledWith(USDC);
  });
});
