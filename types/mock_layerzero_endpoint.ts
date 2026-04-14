/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/mock_layerzero_endpoint.json`.
 */
export type MockLayerzeroEndpoint = {
  "address": "7VCSNNGUmS4f1qDE73PmkSWbV3kBhRPJko1g7t9YTSbM",
  "metadata": {
    "name": "mockLayerzeroEndpoint",
    "version": "1.0.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "advanceNonce",
      "discriminator": [
        20,
        17,
        71,
        131,
        103,
        35,
        92,
        6
      ],
      "accounts": [
        {
          "name": "nonce",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  78,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "sender"
              },
              {
                "kind": "arg",
                "path": "dstEid"
              },
              {
                "kind": "arg",
                "path": "receiver"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "sender",
          "type": "pubkey"
        },
        {
          "name": "dstEid",
          "type": "u32"
        },
        {
          "name": "receiver",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeNonce",
      "discriminator": [
        64,
        206,
        214,
        231,
        20,
        15,
        231,
        41
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "nonce",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  78,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "sender"
              },
              {
                "kind": "arg",
                "path": "dstEid"
              },
              {
                "kind": "arg",
                "path": "receiver"
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
          "name": "sender",
          "type": "pubkey"
        },
        {
          "name": "dstEid",
          "type": "u32"
        },
        {
          "name": "receiver",
          "type": "pubkey"
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidNonceAccount",
      "msg": "The nonce account layout is invalid"
    }
  ]
};
