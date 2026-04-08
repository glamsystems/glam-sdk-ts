# GLAM SDK Example

A command-line interface for interacting with GLAM vaults using the GLAM SDK. This CLI provides essential vault operations including creation, deposits, transfers, and integration management.

## Prerequisites

- Node.js (v20 or higher)
- pnpm

## Setup

1. Install dependencies:

   ```
   pnpm install
   ```

2. Set up environment variables:

   - Copy `.env.example` to `.env`
   - Configure the following variables in your `.env` file:
     - `ANCHOR_PROVIDER_URL`: Solana RPC endpoint (e.g., `https://api.devnet.solana.com`)
     - `ANCHOR_WALLET`: Path to your Solana wallet keypair JSON file

3. Build the TypeScript code:
   ```
   pnpm run build
   ```

## Available Commands

### Create a Vault

Create a new GLAM vault:

```bash
pnpm run dev create <name> [options]
```

**Options:**

- `-e, --enabled`: Initialize the vault in enabled state (default: true)

**Example:**

```bash
pnpm run dev create "My Trading Vault"
```

### Deposit SOL

Deposit SOL into a GLAM vault:

```bash
pnpm run dev deposit-sol <vault> <amount>
```

**Example:**

```bash
pnpm run dev deposit-sol AavyjyHQJfvVyePzfeBq6nhNgjZhXEDPWXvnsgVsuaxf 1
```

### Deposit Token

Deposit any SPL token into a GLAM vault:

```bash
pnpm run dev deposit-token <vault> <token_mint> <amount>
```

**Example:**

```bash
pnpm run dev deposit-token AavyjyHQJfvVyePzfeBq6nhNgjZhXEDPWXvnsgVsuaxf CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM 1
```

### Transfer Token

Transfer tokens from a GLAM vault to another wallet:

```bash
pnpm run dev transfer-token <vault> <dest_wallet> <token_mint> <amount>
```

**Example:**

```bash
pnpm run dev transfer-token AavyjyHQJfvVyePzfeBq6nhNgjZhXEDPWXvnsgVsuaxf gLJHKPrZLGBiBZ33hFgZh6YnsEhTVxuRT17UCqNp6ff CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM 1
```

### Enable Integration

Enable protocol integrations for a GLAM vault:

```bash
pnpm run dev enable-integration <vault> <integration_program> <protocols...>
```

**Example:**

```bash
pnpm run dev enable-integration AavyjyHQJfvVyePzfeBq6nhNgjZhXEDPWXvnsgVsuaxf G1NTsQ36mjPe89HtPYqxKsjY5HmYsDR6CbD2gd2U2pta 1
```

## Notes

- All transactions are simulated by default
- The CLI automatically discovers vault state accounts from vault addresses
- Token amounts are automatically scaled based on the token's decimal places
