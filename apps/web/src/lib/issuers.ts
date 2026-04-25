// Shared issuer claim builders. Used by both the public issuer routes
// (api/issuers/{kyc,company}) and by attestations/bind so that the bind
// route doesn't HTTP-self-call its own server (Code #20).

export interface IssuerDoc {
  issuer: { did: string; name: string };
  schema: string;
  subject: `0x${string}`;
  claim: Record<string, unknown>;
  issuedAt: string;
  expiresAt: string;
}

const HALF_YEAR_MS = 180 * 24 * 60 * 60 * 1000;
const expires = () => new Date(Date.now() + HALF_YEAR_MS).toISOString();

export function buildKYC(subject: `0x${string}`): IssuerDoc {
  return {
    issuer: { did: "did:web:moleculeprotocol.io:issuers:kyc", name: "Molecule KYC (Plaid-style mock)" },
    schema: "https://moleculeprotocol.io/schemas/kyc/v0",
    subject,
    claim: {
      verified: true,
      provider: "Plaid (mock)",
      country: "US",
      tier: 2,
      sanctionsClear: true,
      ageOver18: true,
    },
    issuedAt: new Date().toISOString(),
    expiresAt: expires(),
  };
}

export function buildCompany(subject: `0x${string}`): IssuerDoc {
  return {
    issuer: { did: "did:web:moleculeprotocol.io:issuers:company", name: "Molecule Company Binding (mock)" },
    schema: "https://moleculeprotocol.io/schemas/company/v0",
    subject,
    claim: {
      verified: true,
      company: "Molecule Inc",
      role: "engineer",
      employmentStatus: "active",
    },
    issuedAt: new Date().toISOString(),
    expiresAt: expires(),
  };
}

export const ISSUER_BUILDERS = { kyc: buildKYC, company: buildCompany } as const;
export type IssuerType = keyof typeof ISSUER_BUILDERS;

export const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
