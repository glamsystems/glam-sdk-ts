/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_loopscale.json`.
 */
export type ExtLoopscale = {
  "address": "gstgL6y4uWjsfM3Qjs5euoTDmEcXoUjqx8rkYJhYngG",
  "metadata": {
    "name": "extLoopscale",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Loopscale integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "borrowPrincipal",
      "docs": [
        "Borrow principal against a locked loan.",
        "",
        "- Permission: `BorrowPermissions::BorrowPrincipal`.",
        "- Policy:",
        "- `principal_mint` must be present in `BorrowPolicy::principal_allowlist`.",
        "- If `market_information` has a `BorrowPolicy::market_policies` entry,",
        "advanced per-market borrow limits are enforced."
      ],
      "discriminator": [
        106,
        10,
        38,
        204,
        139,
        188,
        124,
        50
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "marketInformation",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "borrowerTa",
          "writable": true
        },
        {
          "name": "strategyTa",
          "writable": true
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "borrowPrincipalParams"
            }
          }
        }
      ]
    },
    {
      "name": "claimVaultRewards",
      "docs": [
        "Claim rewards accrued by a Loopscale VaultStake account.",
        "",
        "- Permission: `VaultPermissions::ClaimVaultRewards`.",
        "- Policy: `vault` must be present in `VaultPolicy::vault_allowlist`."
      ],
      "discriminator": [
        0,
        152,
        75,
        29,
        195,
        223,
        12,
        101
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "vault"
        },
        {
          "name": "vaultRewardsInfo",
          "writable": true
        },
        {
          "name": "userRewardsInfo",
          "writable": true
        },
        {
          "name": "stakeAccount",
          "writable": true
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "mints",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "closeLoan",
      "docs": [
        "Close an existing Loopscale loan PDA.",
        "",
        "- Permission: `BorrowPermissions::CloseLoan`."
      ],
      "discriminator": [
        96,
        114,
        111,
        204,
        149,
        228,
        235,
        124
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": []
    },
    {
      "name": "closeStrategy",
      "docs": [
        "Close a Loopscale lender strategy account.",
        "",
        "- Permission: `LendingPermissions::CloseStrategy`."
      ],
      "discriminator": [
        56,
        247,
        170,
        246,
        89,
        221,
        134,
        200
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": []
    },
    {
      "name": "createLoan",
      "docs": [
        "Create a new Loopscale loan PDA owned by the GLAM vault.",
        "",
        "- Permission: `BorrowPermissions::CreateLoan`."
      ],
      "discriminator": [
        166,
        131,
        118,
        219,
        138,
        218,
        206,
        140
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createLoanParams"
            }
          }
        }
      ]
    },
    {
      "name": "createStrategy",
      "docs": [
        "Create a new Loopscale lender strategy owned by the GLAM vault.",
        "",
        "- Permission: `LendingPermissions::CreateStrategy`.",
        "- Policy:",
        "- `principal_mint` must be present in `LendingPolicy::principal_allowlist`.",
        "- If `market_information` has a `LendingPolicy::market_policies` entry,",
        "advanced per-market lending limits are enforced.",
        "- `params.lender` must equal the GLAM vault."
      ],
      "discriminator": [
        152,
        160,
        107,
        148,
        245,
        190,
        127,
        224
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "nonce",
          "signer": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "marketInformation"
        },
        {
          "name": "principalMint"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createStrategyParams"
            }
          }
        }
      ]
    },
    {
      "name": "depositCollateral",
      "docs": [
        "Deposit collateral into a Loopscale loan.",
        "",
        "- Permission: `BorrowPermissions::DepositCollateral`.",
        "- Policy:",
        "- `deposit_mint` must be present in `BorrowPolicy::collateral_allowlist`."
      ],
      "discriminator": [
        156,
        131,
        142,
        116,
        146,
        247,
        162,
        120
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "borrowerCollateralTa",
          "writable": true
        },
        {
          "name": "loanCollateralTa",
          "writable": true
        },
        {
          "name": "depositMint"
        },
        {
          "name": "assetIdentifier"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "depositCollateralParams"
            }
          }
        }
      ]
    },
    {
      "name": "depositStrategy",
      "docs": [
        "Deposit principal liquidity into a Loopscale lender strategy.",
        "",
        "- Permission: `LendingPermissions::DepositStrategy`.",
        "- Policy:",
        "- `principal_mint` must be present in `LendingPolicy::principal_allowlist`.",
        "- If `market_information` has a `LendingPolicy::market_policies` entry,",
        "advanced per-market lending limits are enforced."
      ],
      "discriminator": [
        246,
        82,
        57,
        226,
        131,
        222,
        253,
        249
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "marketInformation"
        },
        {
          "name": "lenderTa",
          "writable": true
        },
        {
          "name": "strategyTa",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
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
      "name": "depositUserVault",
      "docs": [
        "Deposit principal into a Loopscale user vault and receive Token-2022 LP tokens.",
        "",
        "- Permission: `VaultPermissions::DepositUserVault`.",
        "- Policy: `vault` must be present in `VaultPolicy::vault_allowlist`."
      ],
      "discriminator": [
        204,
        190,
        182,
        224,
        15,
        219,
        247,
        121
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "marketInformation"
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "userLpTa",
          "writable": true
        },
        {
          "name": "userPrincipalTa",
          "writable": true
        },
        {
          "name": "strategyPrincipalTa",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "principalTokenProgram"
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
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "lpParams"
            }
          }
        }
      ]
    },
    {
      "name": "repayPrincipal",
      "docs": [
        "Repay principal on a Loopscale loan.",
        "",
        "- Permission: `BorrowPermissions::RepayPrincipal`."
      ],
      "discriminator": [
        229,
        67,
        83,
        65,
        77,
        84,
        80,
        141
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "marketInformation",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "borrowerTa",
          "writable": true
        },
        {
          "name": "strategyTa",
          "writable": true
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "repayPrincipalParams"
            }
          }
        }
      ]
    },
    {
      "name": "sellLedger",
      "docs": [
        "Sell a loan ledger from one strategy to another.",
        "",
        "- Permission: `LendingPermissions::SellLedger`.",
        "- Policy:",
        "- `principal_mint` must be present in `LendingPolicy::principal_allowlist`.",
        "- If the new strategy market account has a `LendingPolicy::market_policies` entry,",
        "advanced exposure limits are enforced."
      ],
      "discriminator": [
        55,
        17,
        153,
        148,
        120,
        242,
        80,
        5
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "newStrategyTa",
          "writable": true
        },
        {
          "name": "lenderAuthTa",
          "writable": true
        },
        {
          "name": "oldStrategy",
          "writable": true
        },
        {
          "name": "newStrategy",
          "writable": true
        },
        {
          "name": "oldStrategyMarketInformation",
          "writable": true
        },
        {
          "name": "newStrategyMarketInformation",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "userVault"
        },
        {
          "name": "oldStrategyTa"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "sellLedgerParams"
            }
          }
        }
      ]
    },
    {
      "name": "setBorrowPolicy",
      "docs": [
        "Set the Loopscale borrow policy (collateral allowlist and market policies).",
        "",
        "- Permission: `BorrowPermissions::SetPolicy`."
      ],
      "discriminator": [
        199,
        94,
        106,
        205,
        150,
        227,
        206,
        68
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
        },
        {
          "name": "integrationProgram",
          "address": "gstgL6y4uWjsfM3Qjs5euoTDmEcXoUjqx8rkYJhYngG"
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
        }
      ],
      "args": [
        {
          "name": "policy",
          "type": {
            "defined": {
              "name": "borrowPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "setLendingPolicy",
      "docs": [
        "Set the Loopscale lending policy (allowlists, market policies, and sell-ledger limits).",
        "",
        "- Permission: `LendingPermissions::SetPolicy`."
      ],
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
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "integrationProgram",
          "address": "gstgL6y4uWjsfM3Qjs5euoTDmEcXoUjqx8rkYJhYngG"
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
      "name": "setVaultPolicy",
      "docs": [
        "Set the Loopscale vault policy (vault allowlist).",
        "",
        "- Permission: `VaultPermissions::SetPolicy`."
      ],
      "discriminator": [
        184,
        31,
        142,
        18,
        106,
        143,
        184,
        158
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
        },
        {
          "name": "integrationProgram",
          "address": "gstgL6y4uWjsfM3Qjs5euoTDmEcXoUjqx8rkYJhYngG"
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
        }
      ],
      "args": [
        {
          "name": "policy",
          "type": {
            "defined": {
              "name": "vaultPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "stakeUserVaultLp",
      "docs": [
        "Stake Loopscale user vault LP tokens into a VaultStake account.",
        "",
        "- Permission: `VaultPermissions::StakeUserVaultLp`.",
        "- Policy: `vault` must be present in `VaultPolicy::vault_allowlist`."
      ],
      "discriminator": [
        114,
        132,
        194,
        209,
        208,
        149,
        43,
        136
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "nonce",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultStake",
          "writable": true
        },
        {
          "name": "lpMint"
        },
        {
          "name": "userLpTa",
          "writable": true
        },
        {
          "name": "vaultStakeLpTa",
          "writable": true
        },
        {
          "name": "vaultRewardsInfo",
          "writable": true
        },
        {
          "name": "userRewardsInfo",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "vaultStakeParams"
            }
          }
        }
      ]
    },
    {
      "name": "unstakeUserVaultLp",
      "docs": [
        "Unstake Loopscale user vault LP tokens from a VaultStake account.",
        "",
        "- Permission: `VaultPermissions::UnstakeUserVaultLp`.",
        "- Policy: `vault` must be present in `VaultPolicy::vault_allowlist`."
      ],
      "discriminator": [
        83,
        78,
        230,
        123,
        226,
        40,
        158,
        97
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "vaultStake",
          "writable": true
        },
        {
          "name": "userLpTa",
          "writable": true
        },
        {
          "name": "vaultStakeLpTa",
          "writable": true
        },
        {
          "name": "vaultRewardsInfo",
          "writable": true
        },
        {
          "name": "userRewardsInfo",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "vaultUnstakeParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateStrategy",
      "docs": [
        "Update a Loopscale lender strategy's terms, caps, and collateral terms.",
        "",
        "- Permission: `LendingPermissions::UpdateStrategy`.",
        "- Policy:",
        "- The strategy market account must be passed as the first remaining account.",
        "- `principal_mint` must be present in `LendingPolicy::principal_allowlist`.",
        "- Collateral term asset identifiers must be present in",
        "`LendingPolicy::collateral_allowlist`.",
        "- If the strategy market account has a `LendingPolicy::market_policies` entry,",
        "advanced per-market lending limits are enforced."
      ],
      "discriminator": [
        16,
        76,
        138,
        179,
        171,
        112,
        196,
        21
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "strategyTa",
          "writable": true
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "collateralTerms",
          "type": {
            "vec": {
              "defined": {
                "name": "multiCollateralTermsUpdateParams"
              }
            }
          }
        },
        {
          "name": "params",
          "type": {
            "option": {
              "defined": {
                "name": "updateStrategyParams"
              }
            }
          }
        }
      ]
    },
    {
      "name": "updateWeightMatrix",
      "docs": [
        "Update the collateral weight matrix on a loan.",
        "",
        "- Permission: `BorrowPermissions::UpdateLoan`."
      ],
      "discriminator": [
        252,
        166,
        37,
        207,
        154,
        83,
        187,
        128
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "protocolAdminState"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateWeightMatrixParams"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawCollateral",
      "docs": [
        "Withdraw collateral from a Loopscale loan.",
        "",
        "- Permission: `BorrowPermissions::WithdrawCollateral`."
      ],
      "discriminator": [
        115,
        135,
        168,
        106,
        139,
        214,
        138,
        150
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "borrowerTa",
          "writable": true
        },
        {
          "name": "loanTa",
          "writable": true
        },
        {
          "name": "assetMint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "withdrawCollateralParams"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawStrategy",
      "docs": [
        "Withdraw undeployed principal from a Loopscale lender strategy.",
        "",
        "- Permission: `LendingPermissions::WithdrawStrategy`."
      ],
      "discriminator": [
        31,
        45,
        162,
        5,
        193,
        217,
        134,
        188
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "marketInformation"
        },
        {
          "name": "lenderTa",
          "writable": true
        },
        {
          "name": "strategyTa",
          "writable": true
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "withdrawAll",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdrawUserVault",
      "docs": [
        "Withdraw principal from a Loopscale user vault by burning Token-2022 LP tokens.",
        "",
        "- Permission: `VaultPermissions::WithdrawUserVault`.",
        "- Policy: `vault` must be present in `VaultPolicy::vault_allowlist`."
      ],
      "discriminator": [
        9,
        80,
        134,
        138,
        212,
        20,
        61,
        42
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
          "address": "1oopBoJG58DgkUVKkEzKgyG9dvRmpgeEm1AVjoHkF78"
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
          "name": "bsAuth",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        },
        {
          "name": "strategy",
          "writable": true
        },
        {
          "name": "marketInformation"
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "userLpTa",
          "writable": true
        },
        {
          "name": "userPrincipalTa",
          "writable": true
        },
        {
          "name": "strategyPrincipalTa",
          "writable": true
        },
        {
          "name": "principalMint"
        },
        {
          "name": "principalTokenProgram"
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
          "name": "protocolAdminState"
        },
        {
          "name": "eventAuthority"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "lpParams"
            }
          }
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
  "errors": [
    {
      "code": 6000,
      "name": "autoCloseLoanNotSupported",
      "msg": "Auto-close loan not supported"
    },
    {
      "code": 6001,
      "name": "invalidVaultTokenAccount",
      "msg": "Vault token account must be the GLAM vault ATA for the expected mint"
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
      "name": "borrowMarketPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "docs": [
              "Loopscale market information account this policy applies to."
            ],
            "type": "pubkey"
          },
          {
            "name": "maxBorrowAmount",
            "docs": [
              "Maximum principal amount that may be borrowed in a single instruction.",
              "A value of zero means no per-instruction borrow is allowed for this market."
            ],
            "type": "u64"
          },
          {
            "name": "maxTotalBorrowAmount",
            "docs": [
              "Maximum outstanding principal a single loan may owe in this market.",
              "Enforced per loan (summed over that loan's ledgers in this market), not",
              "aggregated across all of the vault's loans in this market. A value of zero",
              "means no outstanding borrow exposure is allowed for this market."
            ],
            "type": "u64"
          },
          {
            "name": "maxLtvBps",
            "docs": [
              "Maximum expected liquidation LTV threshold, in basis points.",
              "Borrow enforcement compares this to Loopscale's expected LQT values.",
              "A value of zero means no expected liquidation LTV is allowed for this market."
            ],
            "type": "u16"
          },
          {
            "name": "durationIndexesAllowlist",
            "docs": [
              "Duration indexes that may be used when borrowing from this market.",
              "An empty list denies all borrow durations for this market. Index mapping:",
              "- 0 = 1 day",
              "- 1 = 1 week",
              "- 2 = 1 month",
              "- 3 = 3 months",
              "- 4 = 1 year"
            ],
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "borrowPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralAllowlist",
            "docs": [
              "Collateral mints that may be deposited into Loopscale borrow loans."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "principalAllowlist",
            "docs": [
              "Principal mints that may be borrowed from Loopscale borrow markets.",
              "An empty list denies all principal borrows."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "marketPolicies",
            "docs": [
              "Optional per-market risk limits for borrow operations.",
              "If a market is present here, advanced per-market limits are enforced.",
              "If absent, borrow operations are governed by the top-level allowlists."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "borrowMarketPolicy"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "borrowPrincipalParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "assetIndexGuidance",
            "type": "bytes"
          },
          {
            "name": "duration",
            "type": "u8"
          },
          {
            "name": "expectedLoanValues",
            "type": {
              "defined": {
                "name": "expectedLoanValues"
              }
            }
          },
          {
            "name": "skipSolUnwrap",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "collateralTermsIndices",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralIndex",
            "type": "u8"
          },
          {
            "name": "durationIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "createLoanParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createStrategyParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lender",
            "type": "pubkey"
          },
          {
            "name": "originationCap",
            "type": "u64"
          },
          {
            "name": "liquidityBuffer",
            "type": "u64"
          },
          {
            "name": "interestFee",
            "type": "u64"
          },
          {
            "name": "originationFee",
            "type": "u64"
          },
          {
            "name": "principalFee",
            "type": "u64"
          },
          {
            "name": "originationsEnabled",
            "type": "bool"
          },
          {
            "name": "externalYieldSourceArgs",
            "type": {
              "option": {
                "defined": {
                  "name": "externalYieldSourceArgs"
                }
              }
            }
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
      "name": "depositCollateralParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "assetType",
            "type": "u8"
          },
          {
            "name": "assetIdentifier",
            "type": "pubkey"
          },
          {
            "name": "assetIndexGuidance",
            "type": "bytes"
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
      "name": "exactInParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amountIn",
            "type": "u64"
          },
          {
            "name": "minAmountOut",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "exactOutParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amountOut",
            "type": "u64"
          },
          {
            "name": "maxAmountIn",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "expectedLoanValues",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "expectedApy",
            "type": "u64"
          },
          {
            "name": "expectedLqt",
            "type": {
              "array": [
                "u32",
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "externalYieldSourceArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "newExternalYieldSource",
            "type": "u8"
          },
          {
            "name": "externalYieldVault",
            "type": "pubkey"
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
      "name": "lendingMarketPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "docs": [
              "Loopscale market information account this policy applies to."
            ],
            "type": "pubkey"
          },
          {
            "name": "maxDepositAmount",
            "docs": [
              "Maximum principal amount that may be deposited in a single instruction.",
              "A value of zero means no per-instruction deposit is allowed for this market."
            ],
            "type": "u64"
          },
          {
            "name": "maxTotalDepositAmount",
            "docs": [
              "Maximum principal exposure (token balance + deployed amount) a single",
              "strategy may hold in this market. Enforced per strategy, not aggregated",
              "across all of the vault's strategies in this market. A value of zero means",
              "no lending exposure is allowed for this market."
            ],
            "type": "u64"
          },
          {
            "name": "minLoanApyCbps",
            "docs": [
              "Minimum accepted loan APY, in centibasis points, for strategy terms in this market."
            ],
            "type": "u32"
          },
          {
            "name": "maxLtvBps",
            "docs": [
              "Maximum accepted borrower loan-to-value, in basis points, for strategy terms in this market.",
              "A value of zero means no borrower LTV is allowed for this market."
            ],
            "type": "u16"
          },
          {
            "name": "durationIndexesAllowlist",
            "docs": [
              "Duration indexes that may be offered by vault-owned strategies in this market.",
              "An empty list denies all lending durations for this market. Index mapping:",
              "- 0 = 1 day",
              "- 1 = 1 week",
              "- 2 = 1 month",
              "- 3 = 3 months",
              "- 4 = 1 year"
            ],
            "type": "bytes"
          },
          {
            "name": "collateralAssetAllowlist",
            "docs": [
              "Collateral asset identifiers that vault-owned strategies may accept in this market.",
              "An empty list denies all strategy collateral assets for this market."
            ],
            "type": {
              "vec": "pubkey"
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
            "name": "principalAllowlist",
            "docs": [
              "Principal mints that may be lent into Loopscale strategies.",
              "An empty list denies all strategy creation, updates, deposits, and ledger sales."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "collateralAllowlist",
            "docs": [
              "Collateral asset identifiers that vault-owned strategies may accept.",
              "An empty list denies all strategy collateral assets."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "marketPolicies",
            "docs": [
              "Optional per-market risk limits for strategy creation, updates, deposits, and ledger sales.",
              "If a market is present here, advanced per-market limits are enforced.",
              "If absent, lending operations are governed by top-level allowlists,",
              "permission checks, and sell-ledger limits."
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "lendingMarketPolicy"
                }
              }
            }
          },
          {
            "name": "sellLedgerPolicy",
            "docs": [
              "Risk limits for selling Loopscale loan ledgers."
            ],
            "type": {
              "defined": {
                "name": "sellLedgerPolicy"
              }
            }
          }
        ]
      }
    },
    {
      "name": "lpParams",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "exactIn",
            "fields": [
              {
                "defined": {
                  "name": "exactInParams"
                }
              }
            ]
          },
          {
            "name": "exactOut",
            "fields": [
              {
                "defined": {
                  "name": "exactOutParams"
                }
              }
            ]
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
      "name": "multiCollateralTermsUpdateParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "apy",
            "type": "u64"
          },
          {
            "name": "indices",
            "type": {
              "vec": {
                "defined": {
                  "name": "collateralTermsIndices"
                }
              }
            }
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
      "name": "repayPrincipalParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "ledgerIndex",
            "type": "u8"
          },
          {
            "name": "repayAll",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "sellLedgerParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ledgerIndex",
            "type": "u8"
          },
          {
            "name": "expectedSalePrice",
            "type": "u64"
          },
          {
            "name": "assetIndexGuidance",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "sellLedgerPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxDiscountBps",
            "docs": [
              "Maximum discount from the ledger's expected value, in basis points.",
              "A value of zero requires no discount."
            ],
            "type": "u16"
          },
          {
            "name": "maxSlippageBps",
            "docs": [
              "Maximum tolerated slippage while selling a ledger, in basis points.",
              "A value of zero allows no slippage."
            ],
            "type": "u16"
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
      "name": "updateStrategyParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "originationsEnabled",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "liquidityBuffer",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "interestFee",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "originationFee",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "principalFee",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "originationCap",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "marketInformation",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "externalYieldSourceArgs",
            "type": {
              "option": {
                "defined": {
                  "name": "externalYieldSourceArgs"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "updateWeightMatrixParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collateralIndex",
            "type": "u8"
          },
          {
            "name": "weightMatrix",
            "type": {
              "array": [
                "u32",
                5
              ]
            }
          },
          {
            "name": "expectedLoanValues",
            "type": {
              "defined": {
                "name": "expectedLoanValues"
              }
            }
          },
          {
            "name": "assetIndexGuidance",
            "type": "bytes"
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
      "name": "vaultPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vaultAllowlist",
            "docs": [
              "Loopscale user vault accounts that may be used by the GLAM vault.",
              "An empty list denies all Loopscale user vault operations."
            ],
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "vaultStakeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "principalAmount",
            "type": "u64"
          },
          {
            "name": "stakeAll",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "duration",
            "type": "u32"
          },
          {
            "name": "durationType",
            "type": "u8"
          },
          {
            "name": "actionType",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vaultUnstakeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "actionType",
            "type": "u8"
          },
          {
            "name": "principalAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawCollateralParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "collateralIndex",
            "type": "u8"
          },
          {
            "name": "assetIndexGuidance",
            "type": "bytes"
          },
          {
            "name": "expectedLoanValues",
            "type": {
              "defined": {
                "name": "expectedLoanValues"
              }
            }
          },
          {
            "name": "closeIfEligible",
            "type": "bool"
          },
          {
            "name": "withdrawAll",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "protoLoopscaleBorrow",
      "type": "u16",
      "value": "1"
    },
    {
      "name": "protoLoopscaleBorrowPermBorrowPrincipal",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoLoopscaleBorrowPermCloseLoan",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoLoopscaleBorrowPermCreateLoan",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoLoopscaleBorrowPermDepositCollateral",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "protoLoopscaleBorrowPermRepayPrincipal",
      "type": "u64",
      "value": "64"
    },
    {
      "name": "protoLoopscaleBorrowPermSetPolicy",
      "type": "u64",
      "value": "128"
    },
    {
      "name": "protoLoopscaleBorrowPermUpdateLoan",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoLoopscaleBorrowPermWithdrawCollateral",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoLoopscaleLending",
      "type": "u16",
      "value": "2"
    },
    {
      "name": "protoLoopscaleLendingPermCloseStrategy",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoLoopscaleLendingPermCreateStrategy",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoLoopscaleLendingPermDepositStrategy",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoLoopscaleLendingPermSellLedger",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoLoopscaleLendingPermSetPolicy",
      "type": "u64",
      "value": "64"
    },
    {
      "name": "protoLoopscaleLendingPermUpdateStrategy",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoLoopscaleLendingPermWithdrawStrategy",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "protoLoopscaleVault",
      "type": "u16",
      "value": "4"
    },
    {
      "name": "protoLoopscaleVaultPermClaimVaultRewards",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoLoopscaleVaultPermDepositUserVault",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoLoopscaleVaultPermSetPolicy",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoLoopscaleVaultPermStakeUserVaultLp",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoLoopscaleVaultPermUnstakeUserVaultLp",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "protoLoopscaleVaultPermWithdrawUserVault",
      "type": "u64",
      "value": "2"
    }
  ]
};
