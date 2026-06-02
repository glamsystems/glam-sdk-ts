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
          "name": "associatedTokenProgram"
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
        "- Permission: `CloseStrategy`."
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
          "name": "associatedTokenProgram"
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
        "- Permission: `CreateStrategy`.",
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
          "name": "associatedTokenProgram"
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
        "- Permission: `DepositStrategy`."
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
          "name": "associatedTokenProgram"
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
          "name": "associatedTokenProgram"
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
        "- Permission: `SellLedger`."
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
          "name": "associatedTokenProgram"
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
      "name": "updateStrategy",
      "docs": [
        "Update a Loopscale lender strategy's terms, caps, and collateral terms.",
        "",
        "- Permission: `UpdateStrategy`."
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
          "name": "associatedTokenProgram"
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
          "name": "associatedTokenProgram"
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
        "- Permission: `WithdrawStrategy`."
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
          "name": "associatedTokenProgram"
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
      "name": "protoLoopscalePermCloseStrategy",
      "type": "u64",
      "value": "32768"
    },
    {
      "name": "protoLoopscalePermCreateStrategy",
      "type": "u64",
      "value": "2048"
    },
    {
      "name": "protoLoopscalePermDepositCollateral",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoLoopscalePermDepositStrategy",
      "type": "u64",
      "value": "8192"
    },
    {
      "name": "protoLoopscalePermManageLoan",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoLoopscalePermRepayPrincipal",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoLoopscalePermSellLedger",
      "type": "u64",
      "value": "65536"
    },
    {
      "name": "protoLoopscalePermUpdateStrategy",
      "type": "u64",
      "value": "4096"
    },
    {
      "name": "protoLoopscalePermWithdrawCollateral",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoLoopscalePermWithdrawStrategy",
      "type": "u64",
      "value": "16384"
    }
  ]
};
