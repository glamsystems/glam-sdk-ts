/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/mock_wormhole_verify_vaa_shim.json`.
 */
export type MockWormholeVerifyVaaShim = {
  "address": "EFaNWErqAtVWufdNb7yofSHHfWFos843DFpu4JBw24at",
  "metadata": {
    "name": "mockWormholeVerifyVaaShim",
    "version": "1.0.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "verifyHash",
      "discriminator": [
        22,
        152,
        160,
        69,
        241,
        148,
        14,
        124
      ],
      "accounts": [
        {
          "name": "guardianSet"
        },
        {
          "name": "guardianSignatures"
        }
      ],
      "args": [
        {
          "name": "guardianSetBump",
          "type": "u8"
        },
        {
          "name": "digest",
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
  "errors": [
    {
      "code": 6000,
      "name": "invalidGuardianSetBump",
      "msg": "guardian set bump must be non-zero"
    },
    {
      "code": 6001,
      "name": "invalidDigest",
      "msg": "digest must be non-zero"
    }
  ]
};
