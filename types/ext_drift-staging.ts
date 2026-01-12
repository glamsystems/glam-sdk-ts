/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_drift.json`.
 */
export type ExtDrift = {
  "address": "gstgdpMFXKobURsFtStdaMLRSuwdmDUsrndov7kyu9h",
  "metadata": {
    "name": "extDrift",
    "version": "1.0.0",
    "spec": "0.1.0",
    "description": "Drift integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "cancelOrders",
      "discriminator": [
        238,
        225,
        95,
        158,
        227,
        103,
        8,
        194
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "marketType",
          "type": {
            "option": {
              "defined": {
                "name": "marketType"
              }
            }
          }
        },
        {
          "name": "marketIndex",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "direction",
          "type": {
            "option": {
              "defined": {
                "name": "positionDirection"
              }
            }
          }
        }
      ]
    },
    {
      "name": "cancelOrdersByIds",
      "discriminator": [
        134,
        19,
        144,
        165,
        94,
        240,
        210,
        94
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "orderIds",
          "type": {
            "vec": "u32"
          }
        }
      ]
    },
    {
      "name": "deleteUser",
      "discriminator": [
        186,
        85,
        17,
        249,
        219,
        231,
        98,
        251
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "user",
          "writable": true
        },
        {
          "name": "userStats",
          "writable": true
        },
        {
          "name": "state",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "userStats",
          "writable": true
        },
        {
          "name": "spotMarketVault",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u16"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reduceOnly",
          "type": "bool"
        }
      ]
    },
    {
      "name": "initializeUser",
      "discriminator": [
        111,
        17,
        185,
        250,
        60,
        122,
        38,
        254
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "userStats",
          "writable": true
        },
        {
          "name": "state",
          "writable": true
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
          "name": "subAccountId",
          "type": "u16"
        },
        {
          "name": "name",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "initializeUserStats",
      "discriminator": [
        254,
        243,
        72,
        98,
        251,
        130,
        168,
        213
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "userStats",
          "writable": true
        },
        {
          "name": "state",
          "writable": true
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
      "args": []
    },
    {
      "name": "modifyOrder",
      "discriminator": [
        47,
        124,
        117,
        255,
        201,
        197,
        130,
        94
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "orderId",
          "type": {
            "option": "u32"
          }
        },
        {
          "name": "modifyOrderParams",
          "type": {
            "defined": {
              "name": "modifyOrderParams"
            }
          }
        }
      ]
    },
    {
      "name": "placeOrders",
      "discriminator": [
        60,
        63,
        50,
        123,
        12,
        197,
        60,
        190
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "vec": {
              "defined": {
                "name": "orderParams"
              }
            }
          }
        }
      ]
    },
    {
      "name": "reclaimRent",
      "discriminator": [
        218,
        200,
        19,
        197,
        227,
        89,
        192,
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "user",
          "writable": true
        },
        {
          "name": "userStats",
          "writable": true
        },
        {
          "name": "state"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "setDriftProtocolPolicy",
      "discriminator": [
        200,
        22,
        110,
        2,
        58,
        22,
        76,
        162
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
              "name": "driftProtocolPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "setDriftVaultsPolicy",
      "discriminator": [
        168,
        134,
        53,
        33,
        18,
        88,
        142,
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
              "name": "driftVaultsPolicy"
            }
          }
        }
      ]
    },
    {
      "name": "settleMultiplePnls",
      "discriminator": [
        127,
        66,
        117,
        57,
        40,
        50,
        152,
        127
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "spotMarketVault"
        }
      ],
      "args": [
        {
          "name": "marketIndexes",
          "type": {
            "vec": "u16"
          }
        },
        {
          "name": "mode",
          "type": {
            "defined": {
              "name": "settlePnlMode"
            }
          }
        }
      ]
    },
    {
      "name": "settlePnl",
      "discriminator": [
        43,
        61,
        234,
        45,
        15,
        95,
        152,
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "spotMarketVault"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateUserCustomMarginRatio",
      "discriminator": [
        21,
        221,
        140,
        187,
        32,
        129,
        11,
        123
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "subAccountId",
          "type": "u16"
        },
        {
          "name": "marginRatio",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateUserDelegate",
      "discriminator": [
        139,
        205,
        141,
        141,
        113,
        36,
        94,
        187
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "subAccountId",
          "type": "u16"
        },
        {
          "name": "delegate",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateUserMarginTradingEnabled",
      "discriminator": [
        194,
        92,
        204,
        223,
        246,
        188,
        31,
        203
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "subAccountId",
          "type": "u16"
        },
        {
          "name": "marginTradingEnabled",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateUserPoolId",
      "discriminator": [
        219,
        86,
        73,
        106,
        56,
        218,
        128,
        109
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "user",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "subAccountId",
          "type": "u16"
        },
        {
          "name": "poolId",
          "type": "u8"
        }
      ]
    },
    {
      "name": "vaultsCancelRequestWithdraw",
      "discriminator": [
        188,
        93,
        159,
        202,
        157,
        47,
        143,
        219
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
          "address": "vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR"
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
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultDepositor",
          "writable": true
        },
        {
          "name": "driftUserStats"
        },
        {
          "name": "driftUser"
        }
      ],
      "args": []
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
          "address": "vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR"
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
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultDepositor",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "driftUserStats",
          "writable": true
        },
        {
          "name": "driftUser",
          "writable": true
        },
        {
          "name": "driftState"
        },
        {
          "name": "driftSpotMarketVault",
          "writable": true
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "driftProgram"
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
      "name": "vaultsInitializeVaultDepositor",
      "discriminator": [
        135,
        5,
        41,
        254,
        229,
        75,
        138,
        49
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
          "address": "vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR"
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        },
        {
          "name": "vault"
        },
        {
          "name": "vaultDepositor",
          "writable": true
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
      "args": []
    },
    {
      "name": "vaultsRequestWithdraw",
      "discriminator": [
        138,
        91,
        50,
        130,
        167,
        165,
        120,
        175
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
          "address": "vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR"
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
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultDepositor",
          "writable": true
        },
        {
          "name": "driftUserStats"
        },
        {
          "name": "driftUser"
        }
      ],
      "args": [
        {
          "name": "withdrawAmount",
          "type": "u64"
        },
        {
          "name": "withdrawUnit",
          "type": {
            "defined": {
              "name": "withdrawUnit"
            }
          }
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
          "address": "vAuLTsyrvSfZRuRB3XgvkPwNGgYSs9YRYymVebLKoxR"
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
          "name": "vault",
          "writable": true
        },
        {
          "name": "vaultDepositor",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "driftUserStats",
          "writable": true
        },
        {
          "name": "driftUser",
          "writable": true
        },
        {
          "name": "driftState"
        },
        {
          "name": "driftSpotMarketVault",
          "writable": true
        },
        {
          "name": "driftSigner"
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "driftProgram"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "withdraw",
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
          "address": "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
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
          "name": "state"
        },
        {
          "name": "user",
          "writable": true
        },
        {
          "name": "userStats",
          "writable": true
        },
        {
          "name": "spotMarketVault",
          "writable": true
        },
        {
          "name": "driftSigner"
        },
        {
          "name": "userTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "marketIndex",
          "type": "u16"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reduceOnly",
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
      "name": "driftProtocolPolicy",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "spotMarketsAllowlist",
            "type": {
              "vec": "u16"
            }
          },
          {
            "name": "perpMarketsAllowlist",
            "type": {
              "vec": "u16"
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
      "name": "driftVaultsPolicy",
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
          },
          {
            "name": "reduceOnly"
          },
          {
            "name": "anyLst"
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
      "name": "marketType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "spot"
          },
          {
            "name": "perp"
          }
        ]
      }
    },
    {
      "name": "modifyOrderParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "direction",
            "type": {
              "option": {
                "defined": {
                  "name": "positionDirection"
                }
              }
            }
          },
          {
            "name": "baseAssetAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "price",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "reduceOnly",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "postOnly",
            "type": {
              "option": {
                "defined": {
                  "name": "postOnlyParam"
                }
              }
            }
          },
          {
            "name": "bitFlags",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "maxTs",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "triggerPrice",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "triggerCondition",
            "type": {
              "option": {
                "defined": {
                  "name": "orderTriggerCondition"
                }
              }
            }
          },
          {
            "name": "oraclePriceOffset",
            "type": {
              "option": "i32"
            }
          },
          {
            "name": "auctionDuration",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "auctionStartPrice",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "auctionEndPrice",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "policy",
            "type": {
              "option": "u8"
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
      "name": "orderParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderType",
            "type": {
              "defined": {
                "name": "orderType"
              }
            }
          },
          {
            "name": "marketType",
            "type": {
              "defined": {
                "name": "marketType"
              }
            }
          },
          {
            "name": "direction",
            "type": {
              "defined": {
                "name": "positionDirection"
              }
            }
          },
          {
            "name": "userOrderId",
            "type": "u8"
          },
          {
            "name": "baseAssetAmount",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "marketIndex",
            "type": "u16"
          },
          {
            "name": "reduceOnly",
            "type": "bool"
          },
          {
            "name": "postOnly",
            "type": {
              "defined": {
                "name": "postOnlyParam"
              }
            }
          },
          {
            "name": "bitFlags",
            "type": "u8"
          },
          {
            "name": "maxTs",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "triggerPrice",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "triggerCondition",
            "type": {
              "defined": {
                "name": "orderTriggerCondition"
              }
            }
          },
          {
            "name": "oraclePriceOffset",
            "type": {
              "option": "i32"
            }
          },
          {
            "name": "auctionDuration",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "auctionStartPrice",
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "auctionEndPrice",
            "type": {
              "option": "i64"
            }
          }
        ]
      }
    },
    {
      "name": "orderTriggerCondition",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "above"
          },
          {
            "name": "below"
          },
          {
            "name": "triggeredAbove"
          },
          {
            "name": "triggeredBelow"
          }
        ]
      }
    },
    {
      "name": "orderType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "market"
          },
          {
            "name": "limit"
          },
          {
            "name": "triggerMarket"
          },
          {
            "name": "triggerLimit"
          },
          {
            "name": "oracle"
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
      "name": "positionDirection",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "long"
          },
          {
            "name": "short"
          }
        ]
      }
    },
    {
      "name": "postOnlyParam",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "none"
          },
          {
            "name": "mustPostOnly"
          },
          {
            "name": "tryPostOnly"
          },
          {
            "name": "slide"
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
      "name": "settlePnlMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "mustSettle"
          },
          {
            "name": "trySettle"
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
      "name": "withdrawUnit",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "shares"
          },
          {
            "name": "token"
          },
          {
            "name": "sharesPercent"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "protoDriftProtocol",
      "type": "u16",
      "value": "1"
    },
    {
      "name": "protoDriftProtocolPermBorrow",
      "type": "u64",
      "value": "32"
    },
    {
      "name": "protoDriftProtocolPermCancelOrders",
      "type": "u64",
      "value": "256"
    },
    {
      "name": "protoDriftProtocolPermCreateModifyOrders",
      "type": "u64",
      "value": "128"
    },
    {
      "name": "protoDriftProtocolPermDeleteUser",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoDriftProtocolPermDeposit",
      "type": "u64",
      "value": "8"
    },
    {
      "name": "protoDriftProtocolPermInitUser",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoDriftProtocolPermPerpMarkets",
      "type": "u64",
      "value": "512"
    },
    {
      "name": "protoDriftProtocolPermRepay",
      "type": "u64",
      "value": "64"
    },
    {
      "name": "protoDriftProtocolPermSpotMarkets",
      "type": "u64",
      "value": "1024"
    },
    {
      "name": "protoDriftProtocolPermUpdateUser",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoDriftProtocolPermWithdraw",
      "type": "u64",
      "value": "16"
    },
    {
      "name": "protoDriftVaults",
      "type": "u16",
      "value": "2"
    },
    {
      "name": "protoDriftVaultsPermDeposit",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoDriftVaultsPermWithdraw",
      "type": "u64",
      "value": "2"
    }
  ]
};
