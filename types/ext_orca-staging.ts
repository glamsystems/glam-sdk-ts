/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_orca.json`.
 */
export type ExtOrca = {
  "address": "gstgo1EgmTp2PbLSaL6Qg57P7uADx3aiRZrMsewEdSy",
  "metadata": {
    "name": "extOrca",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Orca Whirlpools integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "closePositionWithTokenExtensions",
      "docs": [
        "Close an empty Token-2022 Orca Whirlpools position owned by the GLAM vault.",
        "",
        "- Permission: `ClosePosition`."
      ],
      "discriminator": [
        1,
        182,
        135,
        59,
        155,
        25,
        99,
        223
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionMint",
          "writable": true
        },
        {
          "name": "positionTokenAccount",
          "writable": true
        },
        {
          "name": "token2022Program",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        }
      ],
      "args": []
    },
    {
      "name": "collectFeesV2",
      "docs": [
        "Collect accrued pool fees using Token-2022-aware accounts.",
        "",
        "- Permission: `CollectFees`."
      ],
      "discriminator": [
        207,
        117,
        95,
        191,
        229,
        180,
        226,
        15
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionTokenAccount"
        },
        {
          "name": "tokenMintA"
        },
        {
          "name": "tokenMintB"
        },
        {
          "name": "tokenOwnerAccountA",
          "writable": true
        },
        {
          "name": "tokenVaultA",
          "writable": true
        },
        {
          "name": "tokenOwnerAccountB",
          "writable": true
        },
        {
          "name": "tokenVaultB",
          "writable": true
        },
        {
          "name": "tokenProgramA"
        },
        {
          "name": "tokenProgramB"
        },
        {
          "name": "memoProgram"
        }
      ],
      "args": [
        {
          "name": "remainingAccountsInfo",
          "type": {
            "option": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        }
      ]
    },
    {
      "name": "collectRewardV2",
      "docs": [
        "Collect one reward emission using Token-2022-aware accounts.",
        "",
        "- Permission: `CollectReward`."
      ],
      "discriminator": [
        177,
        107,
        37,
        180,
        160,
        19,
        49,
        209
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionTokenAccount"
        },
        {
          "name": "rewardOwnerAccount",
          "writable": true
        },
        {
          "name": "rewardMint"
        },
        {
          "name": "rewardVault",
          "writable": true
        },
        {
          "name": "rewardTokenProgram"
        },
        {
          "name": "memoProgram"
        }
      ],
      "args": [
        {
          "name": "rewardIndex",
          "type": "u8"
        },
        {
          "name": "remainingAccountsInfo",
          "type": {
            "option": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        }
      ]
    },
    {
      "name": "decreaseLiquidityV2",
      "docs": [
        "Decrease liquidity in an Orca Whirlpools position using Token-2022-aware accounts.",
        "",
        "- Permission: `DecreaseLiquidity`."
      ],
      "discriminator": [
        58,
        127,
        188,
        62,
        79,
        82,
        196,
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool",
          "writable": true
        },
        {
          "name": "tokenProgramA"
        },
        {
          "name": "tokenProgramB"
        },
        {
          "name": "memoProgram"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionTokenAccount"
        },
        {
          "name": "tokenMintA"
        },
        {
          "name": "tokenMintB"
        },
        {
          "name": "tokenOwnerAccountA",
          "writable": true
        },
        {
          "name": "tokenOwnerAccountB",
          "writable": true
        },
        {
          "name": "tokenVaultA",
          "writable": true
        },
        {
          "name": "tokenVaultB",
          "writable": true
        },
        {
          "name": "tickArrayLower",
          "writable": true
        },
        {
          "name": "tickArrayUpper",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u128"
        },
        {
          "name": "tokenMinA",
          "type": "u64"
        },
        {
          "name": "tokenMinB",
          "type": "u64"
        },
        {
          "name": "remainingAccountsInfo",
          "type": {
            "option": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        }
      ]
    },
    {
      "name": "increaseLiquidityByTokenAmountsV2",
      "docs": [
        "Increase liquidity by token amount bounds using Token-2022-aware accounts."
      ],
      "discriminator": [
        239,
        251,
        9,
        124,
        210,
        198,
        53,
        43
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool",
          "writable": true
        },
        {
          "name": "tokenProgramA"
        },
        {
          "name": "tokenProgramB"
        },
        {
          "name": "memoProgram"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionTokenAccount"
        },
        {
          "name": "tokenMintA"
        },
        {
          "name": "tokenMintB"
        },
        {
          "name": "tokenOwnerAccountA",
          "writable": true
        },
        {
          "name": "tokenOwnerAccountB",
          "writable": true
        },
        {
          "name": "tokenVaultA",
          "writable": true
        },
        {
          "name": "tokenVaultB",
          "writable": true
        },
        {
          "name": "tickArrayLower",
          "writable": true
        },
        {
          "name": "tickArrayUpper",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "method",
          "type": {
            "defined": {
              "name": "increaseLiquidityMethod"
            }
          }
        },
        {
          "name": "remainingAccountsInfo",
          "type": {
            "option": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        }
      ]
    },
    {
      "name": "increaseLiquidityV2",
      "docs": [
        "Increase liquidity in an Orca Whirlpools position using Token-2022-aware accounts.",
        "",
        "- Permission: `IncreaseLiquidity`.",
        "- Policy: Whirlpool and both pool token mints must be allowlisted."
      ],
      "discriminator": [
        133,
        29,
        89,
        223,
        69,
        238,
        176,
        10
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool",
          "writable": true
        },
        {
          "name": "tokenProgramA"
        },
        {
          "name": "tokenProgramB"
        },
        {
          "name": "memoProgram"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionTokenAccount"
        },
        {
          "name": "tokenMintA"
        },
        {
          "name": "tokenMintB"
        },
        {
          "name": "tokenOwnerAccountA",
          "writable": true
        },
        {
          "name": "tokenOwnerAccountB",
          "writable": true
        },
        {
          "name": "tokenVaultA",
          "writable": true
        },
        {
          "name": "tokenVaultB",
          "writable": true
        },
        {
          "name": "tickArrayLower",
          "writable": true
        },
        {
          "name": "tickArrayUpper",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "liquidityAmount",
          "type": "u128"
        },
        {
          "name": "tokenMaxA",
          "type": "u64"
        },
        {
          "name": "tokenMaxB",
          "type": "u64"
        },
        {
          "name": "remainingAccountsInfo",
          "type": {
            "option": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        }
      ]
    },
    {
      "name": "initializeTickArray",
      "docs": [
        "Initialize an Orca fixed tick array for an allowlisted Whirlpool.",
        "",
        "- Permission: `InitializeTickArray`.",
        "- Policy: Whirlpool and both pool token mints must be allowlisted."
      ],
      "discriminator": [
        11,
        188,
        193,
        214,
        141,
        91,
        149,
        184
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool"
        },
        {
          "name": "tickArray",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "startTickIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "openPositionWithTokenExtensions",
      "docs": [
        "Open a Token-2022 Orca Whirlpools position owned by the GLAM vault.",
        "",
        "- Permission: `OpenPosition`.",
        "- Policy: Whirlpool and both pool token mints must be allowlisted."
      ],
      "discriminator": [
        212,
        47,
        95,
        92,
        114,
        102,
        131,
        250
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "positionTokenAccount",
          "writable": true
        },
        {
          "name": "whirlpool"
        },
        {
          "name": "token2022Program",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "metadataUpdateAuth"
        }
      ],
      "args": [
        {
          "name": "tickLowerIndex",
          "type": "i32"
        },
        {
          "name": "tickUpperIndex",
          "type": "i32"
        },
        {
          "name": "withTokenMetadataExtension",
          "type": "bool"
        }
      ]
    },
    {
      "name": "repositionLiquidityV2",
      "docs": [
        "Reposition liquidity into a new Orca Whirlpools tick range."
      ],
      "discriminator": [
        191,
        169,
        224,
        11,
        131,
        19,
        158,
        253
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool",
          "writable": true
        },
        {
          "name": "tokenProgramA"
        },
        {
          "name": "tokenProgramB"
        },
        {
          "name": "memoProgram"
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "positionTokenAccount"
        },
        {
          "name": "tokenMintA"
        },
        {
          "name": "tokenMintB"
        },
        {
          "name": "tokenOwnerAccountA",
          "writable": true
        },
        {
          "name": "tokenOwnerAccountB",
          "writable": true
        },
        {
          "name": "tokenVaultA",
          "writable": true
        },
        {
          "name": "tokenVaultB",
          "writable": true
        },
        {
          "name": "existingTickArrayLower",
          "writable": true
        },
        {
          "name": "existingTickArrayUpper",
          "writable": true
        },
        {
          "name": "newTickArrayLower",
          "writable": true
        },
        {
          "name": "newTickArrayUpper",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newTickLowerIndex",
          "type": "i32"
        },
        {
          "name": "newTickUpperIndex",
          "type": "i32"
        },
        {
          "name": "method",
          "type": {
            "defined": {
              "name": "repositionLiquidityMethod"
            }
          }
        },
        {
          "name": "remainingAccountsInfo",
          "type": {
            "option": {
              "defined": {
                "name": "remainingAccountsInfo"
              }
            }
          }
        }
      ]
    },
    {
      "name": "setWhirlpoolsPolicy",
      "docs": [
        "Set the Orca Whirlpools policy for a GLAM vault."
      ],
      "discriminator": [
        87,
        233,
        250,
        82,
        120,
        40,
        212,
        223
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
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        }
      ],
      "args": [
        {
          "name": "policy",
          "type": {
            "defined": {
              "name": "whirlpoolsPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "updateFeesAndRewards",
      "docs": [
        "Update accrued fees and rewards for an Orca Whirlpools position.",
        "",
        "- Permission: `UpdateFeesAndRewards`."
      ],
      "discriminator": [
        154,
        230,
        250,
        13,
        236,
        209,
        75,
        223
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
          "address": "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "whirlpool",
          "writable": true
        },
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "tickArrayLower"
        },
        {
          "name": "tickArrayUpper"
        }
      ],
      "args": []
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
  "errors": [
    {
      "code": 6000,
      "name": "invalidWhirlpoolAccount",
      "msg": "Invalid Orca Whirlpool account"
    },
    {
      "code": 6001,
      "name": "invalidPositionAccount",
      "msg": "Invalid Orca position account"
    },
    {
      "code": 6002,
      "name": "invalidRewardIndex",
      "msg": "Invalid Orca reward index"
    },
    {
      "code": 6003,
      "name": "tokenMintMismatch",
      "msg": "Orca token account mint does not match the Whirlpool"
    },
    {
      "code": 6004,
      "name": "glamStateDisabled",
      "msg": "GLAM state is disabled"
    },
    {
      "code": 6005,
      "name": "invalidIxArgs",
      "msg": "Invalid instruction arguments"
    },
    {
      "code": 6006,
      "name": "protocolPolicyViolation",
      "msg": "Protocol policy violation"
    },
    {
      "code": 6007,
      "name": "pricingError",
      "msg": "Pricing error"
    },
    {
      "code": 6008,
      "name": "missingAccount",
      "msg": "An account required by the instruction is missing"
    },
    {
      "code": 6009,
      "name": "unsupportedOracleSource",
      "msg": "Oracle source not supported in this context"
    },
    {
      "code": 6010,
      "name": "invalidAccountType",
      "msg": "Invalid account type"
    },
    {
      "code": 6011,
      "name": "unexpectedProgramOwner",
      "msg": "Account is owned by an unexpected program"
    },
    {
      "code": 6012,
      "name": "invalidPriceDenom",
      "msg": "Invalid price denom"
    },
    {
      "code": 6013,
      "name": "maxDeviationExceeded",
      "msg": "Max deviation exceeded"
    },
    {
      "code": 6014,
      "name": "invalidTokenAccount",
      "msg": "Invalid token account"
    },
    {
      "code": 6015,
      "name": "invalidVaultTokenAccount",
      "msg": "Invalid vault ata"
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
      "name": "accountsType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "transferHookA"
          },
          {
            "name": "transferHookB"
          },
          {
            "name": "transferHookReward"
          },
          {
            "name": "transferHookInput"
          },
          {
            "name": "transferHookIntermediate"
          },
          {
            "name": "transferHookOutput"
          },
          {
            "name": "supplementalTickArrays"
          },
          {
            "name": "supplementalTickArraysOne"
          },
          {
            "name": "supplementalTickArraysTwo"
          },
          {
            "name": "transferHookDepositA"
          },
          {
            "name": "transferHookDepositB"
          },
          {
            "name": "transferHookWithdrawalA"
          },
          {
            "name": "transferHookWithdrawalB"
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
      "name": "increaseLiquidityMethod",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "byTokenAmounts",
            "fields": [
              {
                "name": "tokenMaxA",
                "type": "u64"
              },
              {
                "name": "tokenMaxB",
                "type": "u64"
              },
              {
                "name": "minSqrtPrice",
                "type": "u128"
              },
              {
                "name": "maxSqrtPrice",
                "type": "u128"
              }
            ]
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
      "name": "remainingAccountsInfo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "slices",
            "type": {
              "vec": {
                "defined": {
                  "name": "remainingAccountsSlice"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "remainingAccountsSlice",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "accountsType",
            "type": {
              "defined": {
                "name": "accountsType"
              }
            }
          },
          {
            "name": "length",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "repositionLiquidityMethod",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "byLiquidity",
            "fields": [
              {
                "name": "newLiquidityAmount",
                "type": "u128"
              },
              {
                "name": "existingRangeTokenMinA",
                "type": "u64"
              },
              {
                "name": "existingRangeTokenMinB",
                "type": "u64"
              },
              {
                "name": "newRangeTokenMaxA",
                "type": "u64"
              },
              {
                "name": "newRangeTokenMaxB",
                "type": "u64"
              }
            ]
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
      "name": "whirlpoolsPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "whirlpoolsAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "tokenMintsAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "maxDeviationBps",
            "docs": [
              "Signed pool/oracle price threshold in bps, matching Jupiter swap v2 semantics.",
              "Positive permits pool price below oracle, zero requires at least oracle, negative requires a premium."
            ],
            "type": "i16"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "protoOrcaWhirlpools",
      "type": "u16",
      "value": "1"
    },
    {
      "name": "protoOrcaWhirlpoolsPermClosePosition",
      "type": "u64",
      "value": "64"
    },
    {
      "name": "protoOrcaWhirlpoolsPermCollectFees",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoOrcaWhirlpoolsPermCollectReward",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoOrcaWhirlpoolsPermDecreaseLiquidity",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoOrcaWhirlpoolsPermIncreaseLiquidity",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoOrcaWhirlpoolsPermIncreaseLiquidityByTokenAmounts",
      "type": "u64",
      "value": "128"
    },
    {
      "name": "protoOrcaWhirlpoolsPermInitializeTickArray",
      "type": "u64",
      "value": "512"
    },
    {
      "name": "protoOrcaWhirlpoolsPermOpenPosition",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoOrcaWhirlpoolsPermRepositionLiquidity",
      "type": "u64",
      "value": "256"
    },
    {
      "name": "protoOrcaWhirlpoolsPermUpdateFeesAndRewards",
      "type": "u64",
      "value": "8"
    }
  ]
};
