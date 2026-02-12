/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/glam_policies.json`.
 */
export type GlamPolicies = {
  "address": "po1iCYakK3gHCLbuju4wGzFowTMpAJxkqK1iwUqMonY",
  "metadata": {
    "name": "glamPolicies",
    "version": "1.0.0",
    "spec": "0.1.0",
    "description": "GLAM policies program"
  },
  "instructions": [
    {
      "name": "closeExtraMetasAccount",
      "discriminator": [
        67,
        72,
        24,
        239,
        222,
        207,
        240,
        177
      ],
      "accounts": [
        {
          "name": "extraMetasAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closePolicy",
      "discriminator": [
        55,
        42,
        248,
        229,
        222,
        138,
        26,
        252
      ],
      "accounts": [
        {
          "name": "policyAccount",
          "docs": [
            "lamports will be refunded to the owner"
          ],
          "writable": true
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "subject",
          "writable": true,
          "relations": [
            "policyAccount"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createPolicy",
      "discriminator": [
        27,
        81,
        33,
        27,
        196,
        103,
        246,
        53
      ],
      "accounts": [
        {
          "name": "policyAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "subjectTokenAccount"
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Must be the mint authority or permanent delegate"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "subject"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "subjectTokenAccount"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lockedUntil",
          "type": "u64"
        },
        {
          "name": "timeUnit",
          "type": {
            "defined": {
              "name": "timeUnit"
            }
          }
        }
      ]
    },
    {
      "name": "execute",
      "discriminator": [
        105,
        37,
        101,
        197,
        75,
        251,
        102,
        26
      ],
      "accounts": [
        {
          "name": "srcAccount"
        },
        {
          "name": "mint"
        },
        {
          "name": "dstAccount"
        },
        {
          "name": "srcAccountAuthority"
        },
        {
          "name": "extraMetasAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "srcPolicyAccount"
        },
        {
          "name": "dstPolicyAccount"
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
      "name": "initializeExtraMetasAccount",
      "discriminator": [
        43,
        34,
        13,
        49,
        167,
        88,
        235,
        235
      ],
      "accounts": [
        {
          "name": "extraMetasAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  116,
                  114,
                  97,
                  45,
                  97,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116,
                  45,
                  109,
                  101,
                  116,
                  97,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "metas",
          "type": {
            "vec": {
              "defined": {
                "name": "anchorExtraAccountMeta"
              }
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "policyAccount",
      "discriminator": [
        218,
        201,
        183,
        164,
        156,
        127,
        81,
        175
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidSourcePolicyAccount",
      "msg": "Invalid source policy account"
    },
    {
      "code": 6001,
      "name": "lockUp",
      "msg": "Policy violation: lock-up has not expired"
    },
    {
      "code": 6002,
      "name": "notAuthorized",
      "msg": "Signer is not mint authority or permanent delegate"
    },
    {
      "code": 6003,
      "name": "missingPermanentDelegate",
      "msg": "Mint has no permanent delegate extension"
    }
  ],
  "types": [
    {
      "name": "anchorExtraAccountMeta",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "discriminator",
            "type": "u8"
          },
          {
            "name": "addressConfig",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isSigner",
            "type": "bool"
          },
          {
            "name": "isWritable",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "policyAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "subject",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "tokenAccount",
            "type": "pubkey"
          },
          {
            "name": "lockedUntil",
            "type": "u64"
          },
          {
            "name": "timeUnit",
            "type": {
              "defined": {
                "name": "timeUnit"
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
    }
  ]
};
