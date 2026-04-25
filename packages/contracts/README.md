# @molecule/contracts

Foundry project. Deploys MAP smart contracts to Arc testnet (chain 5042002).

## Contracts

- `IdentityRegistry.sol` — ERC-8004-compatible Identity Registry (ERC-721 NFTs per agent)
- `ValidationRegistry.sol` — ERC-8004-compatible Validation Registry (attestation records)
- `RevocationRegistry.sol` — Session-key binding + on-chain revocation
- `MoleculeVault.sol` — Per-call USDC nano-payment routing

## Quickstart

```bash
forge build              # compile
forge test               # unit tests

cp .env.example .env     # fill in DEPLOYER_PRIVATE_KEY + USDC_ADDRESS
source .env
forge script script/Deploy.s.sol \
  --rpc-url $ARC_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

After deploy, addresses are written to `../../deployments/arc-testnet.json`.

## License

MIT (see repo root).
