# GLAM SDK Example: Squads Proposal

This example demonstrates how to create Squads multisig proposals for GLAM vaults that are owned by a Squads multisig. It shows how to wrap GLAM protocol instructions into Squads transactions and proposals.

## Use Case

When a GLAM vault is owned by a Squads multisig (the vault's manager is the Squads vault PDA), all vault operations must go through the Squads multisig approval process. This example shows how to:

1. Create a GLAM protocol instruction (e.g., enable a protocol integration)
2. Wrap it in a Squads vault transaction
3. Create a Squads proposal for multisig members to vote on

## Prerequisites

- Node.js (v20 or higher)
- pnpm
- A GLAM vault owned by a Squads multisig
- A wallet with Squads Proposer permission

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Set up environment variables:

   - Copy `.env.example` to `.env`
   - Configure the following variables in your `.env` file:
     - `ANCHOR_PROVIDER_URL`: Solana RPC endpoint
     - `ANCHOR_WALLET`: Path to your wallet keypair JSON file (must have Squads Proposer permission)
     - `GLAM_STATE`: Your GLAM vault state PDA address
     - `SQUADS_MULTISIG`: Your Squads multisig PDA address (NOT the vault address)

3. Find your Squads multisig address:
   - Go to `https://app.squads.so/squads/<your-squads>/settings`
   - Look for "Multisig Account" address

## Running the Example

```bash
pnpm run dev
```

This will:

1. Create a GLAM instruction to enable the JupiterSwap protocol
2. Wrap it in a Squads vault transaction
3. Create a Squads proposal
4. Output the transaction signature and a link to view the proposal on Squads

## Notes

- The wallet running this script must have Proposer permission in the Squads multisig
- After creating the proposal, other multisig members can vote on it via the Squads UI
