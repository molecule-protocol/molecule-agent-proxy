// Central registry of MAP contract addresses + ABIs.

import IdentityRegistryArtifact from "@/abi/IdentityRegistry.json";
import ValidationRegistryArtifact from "@/abi/ValidationRegistry.json";
import RevocationRegistryArtifact from "@/abi/RevocationRegistry.json";
import MoleculeVaultArtifact from "@/abi/MoleculeVault.json";

const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v as `0x${string}`;
};

export const ARC_RPC_URL = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
export const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);

export const ADDR = {
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY ?? "0x0") as `0x${string}`,
  validationRegistry: (process.env.NEXT_PUBLIC_VALIDATION_REGISTRY ?? "0x0") as `0x${string}`,
  revocationRegistry: (process.env.NEXT_PUBLIC_REVOCATION_REGISTRY ?? "0x0") as `0x${string}`,
  moleculeVault: (process.env.NEXT_PUBLIC_MOLECULE_VAULT ?? "0x0") as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x0") as `0x${string}`,
};

export const ABI = {
  IdentityRegistry: IdentityRegistryArtifact.abi,
  ValidationRegistry: ValidationRegistryArtifact.abi,
  RevocationRegistry: RevocationRegistryArtifact.abi,
  MoleculeVault: MoleculeVaultArtifact.abi,
} as const;

export function relayerKey(): `0x${string}` {
  return need("PROXY_RELAYER_PRIVATE_KEY");
}
