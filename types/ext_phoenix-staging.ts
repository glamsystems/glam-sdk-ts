/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_phoenix.json`.
 */
export type ExtPhoenix = {
  "address": "gstgPL7r9aYedDDsXNtLpr4atYtNvY7zubAWWstqS3L",
  "metadata": {
    "name": "extPhoenix",
    "version": "0.1.1",
    "spec": "0.1.0",
    "description": "Phoenix and Ember integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "cancelAll",
      "docs": [
        "Cancels all of the trader's resting orders on the market identified by the orderbook account."
      ],
      "discriminator": [
        98,
        191,
        75,
        220,
        115,
        40,
        71,
        237
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancelOrdersById",
      "docs": [
        "Cancels specific resting orders by their order IDs."
      ],
      "discriminator": [
        234,
        204,
        126,
        94,
        222,
        22,
        141,
        24
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "orderIds",
          "type": {
            "defined": {
              "name": "orderIds"
            }
          }
        }
      ]
    },
    {
      "name": "cancelUpTo",
      "docs": [
        "Cancels orders on one side of the book up to an optional count and/or tick limit."
      ],
      "discriminator": [
        26,
        209,
        244,
        253,
        59,
        175,
        227,
        54
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
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
              "name": "cancelUpToInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "deposit",
      "docs": [
        "Ember deposit: converts the vault's input mint into the Phoenix-side output mint."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
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
          "address": "EMBERpYNE6ehWmXymZZS2skiFmCa9V5dp14e1iduM5qy"
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
          "name": "emberState"
        },
        {
          "name": "inputMint"
        },
        {
          "name": "outputMint",
          "writable": true
        },
        {
          "name": "inputTokenAccount",
          "writable": true
        },
        {
          "name": "outputTokenAccount",
          "writable": true
        },
        {
          "name": "emberVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "depositParams",
          "type": {
            "defined": {
              "name": "depositParams"
            }
          }
        }
      ]
    },
    {
      "name": "depositFunds",
      "docs": [
        "Deposits base or quote mint tokens from the vault's token account into the Phoenix trader account."
      ],
      "discriminator": [
        202,
        39,
        52,
        211,
        53,
        20,
        250,
        88
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "depositFundsInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "placeLimitOrder",
      "docs": [
        "Places a limit order; the unfilled portion rests on the orderbook."
      ],
      "discriminator": [
        108,
        176,
        33,
        186,
        146,
        229,
        1,
        197
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "packet",
          "type": {
            "defined": {
              "name": "orderPacket"
            }
          }
        }
      ]
    },
    {
      "name": "placeMarketOrder",
      "docs": [
        "Places an immediate-or-cancel market order; unfilled size is dropped rather than rested."
      ],
      "discriminator": [
        90,
        118,
        192,
        252,
        192,
        99,
        39,
        145
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "packet",
          "type": {
            "defined": {
              "name": "orderPacket"
            }
          }
        }
      ]
    },
    {
      "name": "placeMultiLimitOrder",
      "docs": [
        "Places multiple limit orders (bids and/or asks) on a single market in one CPI."
      ],
      "discriminator": [
        236,
        208,
        221,
        172,
        141,
        226,
        129,
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "packet",
          "type": {
            "defined": {
              "name": "multipleOrderPacket"
            }
          }
        }
      ]
    },
    {
      "name": "registerTrader",
      "docs": [
        "Initializes a Phoenix trader account (parent or child subaccount) owned by the vault."
      ],
      "discriminator": [
        75,
        243,
        224,
        167,
        1,
        5,
        51,
        32
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "logAuthority"
        },
        {
          "name": "globalConfig"
        },
        {
          "name": "traderAccount",
          "writable": true
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
              "name": "registerTraderParams"
            }
          }
        }
      ]
    },
    {
      "name": "setPhoenixPolicy",
      "docs": [
        "Sets the GLAM Phoenix policy (market allowlist, order types, and price-deviation limits) on the vault state."
      ],
      "discriminator": [
        57,
        235,
        161,
        196,
        65,
        41,
        80,
        85
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
              "name": "phoenixPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "syncParentToChild",
      "docs": [
        "Syncs collateral and state from a parent trader account down to a child subaccount."
      ],
      "discriminator": [
        175,
        137,
        217,
        11,
        235,
        39,
        150,
        19
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "transferCollateral",
      "docs": [
        "Transfers collateral from a source trader subaccount to a destination trader subaccount."
      ],
      "discriminator": [
        157,
        163,
        63,
        27,
        242,
        72,
        251,
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "transferCollateralInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "transferCollateralChildToParent",
      "docs": [
        "Transfers collateral from a child subaccount back to its parent trader account."
      ],
      "discriminator": [
        51,
        100,
        177,
        115,
        139,
        135,
        247,
        139
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "transferCollateralChildToParentInstruction"
            }
          }
        }
      ]
    },
    {
      "name": "updateTraderState",
      "docs": [
        "Refreshes the trader account's cached state (PnL, funding, margin) against current market data."
      ],
      "discriminator": [
        249,
        139,
        82,
        44,
        126,
        66,
        133,
        220
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
      "docs": [
        "Ember withdraw: converts the Phoenix-side output mint back to the input mint; `None` = full balance."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
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
          "address": "EMBERpYNE6ehWmXymZZS2skiFmCa9V5dp14e1iduM5qy"
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
          "name": "emberState"
        },
        {
          "name": "inputMint"
        },
        {
          "name": "outputMint",
          "writable": true
        },
        {
          "name": "inputTokenAccount",
          "writable": true
        },
        {
          "name": "outputTokenAccount",
          "writable": true
        },
        {
          "name": "emberVault",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "withdrawParams",
          "type": {
            "defined": {
              "name": "withdrawParams"
            }
          }
        }
      ]
    },
    {
      "name": "withdrawFunds",
      "docs": [
        "Withdraws base or quote mint tokens from the Phoenix trader account back to the vault's token account."
      ],
      "discriminator": [
        241,
        36,
        29,
        111,
        208,
        31,
        104,
        217
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
          "address": "EtrnLzgbS7nMMy5fbD42kXiUzGg8XQzJ972Xtk1cjWih"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "withdrawFundsInstruction"
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
      "name": "payloadTooLarge",
      "msg": "Phoenix packet payload is too large"
    },
    {
      "code": 6001,
      "name": "marketNotAllowed",
      "msg": "Market is not allowed by Phoenix policy"
    },
    {
      "code": 6002,
      "name": "orderSizeExceeded",
      "msg": "Order size exceeds Phoenix policy"
    },
    {
      "code": 6003,
      "name": "riskIncreasingOrderDisabled",
      "msg": "Risk-increasing orders are disabled by Phoenix policy"
    },
    {
      "code": 6004,
      "name": "reduceOnlyRequired",
      "msg": "Order must be reduce-only by Phoenix policy"
    },
    {
      "code": 6005,
      "name": "missingReferencePrice",
      "msg": "Missing reference price for Phoenix price tolerance check"
    },
    {
      "code": 6006,
      "name": "priceDeviationExceeded",
      "msg": "Order price exceeds Phoenix price tolerance"
    },
    {
      "code": 6007,
      "name": "invalidPhoenixAccount",
      "msg": "Invalid Phoenix account"
    },
    {
      "code": 6008,
      "name": "invalidEmberMint",
      "msg": "Invalid Ember mint"
    },
    {
      "code": 6009,
      "name": "invalidEmberTokenAccount",
      "msg": "Invalid Ember token account"
    },
    {
      "code": 6010,
      "name": "emberAmountExceeded",
      "msg": "Ember conversion amount exceeds policy"
    },
    {
      "code": 6011,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6012,
      "name": "invalidPhoenixAccountOrder",
      "msg": "Invalid Phoenix account order"
    },
    {
      "code": 6013,
      "name": "duplicateAccount",
      "msg": "Duplicate account"
    },
    {
      "code": 6014,
      "name": "unexpectedSigner",
      "msg": "Unexpected signer account"
    },
    {
      "code": 6015,
      "name": "invalidPhoenixPda",
      "msg": "Invalid Phoenix PDA"
    },
    {
      "code": 6016,
      "name": "invalidOrderPacket",
      "msg": "Invalid Phoenix order packet"
    },
    {
      "code": 6017,
      "name": "invalidOrderType",
      "msg": "Invalid Phoenix order type"
    },
    {
      "code": 6018,
      "name": "invalidOrderFlags",
      "msg": "Invalid Phoenix order flags"
    },
    {
      "code": 6019,
      "name": "invalidTraderCapability",
      "msg": "Invalid Phoenix trader capability"
    },
    {
      "code": 6020,
      "name": "duplicateTraderCapability",
      "msg": "Duplicate Phoenix trader capability"
    },
    {
      "code": 6021,
      "name": "emptyTraderCapabilityUpdates",
      "msg": "Trader capability updates must not be empty"
    },
    {
      "code": 6022,
      "name": "tooManyTraderCapabilityUpdates",
      "msg": "Too many trader capability updates"
    },
    {
      "code": 6023,
      "name": "invalidCancelLimit",
      "msg": "Invalid cancel-up-to limit"
    },
    {
      "code": 6024,
      "name": "glamVaultLamportsDecreased",
      "msg": "GLAM vault lamports decreased during external CPI"
    },
    {
      "code": 6025,
      "name": "tooManyPhoenixMarkets",
      "msg": "Too many Phoenix markets in policy allowlist"
    },
    {
      "code": 6026,
      "name": "invalidPhoenixPolicy",
      "msg": "Invalid Phoenix policy"
    },
    {
      "code": 6027,
      "name": "invalidReferencePriceTimestamp",
      "msg": "Invalid Phoenix reference price timestamp"
    },
    {
      "code": 6028,
      "name": "referencePriceStale",
      "msg": "Phoenix reference price is stale"
    },
    {
      "code": 6029,
      "name": "orderTypeNotAllowed",
      "msg": "Phoenix order type is not allowed by policy"
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
      "name": "baseLots",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "inner",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "cancelId",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nodePointer",
            "type": {
              "defined": {
                "name": "nodePointer"
              }
            }
          },
          {
            "name": "orderId",
            "type": {
              "defined": {
                "name": "fifoOrderId"
              }
            }
          }
        ]
      }
    },
    {
      "name": "cancelUpToInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "side",
            "type": {
              "defined": {
                "name": "side"
              }
            }
          },
          {
            "name": "numOrdersToCancel",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "tickLimit",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    },
    {
      "name": "condensedOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "priceInTicks",
            "type": "u64"
          },
          {
            "name": "sizeInBaseLots",
            "type": "u64"
          },
          {
            "name": "lastValidSlot",
            "type": {
              "option": "u64"
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
      "name": "depositFundsInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
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
      "name": "fifoOrderId",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "priceInTicks",
            "type": {
              "defined": {
                "name": "ticks"
              }
            }
          },
          {
            "name": "orderSequenceNumber",
            "type": "u64"
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
      "name": "multipleOrderPacket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bids",
            "type": {
              "vec": {
                "defined": {
                  "name": "condensedOrder"
                }
              }
            }
          },
          {
            "name": "asks",
            "type": {
              "vec": {
                "defined": {
                  "name": "condensedOrder"
                }
              }
            }
          },
          {
            "name": "clientOrderId",
            "type": {
              "option": {
                "array": [
                  "u8",
                  16
                ]
              }
            }
          },
          {
            "name": "slide",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "nodePointer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "value",
            "type": "u32"
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
      "name": "orderFlags",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "flags",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "orderIds",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderIds",
            "type": {
              "vec": {
                "defined": {
                  "name": "cancelId"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "orderPacket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "orderPacketKind"
              }
            }
          }
        ]
      }
    },
    {
      "name": "orderPacketKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "postOnly",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": {
                    "name": "side"
                  }
                }
              },
              {
                "name": "priceInTicks",
                "type": {
                  "defined": {
                    "name": "ticks"
                  }
                }
              },
              {
                "name": "numBaseLots",
                "type": {
                  "defined": {
                    "name": "baseLots"
                  }
                }
              },
              {
                "name": "clientOrderId",
                "type": {
                  "array": [
                    "u8",
                    16
                  ]
                }
              },
              {
                "name": "slide",
                "type": "bool"
              },
              {
                "name": "lastValidSlot",
                "type": {
                  "option": "u64"
                }
              },
              {
                "name": "orderFlags",
                "type": {
                  "defined": {
                    "name": "orderFlags"
                  }
                }
              },
              {
                "name": "cancelExisting",
                "type": "bool"
              }
            ]
          },
          {
            "name": "limit",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": {
                    "name": "side"
                  }
                }
              },
              {
                "name": "priceInTicks",
                "type": {
                  "defined": {
                    "name": "ticks"
                  }
                }
              },
              {
                "name": "numBaseLots",
                "type": {
                  "defined": {
                    "name": "baseLots"
                  }
                }
              },
              {
                "name": "selfTradeBehavior",
                "type": {
                  "defined": {
                    "name": "selfTradeBehavior"
                  }
                }
              },
              {
                "name": "matchLimit",
                "type": {
                  "option": "u64"
                }
              },
              {
                "name": "clientOrderId",
                "type": {
                  "array": [
                    "u8",
                    16
                  ]
                }
              },
              {
                "name": "lastValidSlot",
                "type": {
                  "option": "u64"
                }
              },
              {
                "name": "orderFlags",
                "type": {
                  "defined": {
                    "name": "orderFlags"
                  }
                }
              },
              {
                "name": "cancelExisting",
                "type": "bool"
              }
            ]
          },
          {
            "name": "immediateOrCancel",
            "fields": [
              {
                "name": "side",
                "type": {
                  "defined": {
                    "name": "side"
                  }
                }
              },
              {
                "name": "priceInTicks",
                "type": {
                  "option": {
                    "defined": {
                      "name": "ticks"
                    }
                  }
                }
              },
              {
                "name": "numBaseLots",
                "type": {
                  "defined": {
                    "name": "baseLots"
                  }
                }
              },
              {
                "name": "numQuoteLots",
                "type": {
                  "option": {
                    "defined": {
                      "name": "quoteLots"
                    }
                  }
                }
              },
              {
                "name": "minBaseLotsToFill",
                "type": {
                  "defined": {
                    "name": "baseLots"
                  }
                }
              },
              {
                "name": "minQuoteLotsToFill",
                "type": {
                  "defined": {
                    "name": "quoteLots"
                  }
                }
              },
              {
                "name": "selfTradeBehavior",
                "type": {
                  "defined": {
                    "name": "selfTradeBehavior"
                  }
                }
              },
              {
                "name": "matchLimit",
                "type": {
                  "option": "u64"
                }
              },
              {
                "name": "clientOrderId",
                "type": {
                  "array": [
                    "u8",
                    16
                  ]
                }
              },
              {
                "name": "lastValidSlot",
                "type": {
                  "option": "u64"
                }
              },
              {
                "name": "orderFlags",
                "type": {
                  "defined": {
                    "name": "orderFlags"
                  }
                }
              },
              {
                "name": "cancelExisting",
                "type": "bool"
              }
            ]
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
      "name": "phoenixPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "marketsAllowlist",
            "docs": [
              "Phoenix markets the vault is allowed to trade on. Any order routed to a",
              "market outside this list is rejected with `MarketNotAllowed`. Capped at",
              "`MAX_PHOENIX_MARKETS_ALLOWLIST` entries; duplicates and the default",
              "pubkey are rejected by `validate_for_set`. An empty list disables all",
              "trading."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "allowedOrderTypes",
            "docs": [
              "Allowed Phoenix `OrderPacketKind` discriminants. Current values are:",
              "`0 = PostOnly`, `1 = Limit`, and `2 = ImmediateOrCancel`. An empty list",
              "disables all order placement."
            ],
            "type": "bytes"
          },
          {
            "name": "requireReduceOnlyOrders",
            "docs": [
              "When `true`, every order must have the reduce-only flag set; orders",
              "without it are rejected with `ReduceOnlyRequired`. Use this to lock the",
              "vault into pure position-unwinding mode."
            ],
            "type": "bool"
          },
          {
            "name": "maxPriceDeviationBps",
            "docs": [
              "Maximum allowed deviation in basis points. Retained in policy state for",
              "future enforcement; currently not checked by order placement."
            ],
            "type": "u16"
          },
          {
            "name": "maxReferencePriceAgeSecs",
            "docs": [
              "Maximum reference price age in seconds. Retained in policy state for",
              "future enforcement; currently not checked by order placement."
            ],
            "type": "u32"
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
      "name": "quoteLots",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "inner",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "registerTraderParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maxPositions",
            "type": "u64"
          },
          {
            "name": "traderPdaIndex",
            "type": "u8"
          },
          {
            "name": "traderSubaccountIndex",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "selfTradeBehavior",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "abort"
          },
          {
            "name": "cancelProvide"
          },
          {
            "name": "decrementTake"
          }
        ]
      }
    },
    {
      "name": "side",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bid"
          },
          {
            "name": "ask"
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
      "name": "ticks",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "inner",
            "type": "u64"
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
      "name": "transferCollateralChildToParentInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "transferCollateralInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
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
      "name": "withdrawFundsInstruction",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "withdrawParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": {
              "option": "u64"
            }
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "phoenixPermCancelOrders",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "phoenixPermCreateModifyOrders",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "phoenixPermDeposit",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "phoenixPermInitTrader",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "phoenixPermTransferCollateral",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "phoenixPermUpdateTraderState",
      "type": "u64",
      "value": "64"
    },
    {
      "name": "phoenixPermWithdraw",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoPhoenix",
      "type": "u16",
      "value": "1"
    }
  ]
};
