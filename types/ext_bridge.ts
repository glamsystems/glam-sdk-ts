/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ext_bridge.json`.
 */
export type ExtBridge = {
  "address": "G1NTbnLcjMex9Tjo8ocmNK9S2zBCiGVuxKUUNGhYZztx",
  "metadata": {
    "name": "extBridge",
    "version": "1.0.0",
    "spec": "0.1.0",
    "description": "Bridge integration for GLAM Protocol"
  },
  "instructions": [
    {
      "name": "addLayerzeroOftRoute",
      "discriminator": [
        53,
        181,
        204,
        38,
        240,
        57,
        218,
        148
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
          "name": "route",
          "type": {
            "defined": {
              "name": "layerzeroOftRoute"
            }
          }
        }
      ]
    },
    {
      "name": "commitOftTransfer",
      "docs": [
        "Verifies the OFT send completed and records the resulting transfer."
      ],
      "discriminator": [
        246,
        116,
        17,
        13,
        64,
        227,
        248,
        78
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
          "name": "cpiProgram"
        },
        {
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "instructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
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
          "name": "bridgeSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              },
              {
                "kind": "arg",
                "path": "args.transfer_id"
              }
            ]
          }
        },
        {
          "name": "sourceTokenAccount",
          "writable": true
        },
        {
          "name": "sourceMint"
        },
        {
          "name": "auxiliaryTokenAccount",
          "writable": true
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "commitOftTransferArgs"
            }
          }
        }
      ]
    },
    {
      "name": "deleteLayerzeroOftRoute",
      "discriminator": [
        122,
        191,
        90,
        182,
        160,
        67,
        86,
        227
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
          "name": "route",
          "type": {
            "defined": {
              "name": "layerzeroOftRoute"
            }
          }
        }
      ]
    },
    {
      "name": "prepareOftTransfer",
      "docs": [
        "Prepares the auxiliary token account used by the OFT transfer flow."
      ],
      "discriminator": [
        192,
        75,
        97,
        92,
        178,
        246,
        220,
        8
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
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
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
          "name": "bridgeSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  115,
                  101,
                  115,
                  115,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "glamState"
              },
              {
                "kind": "arg",
                "path": "args.transfer_id"
              }
            ]
          }
        },
        {
          "name": "sourceTokenAccount",
          "writable": true
        },
        {
          "name": "sourceMint"
        },
        {
          "name": "auxiliaryTokenAccount",
          "writable": true
        },
        {
          "name": "cpiProgram"
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
          "name": "instructions",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "prepareOftTransferArgs"
            }
          }
        }
      ]
    },
    {
      "name": "priceManagedTransfers",
      "docs": [
        "Prices managed inflight transfers and publishes aggregated amount."
      ],
      "discriminator": [
        77,
        76,
        20,
        48,
        41,
        168,
        205,
        81
      ],
      "accounts": [
        {
          "name": "glamState",
          "writable": true
        },
        {
          "name": "bridgeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
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
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "glamConfig",
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
          "name": "baseAssetOracle"
        }
      ],
      "args": []
    },
    {
      "name": "settleManagedTransfer",
      "docs": [
        "Settles a managed inflight transfer and removes it from the registry."
      ],
      "discriminator": [
        197,
        87,
        37,
        239,
        24,
        244,
        152,
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
          "name": "glamProtocolProgram",
          "address": "GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz"
        },
        {
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "settleManagedTransferArgs"
            }
          }
        }
      ]
    },
    {
      "name": "updateLayerzeroOftRoute",
      "discriminator": [
        77,
        162,
        99,
        1,
        182,
        142,
        66,
        172
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
          "name": "route",
          "type": {
            "defined": {
              "name": "layerzeroOftRoute"
            }
          }
        }
      ]
    },
    {
      "name": "validateManagedTransfer",
      "docs": [
        "Validates a managed inflight transfer so that it becomes priceable."
      ],
      "discriminator": [
        47,
        86,
        129,
        235,
        30,
        249,
        248,
        42
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
          "name": "bridgeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  105,
                  100,
                  103,
                  101,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
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
          "name": "args",
          "type": {
            "defined": {
              "name": "validateManagedTransferArgs"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bridgeRegistry",
      "discriminator": [
        178,
        207,
        65,
        53,
        51,
        157,
        148,
        202
      ]
    },
    {
      "name": "bridgeSession",
      "discriminator": [
        235,
        118,
        90,
        227,
        230,
        173,
        141,
        184
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
  "errors": [
    {
      "code": 6000,
      "name": "unsupportedProtocol",
      "msg": "Unsupported bridge protocol"
    },
    {
      "code": 6001,
      "name": "policyNotFound",
      "msg": "A matching bridge policy was not found"
    },
    {
      "code": 6002,
      "name": "amountTooSmall",
      "msg": "Bridge amount is below the policy minimum"
    },
    {
      "code": 6003,
      "name": "amountTooLarge",
      "msg": "Bridge amount exceeds the policy maximum"
    },
    {
      "code": 6004,
      "name": "invalidProviderProgram",
      "msg": "The provider program does not match the approved policy"
    },
    {
      "code": 6005,
      "name": "invalidSourceTokenAccount",
      "msg": "The source token account is invalid"
    },
    {
      "code": 6006,
      "name": "invalidSourceBalance",
      "msg": "The source token balance did not change as expected"
    },
    {
      "code": 6007,
      "name": "invalidProviderReceipt",
      "msg": "The bridge receipt metadata is invalid"
    },
    {
      "code": 6008,
      "name": "invalidTransferStatus",
      "msg": "The bridge transfer status does not allow this action"
    },
    {
      "code": 6009,
      "name": "transferNotManaged",
      "msg": "Only managed transfers can use this instruction"
    },
    {
      "code": 6010,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6011,
      "name": "invalidTransferRecord",
      "msg": "The transfer record does not belong to this vault"
    },
    {
      "code": 6012,
      "name": "tooManyProviderInstructions",
      "msg": "Too many provider instructions were supplied"
    },
    {
      "code": 6013,
      "name": "duplicateBridgeRoute",
      "msg": "Bridge policy contains overlapping duplicate routes"
    },
    {
      "code": 6014,
      "name": "bridgeRouteNotFound",
      "msg": "The bridge route was not found in the existing policy"
    },
    {
      "code": 6015,
      "name": "ambiguousBridgeRoute",
      "msg": "Multiple bridge routes matched; disambiguate the provider identity"
    },
    {
      "code": 6016,
      "name": "invalidOftAuxiliaryTokenAccount",
      "msg": "The OFT auxiliary token account is invalid"
    },
    {
      "code": 6017,
      "name": "oftAuxiliaryTokenAccountAlreadyExists",
      "msg": "The OFT auxiliary token account already exists"
    },
    {
      "code": 6018,
      "name": "missingEndOftInstruction",
      "msg": "Transaction must include a matching commit_oft_transfer instruction"
    },
    {
      "code": 6019,
      "name": "invalidOftInstructionSet",
      "msg": "The OFT middle instruction set is invalid"
    },
    {
      "code": 6020,
      "name": "invalidOftAuxiliaryBalance",
      "msg": "The OFT auxiliary token balance did not change as expected"
    },
    {
      "code": 6021,
      "name": "invalidRemainingAccounts",
      "msg": "The remaining accounts are invalid"
    },
    {
      "code": 6022,
      "name": "duplicateTransferRecord",
      "msg": "Duplicate transfer record found"
    },
    {
      "code": 6023,
      "name": "tooManyManagedTransfers",
      "msg": "Too many managed transfers are inflight for this vault"
    },
    {
      "code": 6024,
      "name": "invalidBridgeRegistry",
      "msg": "The bridge registry does not belong to this vault"
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
      "name": "bridgeManagedTransfer",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferId",
            "type": "pubkey"
          },
          {
            "name": "sourceMint",
            "type": "pubkey"
          },
          {
            "name": "destinationRecipient",
            "type": "pubkey"
          },
          {
            "name": "providerProgram",
            "type": "pubkey"
          },
          {
            "name": "providerConfig",
            "type": "pubkey"
          },
          {
            "name": "providerEmitter",
            "type": "pubkey"
          },
          {
            "name": "sourceAmount",
            "type": "u64"
          },
          {
            "name": "quotedOutAmount",
            "type": "u64"
          },
          {
            "name": "providerSequence",
            "type": "u64"
          },
          {
            "name": "committedSlot",
            "type": "u64"
          },
          {
            "name": "protocol",
            "type": "u16"
          },
          {
            "name": "destinationChain",
            "type": "u16"
          },
          {
            "name": "sourceDecimals",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "bridgeRegistry",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "glamState",
            "type": "pubkey"
          },
          {
            "name": "managedTransferCount",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "transfers",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "bridgeManagedTransfer"
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
      "name": "bridgeSession",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "glamState",
            "type": "pubkey"
          },
          {
            "name": "signer",
            "type": "pubkey"
          },
          {
            "name": "transferId",
            "type": "pubkey"
          },
          {
            "name": "protocol",
            "type": "u16"
          },
          {
            "name": "managed",
            "type": "bool"
          },
          {
            "name": "sourceMint",
            "type": "pubkey"
          },
          {
            "name": "sourceDecimals",
            "type": "u8"
          },
          {
            "name": "sourceTokenAccount",
            "type": "pubkey"
          },
          {
            "name": "providerProgram",
            "type": "pubkey"
          },
          {
            "name": "providerConfig",
            "type": "pubkey"
          },
          {
            "name": "providerSender",
            "type": "pubkey"
          },
          {
            "name": "providerDelegate",
            "type": "pubkey"
          },
          {
            "name": "providerReceipt",
            "type": "pubkey"
          },
          {
            "name": "providerInstructionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "providerInstructionCount",
            "type": "u16"
          },
          {
            "name": "sourceAmount",
            "type": "u64"
          },
          {
            "name": "quotedOutAmount",
            "type": "u64"
          },
          {
            "name": "initialSourceBalance",
            "type": "u64"
          },
          {
            "name": "initialProviderSequence",
            "type": "u64"
          },
          {
            "name": "destinationChain",
            "type": "u16"
          },
          {
            "name": "destinationRecipient",
            "type": "pubkey"
          },
          {
            "name": "quoteExpiresAt",
            "type": "i64"
          },
          {
            "name": "preparedSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "commitOftTransferArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferId",
            "type": "pubkey"
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
      "name": "layerzeroOftRoute",
      "docs": [
        "source_mint, destination_chain, destination_recipient, provider_program uniquely identify a route"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sourceMint",
            "type": "pubkey"
          },
          {
            "name": "destinationChain",
            "type": "u32"
          },
          {
            "name": "destinationRecipient",
            "type": "pubkey"
          },
          {
            "name": "providerProgram",
            "type": "pubkey"
          },
          {
            "name": "managementMode",
            "type": {
              "defined": {
                "name": "routeManagementMode"
              }
            }
          },
          {
            "name": "minAmount",
            "type": "u64"
          },
          {
            "name": "maxAmount",
            "type": "u64"
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
      "name": "prepareOftTransferArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferId",
            "type": "pubkey"
          },
          {
            "name": "middleInstructionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "middleInstructionCount",
            "type": "u16"
          },
          {
            "name": "sourceAmount",
            "type": "u64"
          },
          {
            "name": "managed",
            "type": "bool"
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
      "name": "routeManagementMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unmanagedOnly"
          },
          {
            "name": "managedOnly"
          },
          {
            "name": "either"
          }
        ]
      }
    },
    {
      "name": "settleManagedTransferArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferId",
            "type": "pubkey"
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
      "name": "validateManagedTransferArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "transferId",
            "type": "pubkey"
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
      "name": "protoBridgePermSend",
      "type": "u64",
      "value": "1"
    },
    {
      "name": "protoBridgePermSettle",
      "type": "u64",
      "value": "4"
    },
    {
      "name": "protoBridgePermValidate",
      "type": "u64",
      "value": "2"
    },
    {
      "name": "protoLayerzeroOft",
      "type": "u16",
      "value": "4"
    },
    {
      "name": "protoManagedInflight",
      "type": "u16",
      "value": "4"
    }
  ]
};
