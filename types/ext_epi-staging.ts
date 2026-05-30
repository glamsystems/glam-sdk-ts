/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_epi.json`.
 */
export type ExtEpi = {
  "address": "gstge5RzNEGQwpwBPKTJbP9yczoFEzzm5upSSsie9fX",
  "metadata": {
    "name": "extEpi",
    "version": "1.0.0",
    "spec": "0.1.0",
    "description": "External Position Integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "refreshPricedProtocol",
      "docs": [
        "Republish the aggregate EPI priced protocol from already validated",
        "observations at the current slot."
      ],
      "discriminator": [
        229,
        89,
        39,
        46,
        5,
        217,
        10,
        192
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamSigner",
          "signer": true
        },
        {
          "name": "observationState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  115,
                  101,
                  114,
                  118,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ]
          }
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
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        }
      ],
      "args": []
    },
    {
      "name": "removeExternalPosition",
      "docs": [
        "Remove an external position from the registry.",
        "Closes the observation state PDA and refunds rent to the signer."
      ],
      "discriminator": [
        97,
        146,
        246,
        241,
        130,
        26,
        108,
        97
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
          "name": "observationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  115,
                  101,
                  114,
                  118,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ]
          }
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
          "name": "positionId",
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
      "name": "submitExternalObservation",
      "docs": [
        "Submit an observation for a configured external position.",
        "Writes to pending slot; replaces any existing pending observation."
      ],
      "discriminator": [
        100,
        228,
        147,
        149,
        22,
        28,
        158,
        163
      ],
      "accounts": [
        {
          "name": "glamState"
        },
        {
          "name": "glamSigner",
          "signer": true
        },
        {
          "name": "observationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  115,
                  101,
                  114,
                  118,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "input",
          "type": {
            "defined": {
              "name": "positionObservationInput"
            }
          }
        }
      ]
    },
    {
      "name": "upsertExternalPosition",
      "docs": [
        "Create or update an external position configuration.",
        "Creates the observation state PDA on first call for a position."
      ],
      "discriminator": [
        199,
        33,
        239,
        150,
        200,
        123,
        43,
        70
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
          "name": "observationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  115,
                  101,
                  114,
                  118,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ]
          }
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
          "name": "config",
          "type": {
            "defined": {
              "name": "externalPositionConfig"
            }
          }
        }
      ]
    },
    {
      "name": "validateExternalObservation",
      "docs": [
        "Validate a pending observation, promote it to active, and publish",
        "the full aggregate priced protocol for ext_epi.",
        "",
        "Remaining accounts:",
        "- `remaining_accounts[0]` is required when the pending observation",
        "denomination is a non-base mint; it must be the observed mint oracle",
        "account used for price normalization."
      ],
      "discriminator": [
        88,
        144,
        219,
        126,
        79,
        29,
        43,
        188
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "glamSigner",
          "signer": true
        },
        {
          "name": "observationState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  98,
                  115,
                  101,
                  114,
                  118,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              }
            ]
          }
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
          "name": "glamConfig",
          "docs": [
            "and its discriminator is checked by AssetMetasRef before use."
          ],
          "optional": true,
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
            ],
            "program": {
              "kind": "const",
              "value": [
                10,
                11,
                0,
                83,
                72,
                16,
                46,
                144,
                46,
                42,
                79,
                22,
                157,
                123,
                21,
                242,
                192,
                146,
                1,
                78,
                88,
                59,
                102,
                9,
                190,
                226,
                92,
                189,
                187,
                232,
                83,
                220
              ]
            }
          }
        },
        {
          "name": "solUsdOracle",
          "docs": [
            "against GLAM global oracle metadata before price use."
          ],
          "optional": true
        },
        {
          "name": "baseAssetOracle",
          "docs": [
            "GLAM global oracle metadata before price use."
          ],
          "optional": true
        },
        {
          "name": "glamProtocolProgram",
          "address": "gstgptmbgJVi5f8ZmSRVZjZkDQwqKa3xWuUtD5WmJHz"
        }
      ],
      "args": [
        {
          "name": "positionId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "observationState",
      "discriminator": [
        122,
        174,
        197,
        53,
        129,
        9,
        165,
        132
      ]
    },
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
      "name": "denomination",
      "docs": [
        "Denomination of an observation amount.",
        "Never reorder existing variants — append only."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "usd"
          },
          {
            "name": "mint"
          }
        ]
      }
    },
    {
      "name": "denominationSpec",
      "docs": [
        "Full denomination spec: the discriminant plus an optional mint pubkey."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "denom",
            "type": {
              "defined": {
                "name": "denomination"
              }
            }
          },
          {
            "name": "mint",
            "docs": [
              "Only meaningful when `denom == Denomination::Mint`.",
              "Set to `Pubkey::default()` for `Usd`."
            ],
            "type": "pubkey"
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
      "name": "externalPositionConfig",
      "docs": [
        "Per-position configuration entry in the registry."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionId",
            "docs": [
              "Unique identifier for this position within the vault.",
              "",
              "Under the cleaner pricing model, this 32-byte id is also the canonical",
              "coverage key published into `glam_state.external_positions` and",
              "`PricedProtocol.positions`. For bridge-managed inflight transfers, this",
              "should be the transfer-record pubkey bytes."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "positionType",
            "docs": [
              "Type of position (Valued or Tokenized)."
            ],
            "type": {
              "defined": {
                "name": "externalPositionType"
              }
            }
          },
          {
            "name": "sourceType",
            "docs": [
              "Source type (Trusted or Native)."
            ],
            "type": {
              "defined": {
                "name": "externalSourceType"
              }
            }
          },
          {
            "name": "denomination",
            "docs": [
              "Denomination rules for Trusted positions.",
              "For Native positions this is ignored (denomination derived from custody)."
            ],
            "type": {
              "defined": {
                "name": "denominationSpec"
              }
            }
          },
          {
            "name": "nativeCustodyAccount",
            "docs": [
              "Custody account for Native positions. `Pubkey::default()` for Trusted."
            ],
            "type": "pubkey"
          },
          {
            "name": "nativeCustodyKind",
            "docs": [
              "Custody kind for Native positions."
            ],
            "type": {
              "defined": {
                "name": "nativeCustodyKind"
              }
            }
          },
          {
            "name": "enabled",
            "docs": [
              "Whether this position is enabled for observations."
            ],
            "type": "bool"
          },
          {
            "name": "freshnessOverrideSecs",
            "docs": [
              "Freshness override in seconds. 0 means use vault default."
            ],
            "type": "u32"
          },
          {
            "name": "submitAllowlist",
            "docs": [
              "Per-position submit allowlist. Empty vec = use role-based access only."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "validateAllowlist",
            "docs": [
              "Per-position validate allowlist. Empty vec = use role-based access only."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "configureAllowlist",
            "docs": [
              "Per-position configure allowlist. Empty vec = use role-based access only.",
              "This is intentionally more permissive than the protocol-wide asset",
              "allowlist semantics where an empty allowlist means deny all."
            ],
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "externalPositionType",
      "docs": [
        "Type of external position.",
        "Never reorder existing variants — append only."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "valued"
          },
          {
            "name": "tokenized"
          }
        ]
      }
    },
    {
      "name": "externalSourceType",
      "docs": [
        "Source of observation data.",
        "Never reorder existing variants — append only."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "trusted"
          },
          {
            "name": "native"
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
      "name": "nativeCustodyKind",
      "docs": [
        "Custody kind for Native source positions.",
        "Never reorder existing variants — append only."
      ],
      "repr": {
        "kind": "rust"
      },
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "splToken"
          },
          {
            "name": "nativeSol"
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
      "name": "observation",
      "docs": [
        "A single observation snapshot."
      ],
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "docs": [
              "Signed amount in the observation's denomination."
            ],
            "type": {
              "defined": {
                "name": "storedI128"
              }
            }
          },
          {
            "name": "denomination",
            "docs": [
              "Denomination of the amount."
            ],
            "type": {
              "defined": {
                "name": "denominationSpec"
              }
            }
          },
          {
            "name": "padDenom",
            "docs": [
              "Alignment padding after denomination (to 8-byte boundary for i64)."
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "observationTimestamp",
            "docs": [
              "Unix timestamp of the observation."
            ],
            "type": "i64"
          },
          {
            "name": "externalShares",
            "docs": [
              "External share count (for Tokenized positions)."
            ],
            "type": "u64"
          },
          {
            "name": "submittedBy",
            "docs": [
              "Signer who submitted this observation."
            ],
            "type": "pubkey"
          },
          {
            "name": "submittedAtSlot",
            "docs": [
              "Slot at which this observation was submitted."
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "observationState",
      "docs": [
        "Single PDA per vault that tracks all external position observations.",
        "Seeds: [SEED_OBSERVATION_STATE, glam_state.key()]"
      ],
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "glamState",
            "docs": [
              "The glam_state this observation state belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "positionsLen",
            "docs": [
              "Number of active positions stored in `positions`."
            ],
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          },
          {
            "name": "positions",
            "docs": [
              "Per-position observation entries."
            ],
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "positionObservation"
                  }
                },
                16
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
      "name": "positionObservation",
      "docs": [
        "Observation data for a single position, stored inline in `ObservationState`."
      ],
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionId",
            "docs": [
              "The position_id this entry tracks."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "hasPending",
            "docs": [
              "Whether a pending observation exists."
            ],
            "type": "bool"
          },
          {
            "name": "padPending",
            "docs": [
              "Alignment padding after has_pending (to 8-byte boundary for Observation)."
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "pendingObservation",
            "docs": [
              "The pending observation (only valid when `has_pending == true`)."
            ],
            "type": {
              "defined": {
                "name": "observation"
              }
            }
          },
          {
            "name": "hasValidated",
            "docs": [
              "Whether a validated observation exists."
            ],
            "type": "bool"
          },
          {
            "name": "padValidated",
            "docs": [
              "Alignment padding after has_validated (to 8-byte boundary for Observation)."
            ],
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "lastValidatedObservation",
            "docs": [
              "The last validated observation (only valid when `has_validated == true`)."
            ],
            "type": {
              "defined": {
                "name": "observation"
              }
            }
          },
          {
            "name": "validatedBy",
            "docs": [
              "Signer who last validated."
            ],
            "type": "pubkey"
          },
          {
            "name": "validatedAtSlot",
            "docs": [
              "Slot at which last validation occurred."
            ],
            "type": "u64"
          },
          {
            "name": "validatedBaseAssetAmount",
            "docs": [
              "Base-asset-normalized amount from the last validated observation.",
              "This is the value that contributes to the aggregate priced protocol."
            ],
            "type": {
              "defined": {
                "name": "storedI128"
              }
            }
          }
        ]
      }
    },
    {
      "name": "positionObservationInput",
      "docs": [
        "Observation data submitted by a caller."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "positionId",
            "docs": [
              "The position being observed, identified by position_id.",
              "The same 32-byte id is used as the canonical AUM coverage key."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "docs": [
              "Signed amount in the position's denomination.",
              "Positive = asset, negative = liability."
            ],
            "type": "i128"
          },
          {
            "name": "denomination",
            "docs": [
              "Denomination of the amount."
            ],
            "type": {
              "defined": {
                "name": "denominationSpec"
              }
            }
          },
          {
            "name": "observationTimestamp",
            "docs": [
              "Unix timestamp of the observation."
            ],
            "type": "i64"
          },
          {
            "name": "externalShares",
            "docs": [
              "External share count (required > 0 for Tokenized positions, 0 for Valued)."
            ],
            "type": "u64"
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved for future use."
            ],
            "type": {
              "array": [
                "u8",
                128
              ]
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
      "name": "storedI128",
      "docs": [
        "Byte-backed i128 storage that keeps the containing zero-copy account 8-byte aligned."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bytes",
            "type": {
              "array": [
                "u8",
                16
              ]
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
    }
  ],
  "constants": [
    {
      "name": "protoEpi",
      "type": "u16",
      "value": "1"
    },
    {
      "name": "protoEpiPermConfigure",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoEpiPermSubmitObservation",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoEpiPermValidateObservation",
      "type": "u64",
      "value": "4"
    }
  ]
};
