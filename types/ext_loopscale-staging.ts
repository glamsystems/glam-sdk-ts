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
        "- Permission: `BorrowPrincipal`.",
        "- Policy",
        "- `principal_mint` must be present in `LoopscalePolicy::borrow_allowlist`.",
        "- `market_information` must be present in `LoopscalePolicy::market_allowlist`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "associatedTokenProgram"
        },
        {
          "name": "tokenProgram"
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
        "Claim accrued rewards on staked user-vault LP positions.",
        "",
        "- Permission: `ClaimVaultRewards`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "associatedTokenProgram"
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
        "- Permission: `ManageLoan`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
        },
        {
          "name": "loan",
          "writable": true
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
        "- Permission: `ManageLoan`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
        },
        {
          "name": "loan",
          "writable": true
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
      "name": "depositCollateral",
      "docs": [
        "Deposit collateral into a Loopscale loan.",
        "",
        "- Permission: `DepositCollateral`.",
        "- Policy: `deposit_mint` must be present in `LoopscalePolicy::deposit_allowlist`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "associatedTokenProgram"
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
      "name": "depositUserVault",
      "docs": [
        "Deposit principal into a Loopscale user vault and mint LP tokens to the GLAM vault.",
        "",
        "- Permission: `DepositUserVault`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "token2022Program"
        },
        {
          "name": "associatedTokenProgram"
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
      "name": "lockLoan",
      "docs": [
        "Lock a loan to commit borrowed principal and collateral.",
        "",
        "- Permission: `ManageLoan`."
      ],
      "discriminator": [
        28,
        101,
        52,
        240,
        146,
        230,
        95,
        22
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
        },
        {
          "name": "loan",
          "writable": true
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "lockLoanParams"
            }
          }
        }
      ]
    },
    {
      "name": "refinanceLedger",
      "docs": [
        "Refinance a loan ledger from one strategy to another.",
        "",
        "- Permission: `RefinanceLedger`.",
        "- Policy",
        "- `principal_mint` must be present in `LoopscalePolicy::borrow_allowlist`.",
        "- `new_strategy_market_information` must be present in `LoopscalePolicy::market_allowlist`."
      ],
      "discriminator": [
        103,
        41,
        134,
        43,
        140,
        152,
        253,
        74
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
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
        },
        {
          "name": "loan",
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
          "name": "oldStrategyTa",
          "writable": true
        },
        {
          "name": "newStrategyTa",
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
          "name": "associatedTokenProgram"
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
          "name": "params",
          "type": {
            "defined": {
              "name": "refinanceLedgerParams"
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
        "- Permission: `RepayPrincipal`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "associatedTokenProgram"
        },
        {
          "name": "tokenProgram"
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
      "name": "setLoopscalePolicy",
      "docs": [
        "Set the `LoopscalePolicy` (deposit, borrow, and market allowlists) on the GLAM state."
      ],
      "discriminator": [
        216,
        84,
        180,
        148,
        164,
        253,
        148,
        173
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
              "name": "loopscalePolicy"
            }
          }
        }
      ]
    },
    {
      "name": "stakeUserVaultLp",
      "docs": [
        "Stake user-vault LP tokens to earn rewards.",
        "",
        "- Permission: `StakeUserVaultLp`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
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
      "name": "unlockLoan",
      "docs": [
        "Unlock a previously locked loan.",
        "",
        "- Permission: `ManageLoan`."
      ],
      "discriminator": [
        121,
        226,
        178,
        98,
        215,
        209,
        240,
        38
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
        },
        {
          "name": "loan",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "loanUnlockParams"
            }
          }
        }
      ]
    },
    {
      "name": "unstakeUserVaultLp",
      "docs": [
        "Unstake user-vault LP tokens.",
        "",
        "- Permission: `UnstakeUserVaultLp`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
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
      "name": "updateWeightMatrix",
      "docs": [
        "Update the collateral weight matrix on a loan.",
        "",
        "- Permission: `ManageLoan`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
        },
        {
          "name": "loan",
          "writable": true
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
        "- Permission: `WithdrawCollateral`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "associatedTokenProgram"
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
      "name": "withdrawUserVault",
      "docs": [
        "Withdraw principal from a Loopscale user vault by redeeming LP tokens.",
        "",
        "- Permission: `WithdrawUserVault`."
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
          "signer": true,
          "address": "CyNKPfqsSLAejjZtEeNG3pR4SkPhSPHXdGhuNTyudrNs"
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
          "name": "token2022Program"
        },
        {
          "name": "associatedTokenProgram"
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
      "name": "loanUnlockParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "assetIndexGuidance",
            "type": "bytes"
          }
        ]
      }
    },
    {
      "name": "lockLoanParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "unlockIdx",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "loopscalePolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "borrowAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "marketsAllowlist",
            "type": {
              "vec": "pubkey"
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
      "name": "refinanceLedgerParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ledgerIndex",
            "type": "u8"
          },
          {
            "name": "durationIndex",
            "type": "u8"
          },
          {
            "name": "assetIndexGuidance",
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
      "name": "protoLoopscale",
      "type": "u16",
      "value": "1"
    },
    {
      "name": "protoLoopscalePermBorrowPrincipal",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "protoLoopscalePermClaimVaultRewards",
      "type": "u64",
      "value": "1024"
    },
    {
      "name": "protoLoopscalePermDepositCollateral",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoLoopscalePermDepositUserVault",
      "type": "u64",
      "value": "64"
    },
    {
      "name": "protoLoopscalePermManageLoan",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoLoopscalePermRefinanceLedger",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoLoopscalePermRepayPrincipal",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoLoopscalePermStakeUserVaultLp",
      "type": "u64",
      "value": "256"
    },
    {
      "name": "protoLoopscalePermUnstakeUserVaultLp",
      "type": "u64",
      "value": "512"
    },
    {
      "name": "protoLoopscalePermWithdrawCollateral",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoLoopscalePermWithdrawUserVault",
      "type": "u64",
      "value": "128"
    }
  ]
};
