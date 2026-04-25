// EIP-712 typed-data spec for MAP session-key delegations.
//
// The user's wallet signs this once at agent setup. The signed delegation is
// then carried by the agent and presented with every proxy call. The proxy
// verifies the signature on every call to ensure the delegation is real.

import type { TypedDataDomain } from "viem";
import { ARC_CHAIN_ID, ADDR } from "./contracts";

export const DELEGATION_TYPES = {
  Delegation: [
    { name: "sessionKey", type: "address" },
    { name: "vault", type: "address" },
    { name: "scope", type: "string[]" },
    { name: "capPerDayUSDC", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "uint64" },
  ],
} as const;

export const PRIMARY_TYPE = "Delegation" as const;

export function delegationDomain(): TypedDataDomain {
  return {
    name: "MoleculeAgentProxy",
    version: "1",
    chainId: ARC_CHAIN_ID,
    verifyingContract: ADDR.moleculeVault,
  };
}

export interface DelegationMessage {
  sessionKey: `0x${string}`;
  vault: `0x${string}`;
  scope: readonly string[];
  capPerDayUSDC: bigint;
  expiresAt: bigint;
  nonce: bigint;
}

export interface SignedDelegation {
  message: DelegationMessage;
  signature: `0x${string}`;
}
