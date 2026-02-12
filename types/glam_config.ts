/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/glam_config.json`.
 */
export type GlamConfig = {
  "address": "gConFzxKL9USmwTdJoeQJvfKmqhJ2CyUaXTyQ8v9TGX",
  "metadata": {
    "name": "glamConfig",
    "version": "1.0.0",
    "spec": "0.1.0",
    "description": "GLAM config program"
  },
  "instructions": [
    {
      "name": "close",
      "discriminator": [
        98,
        165,
        201,
        177,
        108,
        65,
        206,
        96
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "deprecateAssetMeta",
      "docs": [
        "Marks an asset meta as deprecated"
      ],
      "discriminator": [
        138,
        242,
        230,
        22,
        21,
        151,
        149,
        19
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "asset",
          "type": "pubkey"
        },
        {
          "name": "oracle",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "admin",
          "type": "pubkey"
        },
        {
          "name": "feeAuthority",
          "type": "pubkey"
        },
        {
          "name": "referrer",
          "type": "pubkey"
        },
        {
          "name": "baseFeeBps",
          "type": "u16"
        },
        {
          "name": "flowFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateAdmin",
      "discriminator": [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateFeeAuthority",
      "discriminator": [
        31,
        223,
        200,
        21,
        114,
        158,
        65,
        61
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeAuthority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "feeAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateProtocolFees",
      "discriminator": [
        158,
        219,
        253,
        143,
        54,
        45,
        113,
        182
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeAuthority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "baseFeeBps",
          "type": "u16"
        },
        {
          "name": "flowFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateReferrer",
      "discriminator": [
        208,
        225,
        56,
        15,
        244,
        21,
        195,
        34
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeAuthority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "referrer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "upsertAssetMeta",
      "discriminator": [
        29,
        40,
        115,
        194,
        215,
        146,
        222,
        212
      ],
      "accounts": [
        {
          "name": "globalConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  108,
                  111,
                  98,
                  97,
                  108,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "asset"
        },
        {
          "name": "oracle"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "assetMeta",
          "type": {
            "defined": {
              "name": "assetMeta"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6001,
      "name": "invalidAssetMeta",
      "msg": "Invalid asset meta"
    },
    {
      "code": 6002,
      "name": "invalidParameters",
      "msg": "Invalid fee parameters or insufficient account space"
    },
    {
      "code": 6003,
      "name": "invalidOracleSource",
      "msg": "Invalid oracle source"
    },
    {
      "code": 6004,
      "name": "invalidGlobalConfig",
      "msg": "Invalid or corrupted global config account"
    },
    {
      "code": 6005,
      "name": "invalidFeeAuthority",
      "msg": "Invalid fee authority"
    },
    {
      "code": 6006,
      "name": "assetMetaNotFound",
      "msg": "Asset meta not found"
    }
  ],
  "types": [
    {
      "name": "assetMeta",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "oracle",
            "type": "pubkey"
          },
          {
            "name": "oracleSource",
            "type": {
              "defined": {
                "name": "oracleSource"
              }
            }
          },
          {
            "name": "maxAgeSeconds",
            "type": "u16"
          },
          {
            "name": "priority",
            "type": "i8"
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
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "The authority that can modify the config"
            ],
            "type": "pubkey"
          },
          {
            "name": "feeAuthority",
            "docs": [
              "The authority that can modify fee structure of individual glam state and claim protocol fees"
            ],
            "type": "pubkey"
          },
          {
            "name": "referrer",
            "docs": [
              "Default GLAM referrer"
            ],
            "type": "pubkey"
          },
          {
            "name": "baseFeeBps",
            "docs": [
              "Default protocol base fee applied to all vaults"
            ],
            "type": "u16"
          },
          {
            "name": "flowFeeBps",
            "docs": [
              "Default protocol flow fee applied to all vaults"
            ],
            "type": "u16"
          },
          {
            "name": "assetMetas",
            "docs": [
              "List of assets and their oracle configs supported by the protocol"
            ],
            "type": {
              "vec": {
                "defined": {
                  "name": "assetMeta"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "oracleSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pyth"
          },
          {
            "name": "switchboard"
          },
          {
            "name": "quoteAsset"
          },
          {
            "name": "pyth1K"
          },
          {
            "name": "pyth1M"
          },
          {
            "name": "pythStableCoin"
          },
          {
            "name": "prelaunch"
          },
          {
            "name": "pythPull"
          },
          {
            "name": "pyth1KPull"
          },
          {
            "name": "pyth1MPull"
          },
          {
            "name": "pythStableCoinPull"
          },
          {
            "name": "switchboardOnDemand"
          },
          {
            "name": "pythLazer"
          },
          {
            "name": "pythLazer1K"
          },
          {
            "name": "pythLazer1M"
          },
          {
            "name": "pythLazerStableCoin"
          },
          {
            "name": "notSet"
          },
          {
            "name": "lstPoolState"
          },
          {
            "name": "marinadeState"
          },
          {
            "name": "baseAsset"
          },
          {
            "name": "chainlinkRwa"
          }
        ]
      }
    }
  ]
};
