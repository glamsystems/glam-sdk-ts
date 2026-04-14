/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/mock_layerzero_oft.json`.
 */
export type MockLayerzeroOft = {
  "address": "G6cLMyeKew7B7RR1eAsYhKViYNcknwfwJ4ZbSDwWSS4z",
  "metadata": {
    "name": "mockLayerzeroOft",
    "version": "1.0.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "send",
      "discriminator": [
        102,
        251,
        20,
        187,
        65,
        75,
        12,
        69
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "placeholder0"
        },
        {
          "name": "oftStore"
        },
        {
          "name": "placeholder1"
        },
        {
          "name": "from",
          "writable": true
        },
        {
          "name": "custody",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "placeholder2"
        },
        {
          "name": "placeholder3"
        },
        {
          "name": "mockLayerzeroEndpointProgram",
          "address": "7VCSNNGUmS4f1qDE73PmkSWbV3kBhRPJko1g7t9YTSbM"
        },
        {
          "name": "oftStoreDuplicate"
        },
        {
          "name": "placeholder4"
        },
        {
          "name": "placeholder5"
        },
        {
          "name": "placeholder6"
        },
        {
          "name": "placeholder7"
        },
        {
          "name": "placeholder8"
        },
        {
          "name": "nonce",
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
              "name": "sendArgs"
            }
          }
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidStoreDuplicate",
      "msg": "The duplicated store account does not match"
    }
  ],
  "types": [
    {
      "name": "sendArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dstEid",
            "type": "u32"
          },
          {
            "name": "to",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amountLd",
            "type": "u64"
          },
          {
            "name": "minAmountLd",
            "type": "u64"
          },
          {
            "name": "options",
            "type": "bytes"
          },
          {
            "name": "composeMsg",
            "type": {
              "option": "bytes"
            }
          },
          {
            "name": "nativeFee",
            "type": "u64"
          },
          {
            "name": "lzTokenFee",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
