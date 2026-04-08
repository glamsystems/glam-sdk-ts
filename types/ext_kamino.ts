/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_kamino.json`.
 */
export type ExtKamino = {
  "address": "G1NTkDEUR3pkEqGCKZtmtmVzCUEdYa86pezHkwYbLyde",
  "metadata": {
    "name": "extKamino",
    "version": "1.0.1",
    "spec": "0.1.0",
    "description": "Kamino integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "farmsHarvestReward",
      "discriminator": [
        244,
        248,
        124,
        210,
        194,
        52,
        75,
        152
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "userState",
          "writable": true
        },
        {
          "name": "farmState",
          "writable": true
        },
        {
          "name": "globalConfig"
        },
        {
          "name": "rewardMint"
        },
        {
          "name": "userRewardAta",
          "writable": true
        },
        {
          "name": "rewardsVault",
          "writable": true
        },
        {
          "name": "rewardsTreasuryVault",
          "writable": true
        },
        {
          "name": "farmVaultsAuthority"
        },
        {
          "name": "scopePrices",
          "optional": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "rewardIndex",
          "type": "u64"
        }
      ]
    },
    {
      "name": "farmsInitializeUser",
      "discriminator": [
        188,
        148,
        82,
        37,
        44,
        46,
        162,
        34
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "userState",
          "writable": true
        },
        {
          "name": "farmState",
          "writable": true
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "farmsStake",
      "discriminator": [
        224,
        105,
        208,
        179,
        98,
        200,
        213,
        238
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "userState",
          "writable": true
        },
        {
          "name": "farmState",
          "writable": true
        },
        {
          "name": "farmVault",
          "writable": true
        },
        {
          "name": "userAta",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "scopePrices",
          "optional": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "farmsUnstake",
      "discriminator": [
        180,
        131,
        50,
        144,
        26,
        242,
        175,
        242
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "userState",
          "writable": true
        },
        {
          "name": "farmState",
          "writable": true
        },
        {
          "name": "scopePrices",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u128"
        }
      ]
    },
    {
      "name": "farmsWithdrawUnstakedDeposits",
      "discriminator": [
        107,
        97,
        50,
        15,
        211,
        245,
        52,
        96
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "userState",
          "writable": true
        },
        {
          "name": "farmState",
          "writable": true
        },
        {
          "name": "userAta",
          "writable": true
        },
        {
          "name": "farmVault",
          "writable": true
        },
        {
          "name": "farmVaultsAuthority"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "lendingBorrowObligationLiquidityV2",
      "discriminator": [
        149,
        226,
        84,
        157,
        124,
        178,
        35,
        122
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "borrowReserve",
          "writable": true
        },
        {
          "name": "borrowReserveLiquidityMint"
        },
        {
          "name": "reserveSourceLiquidity",
          "writable": true
        },
        {
          "name": "borrowReserveLiquidityFeeReceiver",
          "writable": true
        },
        {
          "name": "userDestinationLiquidity",
          "writable": true
        },
        {
          "name": "referrerTokenState",
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "obligationFarmUserState",
          "writable": true,
          "optional": true
        },
        {
          "name": "reserveFarmState",
          "writable": true,
          "optional": true
        },
        {
          "name": "farmsProgram"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lendingDepositReserveLiquidityAndObligationCollateralV2",
      "discriminator": [
        33,
        146,
        50,
        121,
        127,
        94,
        92,
        192
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "reserveDestinationDepositCollateral",
          "writable": true
        },
        {
          "name": "userSourceLiquidity",
          "writable": true
        },
        {
          "name": "placeholderUserDestinationCollateral",
          "optional": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "obligationFarmUserState",
          "writable": true,
          "optional": true
        },
        {
          "name": "reserveFarmState",
          "writable": true,
          "optional": true
        },
        {
          "name": "farmsProgram"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lendingInitObligation",
      "discriminator": [
        188,
        161,
        62,
        142,
        106,
        232,
        77,
        135
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "feePayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "seed1Account"
        },
        {
          "name": "seed2Account"
        },
        {
          "name": "ownerUserMetadata"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initObligationArgs"
            }
          }
        }
      ]
    },
    {
      "name": "lendingInitObligationFarmsForReserve",
      "discriminator": [
        3,
        234,
        110,
        39,
        12,
        147,
        175,
        185
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "reserve",
          "writable": true
        },
        {
          "name": "reserveFarmState",
          "writable": true
        },
        {
          "name": "obligationFarm",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "farmsProgram"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "mode",
          "type": "u8"
        }
      ]
    },
    {
      "name": "lendingInitUserMetadata",
      "discriminator": [
        68,
        236,
        138,
        146,
        124,
        228,
        247,
        241
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "feePayer",
          "writable": true,
          "signer": true
        },
        {
          "name": "userMetadata",
          "writable": true
        },
        {
          "name": "referrerUserMetadata",
          "optional": true
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "userLookupTable",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "lendingLiquidateObligationAndRedeemReserveCollateralV2",
      "discriminator": [
        179,
        45,
        146,
        167,
        246,
        239,
        18,
        242
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "repayReserve",
          "writable": true
        },
        {
          "name": "repayReserveLiquidityMint"
        },
        {
          "name": "repayReserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "withdrawReserve",
          "writable": true
        },
        {
          "name": "withdrawReserveLiquidityMint"
        },
        {
          "name": "withdrawReserveCollateralMint",
          "writable": true
        },
        {
          "name": "withdrawReserveCollateralSupply",
          "writable": true
        },
        {
          "name": "withdrawReserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "withdrawReserveLiquidityFeeReceiver",
          "writable": true
        },
        {
          "name": "userSourceLiquidity",
          "writable": true
        },
        {
          "name": "userDestinationCollateral",
          "writable": true
        },
        {
          "name": "userDestinationLiquidity",
          "writable": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "repayLiquidityTokenProgram"
        },
        {
          "name": "withdrawLiquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "collateralObligationFarmUserState",
          "writable": true,
          "optional": true
        },
        {
          "name": "collateralReserveFarmState",
          "writable": true,
          "optional": true
        },
        {
          "name": "debtObligationFarmUserState",
          "writable": true,
          "optional": true
        },
        {
          "name": "debtReserveFarmState",
          "writable": true,
          "optional": true
        },
        {
          "name": "farmsProgram"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        },
        {
          "name": "minAcceptableReceivedLiquidityAmount",
          "type": "u64"
        },
        {
          "name": "maxAllowedLtvOverridePercent",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lendingRepayObligationLiquidityV2",
      "discriminator": [
        79,
        34,
        126,
        170,
        174,
        156,
        174,
        29
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "repayReserve",
          "writable": true
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveDestinationLiquidity",
          "writable": true
        },
        {
          "name": "userSourceLiquidity",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "obligationFarmUserState",
          "writable": true,
          "optional": true
        },
        {
          "name": "reserveFarmState",
          "writable": true,
          "optional": true
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "farmsProgram"
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "lendingRequestElevationGroup",
      "discriminator": [
        162,
        119,
        197,
        54,
        246,
        84,
        55,
        153
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        }
      ],
      "args": [
        {
          "name": "elevationGroup",
          "type": "u8"
        }
      ]
    },
    {
      "name": "lendingWithdrawObligationCollateralAndRedeemReserveCollateralV2",
      "discriminator": [
        217,
        223,
        173,
        35,
        64,
        225,
        161,
        222
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "obligation",
          "writable": true
        },
        {
          "name": "lendingMarket"
        },
        {
          "name": "lendingMarketAuthority"
        },
        {
          "name": "withdrawReserve",
          "writable": true
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveSourceCollateral",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "userDestinationLiquidity",
          "writable": true
        },
        {
          "name": "placeholderUserDestinationCollateral",
          "optional": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "obligationFarmUserState",
          "writable": true,
          "optional": true
        },
        {
          "name": "reserveFarmState",
          "writable": true,
          "optional": true
        },
        {
          "name": "farmsProgram"
        }
      ],
      "args": [
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setLendingPolicy",
      "discriminator": [
        226,
        185,
        23,
        3,
        113,
        88,
        118,
        176
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        }
      ],
      "args": [
        {
          "name": "policy",
          "type": {
            "defined": {
              "name": "lendingPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "setVaultsPolicy",
      "discriminator": [
        211,
        177,
        22,
        152,
        235,
        59,
        192,
        62
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        }
      ],
      "args": [
        {
          "name": "policy",
          "type": {
            "defined": {
              "name": "vaultsPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "vaultsDeposit",
      "discriminator": [
        124,
        173,
        191,
        223,
        48,
        26,
        84,
        84
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KvauGMspG5k6rtzrqqn7WNn3oZdyKqLKwK2XWQ8FLjd"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "vaultState",
          "writable": true
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "baseVaultAuthority"
        },
        {
          "name": "sharesMint",
          "writable": true
        },
        {
          "name": "userTokenAta",
          "writable": true
        },
        {
          "name": "userSharesAta",
          "writable": true
        },
        {
          "name": "klendProgram"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "sharesTokenProgram"
        },
        {
          "name": "eventAuthority"
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "maxAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "vaultsWithdraw",
      "discriminator": [
        12,
        8,
        236,
        92,
        134,
        144,
        196,
        87
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ],
            "program": {
              "kind": "account",
              "path": "glamProtocolProgram"
            }
          }
        },
        {
          "name": "glamSigner",
          "writable": true,
          "signer": true
        },
        {
          "name": "integrationAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  105,
                  110,
                  116,
                  101,
                  103,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "cpiProgram",
          "address": "KvauGMspG5k6rtzrqqn7WNn3oZdyKqLKwK2XWQ8FLjd"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "withdrawFromAvailableVaultState",
          "writable": true
        },
        {
          "name": "withdrawFromAvailableGlobalConfig"
        },
        {
          "name": "withdrawFromAvailableTokenVault",
          "writable": true
        },
        {
          "name": "withdrawFromAvailableBaseVaultAuthority"
        },
        {
          "name": "withdrawFromAvailableUserTokenAta",
          "writable": true
        },
        {
          "name": "withdrawFromAvailableTokenMint",
          "writable": true
        },
        {
          "name": "withdrawFromAvailableUserSharesAta",
          "writable": true
        },
        {
          "name": "withdrawFromAvailableSharesMint",
          "writable": true
        },
        {
          "name": "withdrawFromAvailableTokenProgram"
        },
        {
          "name": "withdrawFromAvailableSharesTokenProgram"
        },
        {
          "name": "withdrawFromAvailableKlendProgram"
        },
        {
          "name": "withdrawFromAvailableEventAuthority"
        },
        {
          "name": "withdrawFromAvailableProgram"
        },
        {
          "name": "withdrawFromReserveVaultState",
          "writable": true
        },
        {
          "name": "withdrawFromReserveReserve",
          "writable": true
        },
        {
          "name": "withdrawFromReserveCtokenVault",
          "writable": true
        },
        {
          "name": "withdrawFromReserveLendingMarket"
        },
        {
          "name": "withdrawFromReserveLendingMarketAuthority"
        },
        {
          "name": "withdrawFromReserveReserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "withdrawFromReserveReserveCollateralMint",
          "writable": true
        },
        {
          "name": "withdrawFromReserveReserveCollateralTokenProgram"
        },
        {
          "name": "withdrawFromReserveInstructionSysvarAccount"
        },
        {
          "name": "eventAuthority"
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "sharesAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "stateAccount",
      "discriminator": [
        142,
        247,
        54,
        95,
        85,
        133,
        249,
        103
      ]
    }
  ],
  "types": [
    {
      "name": "accountType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "vault"
          },
          {
            "name": "tokenizedVault"
          },
          {
            "name": "mint"
          },
          {
            "name": "singleAssetVault"
          }
        ]
      }
    },
    {
      "name": "accruedFees",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaultSubscriptionFee",
            "type": "u128"
          },
          {
            "name": "vaultRedemptionFee",
            "type": "u128"
          },
          {
            "name": "managerSubscriptionFee",
            "type": "u128"
          },
          {
            "name": "managerRedemptionFee",
            "type": "u128"
          },
          {
            "name": "managementFee",
            "type": "u128"
          },
          {
            "name": "performanceFee",
            "type": "u128"
          },
          {
            "name": "protocolBaseFee",
            "type": "u128"
          },
          {
            "name": "protocolFlowFee",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "createdModel",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "createdBy",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "delegateAcl",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pubkey",
            "type": "pubkey"
          },
          {
            "name": "integrationPermissions",
            "type": {
              "vec": {
                "defined": {
                  "name": "integrationPermissions"
                }
              }
            }
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "engineField",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": {
              "defined": {
                "name": "engineFieldName"
              }
            }
          },
          {
            "name": "value",
            "type": {
              "defined": {
                "name": "engineFieldValue"
              }
            }
          }
        ]
      }
    },
    {
      "name": "engineFieldName",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "owner"
          },
          {
            "name": "portfolioManagerName"
          },
          {
            "name": "name"
          },
          {
            "name": "uri"
          },
          {
            "name": "assets"
          },
          {
            "name": "delegateAcls"
          },
          {
            "name": "integrationAcls"
          },
          {
            "name": "timelockDuration"
          },
          {
            "name": "borrowable"
          },
          {
            "name": "defaultAccountStateFrozen"
          },
          {
            "name": "permanentDelegate"
          },
          {
            "name": "notifyAndSettle"
          },
          {
            "name": "feeStructure"
          },
          {
            "name": "feeParams"
          },
          {
            "name": "claimableFees"
          },
          {
            "name": "claimedFees"
          },
          {
            "name": "oracleConfigs"
          }
        ]
      }
    },
    {
      "name": "engineFieldValue",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "boolean",
            "fields": [
              {
                "name": "val",
                "type": "bool"
              }
            ]
          },
          {
            "name": "u8",
            "fields": [
              {
                "name": "val",
                "type": "u8"
              }
            ]
          },
          {
            "name": "u32",
            "fields": [
              {
                "name": "val",
                "type": "u32"
              }
            ]
          },
          {
            "name": "u64",
            "fields": [
              {
                "name": "val",
                "type": "u64"
              }
            ]
          },
          {
            "name": "string",
            "fields": [
              {
                "name": "val",
                "type": "string"
              }
            ]
          },
          {
            "name": "pubkey",
            "fields": [
              {
                "name": "val",
                "type": "pubkey"
              }
            ]
          },
          {
            "name": "vecPubkey",
            "fields": [
              {
                "name": "val",
                "type": {
                  "vec": "pubkey"
                }
              }
            ]
          },
          {
            "name": "vecU8",
            "fields": [
              {
                "name": "val",
                "type": "bytes"
              }
            ]
          },
          {
            "name": "vecU32",
            "fields": [
              {
                "name": "val",
                "type": {
                  "vec": "u32"
                }
              }
            ]
          },
          {
            "name": "vecDelegateAcl",
            "fields": [
              {
                "name": "val",
                "type": {
                  "vec": {
                    "defined": {
                      "name": "delegateAcl"
                    }
                  }
                }
              }
            ]
          },
          {
            "name": "vecIntegrationAcl",
            "fields": [
              {
                "name": "val",
                "type": {
                  "vec": {
                    "defined": {
                      "name": "integrationAcl"
                    }
                  }
                }
              }
            ]
          },
          {
            "name": "feeStructure",
            "fields": [
              {
                "name": "val",
                "type": {
                  "defined": {
                    "name": "feeStructure"
                  }
                }
              }
            ]
          },
          {
            "name": "feeParams",
            "fields": [
              {
                "name": "val",
                "type": {
                  "defined": {
                    "name": "feeParams"
                  }
                }
              }
            ]
          },
          {
            "name": "accruedFees",
            "fields": [
              {
                "name": "val",
                "type": {
                  "defined": {
                    "name": "accruedFees"
                  }
                }
              }
            ]
          },
          {
            "name": "notifyAndSettle",
            "fields": [
              {
                "name": "val",
                "type": {
                  "defined": {
                    "name": "notifyAndSettle"
                  }
                }
              }
            ]
          },
          {
            "name": "oracleConfigs",
            "fields": [
              {
                "name": "val",
                "type": {
                  "defined": {
                    "name": "oracleConfigs"
                  }
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "entryExitFees",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subscriptionFeeBps",
            "type": "u16"
          },
          {
            "name": "redemptionFeeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "feeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "yearInSeconds",
            "type": "u32"
          },
          {
            "name": "paHighWaterMark",
            "type": "i128"
          },
          {
            "name": "paLastNav",
            "type": "i128"
          },
          {
            "name": "lastAum",
            "type": "i128"
          },
          {
            "name": "lastPerformanceFeeCrystallized",
            "type": "i64"
          },
          {
            "name": "lastManagementFeeCrystallized",
            "type": "i64"
          },
          {
            "name": "lastProtocolFeeCrystallized",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feeStructure",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": {
              "defined": {
                "name": "entryExitFees"
              }
            }
          },
          {
            "name": "manager",
            "type": {
              "defined": {
                "name": "entryExitFees"
              }
            }
          },
          {
            "name": "management",
            "type": {
              "defined": {
                "name": "managementFee"
              }
            }
          },
          {
            "name": "performance",
            "type": {
              "defined": {
                "name": "performanceFee"
              }
            }
          },
          {
            "name": "protocol",
            "type": {
              "defined": {
                "name": "protocolFees"
              }
            }
          }
        ]
      }
    },
    {
      "name": "hurdleType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "hard"
          },
          {
            "name": "soft"
          }
        ]
      }
    },
    {
      "name": "initObligationArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tag",
            "type": "u8"
          },
          {
            "name": "id",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "integrationAcl",
      "docs": [
        "An integration program can have multiple protocols supported.",
        "Enabled protocols are stored in a bitmask, and each protocol can have its own policy."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "integrationProgram",
            "type": "pubkey"
          },
          {
            "name": "protocolsBitmask",
            "type": "u16"
          },
          {
            "name": "protocolPolicies",
            "type": {
              "vec": {
                "defined": {
                  "name": "protocolPolicy"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "integrationPermissions",
      "docs": [
        "Stores delegate permissions for an integration program."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "integrationProgram",
            "type": "pubkey"
          },
          {
            "name": "protocolPermissions",
            "type": {
              "vec": {
                "defined": {
                  "name": "protocolPermissions"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "lendingPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketsAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "borrowAllowlist",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "managementFee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "noticePeriodType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "hard"
          },
          {
            "name": "soft"
          }
        ]
      }
    },
    {
      "name": "notifyAndSettle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "model",
            "type": {
              "defined": {
                "name": "valuationModel"
              }
            }
          },
          {
            "name": "permissionlessFulfillment",
            "type": "bool"
          },
          {
            "name": "subscribeNoticePeriodType",
            "type": {
              "defined": {
                "name": "noticePeriodType"
              }
            }
          },
          {
            "name": "subscribeNoticePeriod",
            "type": "u64"
          },
          {
            "name": "subscribeSettlementPeriod",
            "type": "u64"
          },
          {
            "name": "subscribeCancellationWindow",
            "type": "u64"
          },
          {
            "name": "redeemNoticePeriodType",
            "type": {
              "defined": {
                "name": "noticePeriodType"
              }
            }
          },
          {
            "name": "redeemNoticePeriod",
            "type": "u64"
          },
          {
            "name": "redeemSettlementPeriod",
            "type": "u64"
          },
          {
            "name": "redeemCancellationWindow",
            "type": "u64"
          },
          {
            "name": "timeUnit",
            "type": {
              "defined": {
                "name": "timeUnit"
              }
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "oracleConfigs",
      "docs": [
        "Vault-specific oracle configs. If available, these configs are preferred over the global config."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxAgesSeconds",
            "type": {
              "vec": {
                "array": [
                  "u16",
                  2
                ]
              }
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                12
              ]
            }
          }
        ]
      }
    },
    {
      "name": "performanceFee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "hurdleRateBps",
            "type": "u16"
          },
          {
            "name": "hurdleType",
            "type": {
              "defined": {
                "name": "hurdleType"
              }
            }
          }
        ]
      }
    },
    {
      "name": "pricedProtocol",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rent",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "i128"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "lastUpdatedSlot",
            "type": "u64"
          },
          {
            "name": "integrationProgram",
            "type": "pubkey"
          },
          {
            "name": "protocolBitflag",
            "type": "u16"
          },
          {
            "name": "positions",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "protocolFees",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "baseFeeBps",
            "type": "u16"
          },
          {
            "name": "flowFeeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "protocolPermissions",
      "docs": [
        "Represents a delegate's permissions for a specific protocol"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "protocolBitflag",
            "type": "u16"
          },
          {
            "name": "permissionsBitmask",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolPolicy",
      "docs": [
        "Stores policy data for an integrated protocol.",
        "Integration programs serialize/deserialize this data."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "protocolBitflag",
            "type": "u16"
          },
          {
            "name": "data",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "stateAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accountType",
            "type": {
              "defined": {
                "name": "accountType"
              }
            }
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "portfolioManagerName",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "created",
            "type": {
              "defined": {
                "name": "createdModel"
              }
            }
          },
          {
            "name": "baseAssetMint",
            "type": "pubkey"
          },
          {
            "name": "baseAssetDecimals",
            "type": "u8"
          },
          {
            "name": "baseAssetTokenProgram",
            "type": "u8"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timelockDuration",
            "type": "u32"
          },
          {
            "name": "timelockExpiresAt",
            "type": "u64"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "assets",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "integrationAcls",
            "type": {
              "vec": {
                "defined": {
                  "name": "integrationAcl"
                }
              }
            }
          },
          {
            "name": "delegateAcls",
            "type": {
              "vec": {
                "defined": {
                  "name": "delegateAcl"
                }
              }
            }
          },
          {
            "name": "externalPositions",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "pricedProtocols",
            "type": {
              "vec": {
                "defined": {
                  "name": "pricedProtocol"
                }
              }
            }
          },
          {
            "name": "params",
            "type": {
              "vec": {
                "vec": {
                  "defined": {
                    "name": "engineField"
                  }
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "timeUnit",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "second"
          },
          {
            "name": "slot"
          }
        ]
      }
    },
    {
      "name": "valuationModel",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "continuous"
          },
          {
            "name": "periodic"
          }
        ]
      }
    },
    {
      "name": "vaultsPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaultsAllowlist",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "protoKaminoFarms",
      "type": "u16",
      "value": "4"
    },
    {
      "name": "protoKaminoFarmsPermHarvestReward",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoKaminoFarmsPermStake",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoKaminoFarmsPermUnstake",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoKaminoLending",
      "type": "u16",
      "value": "1"
    },
    {
      "name": "protoKaminoLendingPermBorrow",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "protoKaminoLendingPermDeposit",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoKaminoLendingPermInit",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoKaminoLendingPermLiquidate",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoKaminoLendingPermRepay",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoKaminoLendingPermWithdraw",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoKaminoVaults",
      "type": "u16",
      "value": "2"
    },
    {
      "name": "protoKaminoVaultsPermDeposit",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoKaminoVaultsPermWithdraw",
      "type": "u64",
      "value": "2"
    }
  ]
};
