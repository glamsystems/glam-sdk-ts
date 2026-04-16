import fs from "fs";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import {
  KAMINO_LENDING_PROGRAM,
  KAMINO_VAULTS_PROGRAM,
  USDC,
} from "../../src/constants";
import {
  KVaultState,
  Obligation,
  Reserve,
} from "../../src/deser/kaminoLayouts";

const KAMINO_FIXTURE_DIR = path.resolve(
  __dirname,
  "../../fixtures/accounts/kamino",
);

type SolanaCliAccountDump = {
  pubkey: string;
  account: {
    owner: string;
    data: [string, "base64"];
  };
};

type FixtureDecoder<T> = {
  decode(address: PublicKey, buffer: Buffer): T;
};

type ReserveFixture = {
  fixtureName: string;
  reserveAddress: PublicKey;
  lendingMarket: PublicKey;
  mint: PublicKey;
  mintDecimals: number;
  farmDebtNullable: PublicKey | null;
  farmCollateralNullable: PublicKey | null;
};

function loadKaminoFixture<T>(
  fixtureName: string,
  expectedOwner: PublicKey,
  decoder: FixtureDecoder<T>,
): T {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(KAMINO_FIXTURE_DIR, `${fixtureName}.json`),
      "utf8",
    ),
  ) as SolanaCliAccountDump;
  const [base64, encoding] = raw.account.data;

  expect(encoding).toBe("base64");
  expect(raw.account.owner).toBe(expectedOwner.toBase58());

  return decoder.decode(
    new PublicKey(raw.pubkey),
    Buffer.from(base64, "base64"),
  );
}

function expectNullablePublicKey(
  actual: PublicKey | null,
  expected: PublicKey | null,
) {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }

  expect(actual?.equals(expected)).toBe(true);
}

function summarizeActiveDeposit({
  depositReserve,
  depositedAmount,
  marketValueSf,
  borrowedAmountAgainstThisCollateralInElevationGroup,
}: Obligation["activeDeposits"][number]) {
  return {
    depositReserve: depositReserve.toBase58(),
    depositedAmount: depositedAmount.toString(),
    marketValueSf: marketValueSf.toString(),
    borrowedAmountAgainstThisCollateralInElevationGroup:
      borrowedAmountAgainstThisCollateralInElevationGroup.toString(),
  };
}

function summarizeActiveBorrow({
  borrowReserve,
  borrowedAmountSf,
  marketValueSf,
  borrowFactorAdjustedMarketValueSf,
  borrowedAmountOutsideElevationGroups,
}: Obligation["activeBorrows"][number]) {
  return {
    borrowReserve: borrowReserve.toBase58(),
    borrowedAmountSf: borrowedAmountSf.toString(),
    marketValueSf: marketValueSf.toString(),
    borrowFactorAdjustedMarketValueSf:
      borrowFactorAdjustedMarketValueSf.toString(),
    borrowedAmountOutsideElevationGroups:
      borrowedAmountOutsideElevationGroups.toString(),
  };
}

function summarizeAllocation({
  reserve,
  ctokenVault,
  targetAllocationWeight,
  tokenAllocationCap,
  ctokenAllocation,
}: KVaultState["validAllocations"][number]) {
  return {
    reserve: reserve.toBase58(),
    ctokenVault: ctokenVault.toBase58(),
    targetAllocationWeight: targetAllocationWeight.toString(),
    tokenAllocationCap: tokenAllocationCap.toString(),
    ctokenAllocation: ctokenAllocation.toString(),
  };
}

const RESERVE_FIXTURES: ReserveFixture[] = [
  {
    fixtureName: "reserve_usdc_main_market",
    reserveAddress: new PublicKey(
      "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
    ),
    lendingMarket: new PublicKey(
      "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
    ),
    mint: USDC,
    mintDecimals: 6,
    farmDebtNullable: null,
    farmCollateralNullable: new PublicKey(
      "JAvnB9AKtgPsTEoKmn24Bq64UMoYcrtWtq42HHBdsPkh",
    ),
  },
  {
    fixtureName: "reserve_cbbtc_main_market",
    reserveAddress: new PublicKey(
      "37Jk2zkz23vkAYBT66HM2gaqJuNg2nYLsCreQAVt5MWK",
    ),
    lendingMarket: new PublicKey(
      "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
    ),
    mint: new PublicKey("cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij"),
    mintDecimals: 8,
    farmDebtNullable: null,
    farmCollateralNullable: new PublicKey(
      "9CinLHLAcMkzs4Ji8pwS2qwyz1LU46A4Ry7BNLGLubxs",
    ),
  },
  {
    fixtureName: "reserve_wsol_main_market",
    reserveAddress: new PublicKey(
      "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q",
    ),
    lendingMarket: new PublicKey(
      "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
    ),
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    mintDecimals: 9,
    farmDebtNullable: null,
    farmCollateralNullable: new PublicKey(
      "955xWFhSDcDiUgUr4sBRtCpTLiMd4H5uZLAmgtP3R3sX",
    ),
  },
  {
    fixtureName: "reserve_usdc_jlp_market",
    reserveAddress: new PublicKey(
      "Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp",
    ),
    lendingMarket: new PublicKey(
      "DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek",
    ),
    mint: USDC,
    mintDecimals: 6,
    farmDebtNullable: new PublicKey(
      "B7nzBEuViVtaQN8iEhhtBY4gQSxBY38ms31DUWUx1bza",
    ),
    farmCollateralNullable: new PublicKey(
      "EGDhupegCXLtonYDSY67c4dzw86S9eMxsntQ1yxWSoHv",
    ),
  },
  {
    fixtureName: "reserve_usdc_maple_market",
    reserveAddress: new PublicKey(
      "Atj6UREVWa7WxbF2EMKNyfmYUY1U1txughe2gjhcPDCo",
    ),
    lendingMarket: new PublicKey(
      "6WEGfej9B9wjxRs6t4BYpb9iCXd8CpTpJ8fVSNzHCC5y",
    ),
    mint: USDC,
    mintDecimals: 6,
    farmDebtNullable: null,
    farmCollateralNullable: new PublicKey(
      "6Y9fzrWzGZaxdAJ2eWRg9UZpL3kqPDiVXAb67KJpWdUg",
    ),
  },
];

describe("Kamino Reserve deserialization fixtures", () => {
  for (const fixture of RESERVE_FIXTURES) {
    describe(fixture.fixtureName, () => {
      const reserve = loadKaminoFixture<Reserve>(
        fixture.fixtureName,
        KAMINO_LENDING_PROGRAM,
        Reserve,
      );

      it("parses core Reserve fields", () => {
        expect(reserve.getAddress().equals(fixture.reserveAddress)).toBe(true);
        expect(reserve.lendingMarket.equals(fixture.lendingMarket)).toBe(true);
        expect(reserve.liquidity.mintPubkey.equals(fixture.mint)).toBe(true);
        expect(reserve.liquidity.mintDecimals.toNumber()).toBe(
          fixture.mintDecimals,
        );
        expectNullablePublicKey(
          reserve.farmDebtNullable,
          fixture.farmDebtNullable,
        );
        expectNullablePublicKey(
          reserve.farmCollateralNullable,
          fixture.farmCollateralNullable,
        );
      });

      it("liquidityFeeReceiver PDA uses ['fee_receiver', reserve_address]", () => {
        const [expected] = PublicKey.findProgramAddressSync(
          [Buffer.from("fee_receiver"), reserve.getAddress().toBuffer()],
          KAMINO_LENDING_PROGRAM,
        );

        expect(reserve.liquidityFeeReceiver.equals(expected)).toBe(true);
      });
    });
  }
});

describe("Kamino Obligation deserialization fixture", () => {
  const obligation = loadKaminoFixture<Obligation>(
    "obligation_main_market",
    KAMINO_LENDING_PROGRAM,
    Obligation,
  );

  it("parses active deposits and borrows", () => {
    expect(
      obligation
        .getAddress()
        .equals(new PublicKey("5iLEgayZ19eL6vGLEtELtCpYrGxZYGL4xEBsxMaYAfFz")),
    ).toBe(true);
    expect(
      obligation.lendingMarket.equals(
        new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"),
      ),
    ).toBe(true);
    expect(
      obligation.owner.equals(
        new PublicKey("2P5tkJVpceLPdnejvc5DBGd4RxkmtouYfNkb9KKPsPxW"),
      ),
    ).toBe(true);
    expect(obligation.deposits).toHaveLength(8);
    expect(obligation.borrows).toHaveLength(5);
    expect(obligation.activeDeposits).toHaveLength(2);
    expect(obligation.activeBorrows).toHaveLength(2);
    expect(obligation.hasDebt).toBe(1);
    expect(obligation.borrowingDisabled).toBe(0);

    expect(obligation.activeDeposits.map(summarizeActiveDeposit)).toEqual([
      {
        depositReserve: "febGYTnFX4GbSGoFHFeJXUHgNaK53fB23uDins9Jp1E",
        depositedAmount: "161714155",
        marketValueSf: "4865536768981623299343",
        borrowedAmountAgainstThisCollateralInElevationGroup: "0",
      },
      {
        depositReserve: "37Jk2zkz23vkAYBT66HM2gaqJuNg2nYLsCreQAVt5MWK",
        depositedAmount: "12131951",
        marketValueSf: "14820701531457048001214",
        borrowedAmountAgainstThisCollateralInElevationGroup: "0",
      },
    ]);

    expect(obligation.activeBorrows.map(summarizeActiveBorrow)).toEqual([
      {
        borrowReserve: "EGPE45iPkme8G8C1xFDNZoZeHdP3aRYtaAfAQuuwrcGZ",
        borrowedAmountSf: "6929318332280309242543496913",
        marketValueSf: "7990196691779691291846",
        borrowFactorAdjustedMarketValueSf: "9188726195546644982850",
        borrowedAmountOutsideElevationGroups: "6010225592",
      },
      {
        borrowReserve: "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
        borrowedAmountSf: "106994238384824015486021859",
        marketValueSf: "120668896842500494296",
        borrowFactorAdjustedMarketValueSf: "120668896842500494296",
        borrowedAmountOutsideElevationGroups: "92802709",
      },
    ]);
  });
});

describe("Kamino KVaultState deserialization fixture", () => {
  const vault = loadKaminoFixture<KVaultState>(
    "kVUSDC_vault_state",
    KAMINO_VAULTS_PROGRAM,
    KVaultState,
  );

  it("parses nameStr and filters valid allocations", () => {
    expect(
      vault
        .getAddress()
        .equals(new PublicKey("HDsayqAsDWy3QvANGqh2yNraqcD8Fnjgh73Mhb3WRS5E")),
    ).toBe(true);
    expect(vault.nameStr).toBe("USDC Max Yield");
    expect(vault.tokenMint.equals(USDC)).toBe(true);
    expect(
      vault.sharesMint.equals(
        new PublicKey("7D8C5pDFxug58L9zkwK7bCiDg4kD4AygzbcZUmf5usHS"),
      ),
    ).toBe(true);
    expect(vault.tokenMintDecimals.toNumber()).toBe(6);
    expect(vault.sharesMintDecimals.toNumber()).toBe(6);
    expect(vault.vaultAllocationStrategy).toHaveLength(25);
    expect(vault.validAllocations).toHaveLength(3);
    expect(
      vault.validAllocations.every(
        ({ reserve }) => !reserve.equals(PublicKey.default),
      ),
    ).toBe(true);
    expect(vault.validAllocations.map(summarizeAllocation)).toEqual([
      {
        reserve: "Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp",
        ctokenVault: "5rGkiF4Jf1rPTJ6nazBgcjewVktXhagwcw5Nux7GccRi",
        targetAllocationWeight: "48000",
        tokenAllocationCap: "18446744073709551615",
        ctokenAllocation: "2503422272193",
      },
      {
        reserve: "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
        ctokenVault: "CZg8x8oqB7FYUfURq15F5AcjRTymcXsc8ann76CrpJrf",
        targetAllocationWeight: "252000",
        tokenAllocationCap: "18446744073709551615",
        ctokenAllocation: "13145244757096",
      },
      {
        reserve: "Atj6UREVWa7WxbF2EMKNyfmYUY1U1txughe2gjhcPDCo",
        ctokenVault: "Hq8LJAn7scQSBCNysRtrRXuZYNvZ5MRpbqK7T3JyLYqc",
        targetAllocationWeight: "0",
        tokenAllocationCap: "1000000000000",
        ctokenAllocation: "0",
      },
    ]);
  });
});
