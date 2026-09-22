import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";

import { PriceClient } from "../../src/client/price";
import {
  LOOPSCALE_BORROW_PROTOCOL,
  LOOPSCALE_LENDING_PROTOCOL,
  LOOPSCALE_VAULT_PROTOCOL,
} from "../../src/protocols";
import { WSOL } from "../../src/constants";
import { StateAccountType } from "../../src/models";
import {
  EXT_PRICER_DISCRIMINATORS,
  PkMap,
  getGlobalConfigPda,
  getIntegrationAuthorityPda,
} from "../../src/utils";

const LOOPSCALE_PROTOCOLS =
  LOOPSCALE_BORROW_PROTOCOL |
  LOOPSCALE_LENDING_PROTOCOL |
  LOOPSCALE_VAULT_PROTOCOL;

function pk(seed: number): PublicKey {
  const bytes = new Uint8Array(32);
  bytes[31] = seed;
  return new PublicKey(bytes);
}

function ix(programId: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ keys: [], programId });
}

/** The keys of an ext-hosted pricer: the program's named accounts, then the remaining ones. */
function extPricerKeys(expected: {
  programId: PublicKey;
  statePda: PublicKey;
  vaultPda: PublicKey;
  solUsdOracle: PublicKey;
  baseAssetOracle: PublicKey;
  protocolProgramId: PublicKey;
  remaining: PublicKey[];
}) {
  return [
    { pubkey: expected.statePda, isSigner: false, isWritable: true },
    ...[
      expected.vaultPda,
      expected.solUsdOracle,
      expected.baseAssetOracle,
      getIntegrationAuthorityPda(expected.programId),
      getGlobalConfigPda(),
      expected.protocolProgramId,
      ...expected.remaining,
    ].map((pubkey) => ({ pubkey, isSigner: false, isWritable: false })),
  ];
}

function tokenAccountData(mint: PublicKey, amount: bigint): Buffer {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint,
      owner: pk(1),
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return data;
}

function createPriceClient(params: {
  externalPositions?: PublicKey[];
  loopscaleProtocolsBitmask?: number;
  jupiterApi?: any;
}) {
  const extLoopscaleProgramId = pk(41);
  const base = {
    fetchStateModel: jest.fn().mockResolvedValue({
      accountType: StateAccountType.VAULT,
      externalPositions: params.externalPositions ?? [pk(51)],
      integrationAcls: [
        {
          integrationProgram: extLoopscaleProgramId,
          protocolsBitmask: params.loopscaleProtocolsBitmask ?? 0,
        },
      ],
    }),
    fetchAssetMetas: jest.fn().mockResolvedValue(new Map()),
    extKaminoProgram: { programId: pk(42) },
    extLoopscaleProgram: { programId: extLoopscaleProgramId },
    extRpiProgram: { programId: pk(43) },
    protocolProgram: { programId: pk(44) },
    extBridgeProgram: { programId: pk(45) },
    extPhoenixProgram: { programId: pk(46) },
    extOrcaProgram: { programId: pk(47) },
    extNeutralProgram: { programId: pk(48) },
    extMarginfiProgram: { programId: pk(49) },
  } as any;

  const loopscaleBorrow = {
    getPriceLoansAccounts: jest.fn().mockResolvedValue(null),
  } as any;
  const loopscaleLend = {
    getPriceStrategiesAccounts: jest.fn().mockResolvedValue(null),
  } as any;
  const loopscaleVault = {
    getPriceVaultsAccounts: jest.fn().mockResolvedValue(null),
  } as any;
  const bridge = {
    txBuilder: {
      priceManagedTransfersIxs: jest.fn().mockResolvedValue(null),
    },
  } as any;

  const client = new PriceClient(
    base,
    {} as any,
    {} as any,
    bridge,
    {} as any,
    loopscaleBorrow,
    loopscaleLend,
    loopscaleVault,
    () => params.jupiterApi ?? ({} as any),
  );

  return {
    client,
    base,
    loopscaleBorrow,
    loopscaleLend,
    loopscaleVault,
    bridge,
  };
}

describe("PriceClient", () => {
  it("appends loopscale loan, strategy, and vault pricing when the loopscale ACL is enabled", async () => {
    const priceVaultIx = ix(pk(61));
    const priceLoansIx = ix(pk(62));
    const priceStrategiesIx = ix(pk(63));
    const priceLoopscaleVaultPositionsInstruction = ix(pk(64));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: LOOPSCALE_PROTOCOLS,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIxs")
      .mockResolvedValue({ ixs: [priceLoansIx], kaminoReserves: [] });
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIxs")
      .mockResolvedValue({ ixs: [priceStrategiesIx], kaminoReserves: [] });
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIxs")
      .mockResolvedValue({
        ixs: [priceLoopscaleVaultPositionsInstruction],
        kaminoReserves: [],
      });

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).toHaveBeenCalled();
    expect(ixs).toEqual([
      priceVaultIx,
      priceLoansIx,
      priceStrategiesIx,
      priceLoopscaleVaultPositionsInstruction,
    ]);
  });

  it("appends loopscale vault pricing when only the loopscale vault ACL is enabled", async () => {
    const priceVaultIx = ix(pk(65));
    const priceLoopscaleVaultPositionsInstruction = ix(pk(66));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: LOOPSCALE_VAULT_PROTOCOL,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIxs")
      .mockResolvedValue({ ixs: [ix(pk(67))], kaminoReserves: [] });
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIxs")
      .mockResolvedValue({ ixs: [ix(pk(68))], kaminoReserves: [] });
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIxs")
      .mockResolvedValue({
        ixs: [priceLoopscaleVaultPositionsInstruction],
        kaminoReserves: [],
      });

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).not.toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).not.toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).toHaveBeenCalled();
    expect(ixs).toEqual([
      priceVaultIx,
      priceLoopscaleVaultPositionsInstruction,
    ]);
  });

  it("skips loopscale loan pricing when the loopscale ACL is disabled", async () => {
    const priceVaultIx = ix(pk(71));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: 0,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIxs")
      .mockResolvedValue({ ixs: [ix(pk(72))], kaminoReserves: [] });
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIxs")
      .mockResolvedValue({ ixs: [ix(pk(73))], kaminoReserves: [] });
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIxs")
      .mockResolvedValue({ ixs: [ix(pk(74))], kaminoReserves: [] });

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).not.toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).not.toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).not.toHaveBeenCalled();
    expect(ixs).toEqual([priceVaultIx]);
  });

  it("keeps only vault pricing when loopscale pricing returns no instructions", async () => {
    const priceVaultIx = ix(pk(81));
    const { client } = createPriceClient({
      loopscaleProtocolsBitmask: LOOPSCALE_PROTOCOLS,
    });

    jest
      .spyOn(client, "priceVaultTokensIx")
      .mockResolvedValue({ ixs: [priceVaultIx], kaminoReserves: [] } as any);
    const priceLoopscaleLoansIx = jest
      .spyOn(client, "priceLoopscaleLoansIxs")
      .mockResolvedValue(null);
    const priceLoopscaleStrategiesIx = jest
      .spyOn(client, "priceLoopscaleStrategiesIxs")
      .mockResolvedValue(null);
    const priceLoopscaleVaultPositionsIx = jest
      .spyOn(client, "priceLoopscaleVaultPositionsIxs")
      .mockResolvedValue(null);

    const ixs = await client.priceVaultIxs();

    expect(priceLoopscaleLoansIx).toHaveBeenCalled();
    expect(priceLoopscaleStrategiesIx).toHaveBeenCalled();
    expect(priceLoopscaleVaultPositionsIx).toHaveBeenCalled();
    expect(ixs).toEqual([priceVaultIx]);
  });

  it("priceLoopscaleLoansIxs builds on the ext_loopscale program with ordered loan and oracle accounts", async () => {
    const statePda = pk(91);
    const solUsdOracle = pk(92);
    const baseAssetOracle = pk(93);
    const baseAssetMint = pk(90);
    const loanA = pk(94);
    const loanB = pk(95);
    const oracleA = pk(96);
    const oracleB = pk(97);
    const vaultPda = pk(89);
    const protocolProgramId = pk(88);

    const base = {
      statePda,
      vaultPda,
      protocolProgram: { programId: protocolProgramId },
      extLoopscaleProgram: { programId: pk(41) },
      fetchStateModel: jest.fn().mockResolvedValue({ baseAssetMint }),
      getAssetMeta: jest.fn(async (mint: PublicKey) =>
        mint.equals(WSOL)
          ? { oracle: solUsdOracle, oracleSource: "Pyth" }
          : { oracle: baseAssetOracle, oracleSource: "Pyth" },
      ),
    } as any;
    const loopscaleBorrow = {
      getPriceLoansAccounts: jest.fn().mockResolvedValue({
        loanAccounts: [loanA, loanB],
        oracleAccounts: [oracleA, oracleB],
      }),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleBorrow,
      {} as any,
      {} as any,
      () => ({}) as any,
    );
    const result = await client.priceLoopscaleLoansIxs();

    expect(result?.ixs).toHaveLength(1);
    expect(result?.kaminoReserves).toEqual([]);
    expect(loopscaleBorrow.getPriceLoansAccounts).toHaveBeenCalled();
    expect(base.getAssetMeta).toHaveBeenCalledWith(WSOL);
    const built = result!.ixs[0];
    expect(built.programId.equals(pk(41))).toBe(true);
    expect(built.data).toEqual(
      Buffer.from(EXT_PRICER_DISCRIMINATORS.price_loopscale_loans),
    );
    expect(built.keys).toEqual(
      extPricerKeys({
        programId: pk(41),
        statePda,
        vaultPda,
        solUsdOracle,
        baseAssetOracle,
        protocolProgramId,
        remaining: [loanA, loanB, oracleA, oracleB],
      }),
    );
  });

  it("priceLoopscaleLoansIxs returns null when there are no loopscale loans", async () => {
    const base = {
      statePda: pk(91),
      extLoopscaleProgram: { programId: pk(41) },
      getSolOracle: jest.fn(),
    } as any;
    const loopscaleBorrow = {
      getPriceLoansAccounts: jest.fn().mockResolvedValue(null),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleBorrow,
      {} as any,
      {} as any,
      () => ({}) as any,
    );

    expect(await client.priceLoopscaleLoansIxs()).toBeNull();
  });

  it("priceLoopscaleStrategiesIxs builds on the ext_loopscale program with ordered strategy and oracle accounts", async () => {
    const statePda = pk(101);
    const solUsdOracle = pk(102);
    const baseAssetOracle = pk(103);
    const baseAssetMint = pk(100);
    const strategyA = pk(104);
    const strategyB = pk(105);
    const oracleA = pk(106);
    const oracleB = pk(107);
    const vaultPda = pk(119);
    const protocolProgramId = pk(118);

    const base = {
      statePda,
      vaultPda,
      protocolProgram: { programId: protocolProgramId },
      extLoopscaleProgram: { programId: pk(41) },
      fetchStateModel: jest.fn().mockResolvedValue({ baseAssetMint }),
      getAssetMeta: jest.fn(async (mint: PublicKey) =>
        mint.equals(WSOL)
          ? { oracle: solUsdOracle, oracleSource: "Pyth" }
          : { oracle: baseAssetOracle, oracleSource: "Pyth" },
      ),
    } as any;
    const loopscaleLend = {
      getPriceStrategiesAccounts: jest.fn().mockResolvedValue({
        strategyAccounts: [strategyA, strategyB],
        oracleAccounts: [oracleA, oracleB],
      }),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleLend,
      {} as any,
      () => ({}) as any,
    );
    const result = await client.priceLoopscaleStrategiesIxs();

    expect(result?.ixs).toHaveLength(1);
    expect(result?.kaminoReserves).toEqual([]);
    expect(loopscaleLend.getPriceStrategiesAccounts).toHaveBeenCalled();
    expect(base.getAssetMeta).toHaveBeenCalledWith(WSOL);
    const built = result!.ixs[0];
    expect(built.programId.equals(pk(41))).toBe(true);
    expect(built.data).toEqual(
      Buffer.from(EXT_PRICER_DISCRIMINATORS.price_loopscale_strategies),
    );
    expect(built.keys).toEqual(
      extPricerKeys({
        programId: pk(41),
        statePda,
        vaultPda,
        solUsdOracle,
        baseAssetOracle,
        protocolProgramId,
        remaining: [strategyA, strategyB, oracleA, oracleB],
      }),
    );
  });

  it("priceLoopscaleStrategiesIxs returns null when there are no loopscale strategies", async () => {
    const base = {
      statePda: pk(111),
      extLoopscaleProgram: { programId: pk(41) },
      getSolOracle: jest.fn(),
    } as any;
    const loopscaleLend = {
      getPriceStrategiesAccounts: jest.fn().mockResolvedValue(null),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleLend,
      {} as any,
      () => ({}) as any,
    );

    expect(await client.priceLoopscaleStrategiesIxs()).toBeNull();
  });

  it("priceLoopscaleVaultPositionsIxs builds on the ext_loopscale program with ordered vault, stake, and oracle accounts", async () => {
    const statePda = pk(121);
    const solUsdOracle = pk(122);
    const baseAssetOracle = pk(123);
    const baseAssetMint = pk(120);
    const vaultA = pk(124);
    const vaultB = pk(125);
    const strategyA = pk(126);
    const strategyB = pk(127);
    const userLpA = pk(128);
    const userLpB = pk(129);
    const stakeA = pk(130);
    const oracleA = pk(131);
    const vaultPda = pk(139);
    const protocolProgramId = pk(138);

    const base = {
      statePda,
      vaultPda,
      protocolProgram: { programId: protocolProgramId },
      extLoopscaleProgram: { programId: pk(41) },
      fetchStateModel: jest.fn().mockResolvedValue({ baseAssetMint }),
      getAssetMeta: jest.fn(async (mint: PublicKey) =>
        mint.equals(WSOL)
          ? { oracle: solUsdOracle, oracleSource: "Pyth" }
          : { oracle: baseAssetOracle, oracleSource: "Pyth" },
      ),
    } as any;
    const loopscaleVault = {
      getPriceVaultsAccounts: jest.fn().mockResolvedValue({
        numVaults: 2,
        vaultAccounts: [vaultA, vaultB],
        strategyAccounts: [strategyA, strategyB],
        userLpTokenAccounts: [userLpA, userLpB],
        vaultStakeAccounts: [stakeA],
        oracleAccounts: [oracleA],
      }),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleVault,
      () => ({}) as any,
    );
    const result = await client.priceLoopscaleVaultPositionsIxs();

    expect(result?.ixs).toHaveLength(1);
    expect(result?.kaminoReserves).toEqual([]);
    expect(loopscaleVault.getPriceVaultsAccounts).toHaveBeenCalled();
    const built = result!.ixs[0];
    expect(built.programId.equals(pk(41))).toBe(true);
    // num_vaults follows the discriminator.
    expect(built.data).toEqual(
      Buffer.from([
        ...EXT_PRICER_DISCRIMINATORS.price_loopscale_vault_positions,
        2,
      ]),
    );
    expect(built.keys).toEqual(
      extPricerKeys({
        programId: pk(41),
        statePda,
        vaultPda,
        solUsdOracle,
        baseAssetOracle,
        protocolProgramId,
        remaining: [
          vaultA,
          strategyA,
          userLpA,
          vaultB,
          strategyB,
          userLpB,
          stakeA,
          oracleA,
        ],
      }),
    );
  });

  it("priceLoopscaleVaultPositionsIxs returns null when there are no loopscale vault LP tokens", async () => {
    const base = {
      statePda: pk(133),
      extLoopscaleProgram: { programId: pk(41) },
      getSolOracle: jest.fn(),
    } as any;
    const loopscaleVault = {
      getPriceVaultsAccounts: jest.fn().mockResolvedValue(null),
    } as any;

    const client = new PriceClient(
      base,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      loopscaleVault,
      () => ({}) as any,
    );

    expect(await client.priceLoopscaleVaultPositionsIxs()).toBeNull();
  });

  it("uses mint account decimals when token price fallback is unavailable", async () => {
    const mint = pk(131);
    const tokenAccount = pk(132);
    const { client } = createPriceClient({
      jupiterApi: {
        fetchTokenPrices: jest
          .fn()
          .mockRejectedValue(new Error("network down")),
      },
    });

    const accountsDataMap = new PkMap<Buffer>([
      [tokenAccount, tokenAccountData(mint, 123_456_789n)],
    ]);
    const tokenPricesMap = new PkMap<any>();
    const tokenMintDecimalsMap = new PkMap<number>([[mint, 6]]);

    const holdings = await client.getTokenHoldings(
      [tokenAccount],
      accountsDataMap,
      tokenPricesMap,
      tokenMintDecimalsMap,
      "Jupiter",
    );

    expect(holdings).toHaveLength(1);
    expect(holdings[0].mintAddress.equals(mint)).toBe(true);
    expect(holdings[0].decimals).toBe(6);
    expect(holdings[0].uiAmount).toBe(123.456789);
    expect(holdings[0].price).toBe(0);
  });
});
