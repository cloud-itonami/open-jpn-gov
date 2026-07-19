/**
 * open-jpn-gov kotoba — record types.
 *
 * Per ADR-2605203000 Option B (PDS XRPC). Japanese government directory —
 * ministries / agencies / cabinet offices / bureaus / councils. Public OSS
 * directory data (no PII, no payment) → 3-axis clean. ADR-2605172000 kotoba.
 *
 * Identity hierarchy (per open-jpn-gov CLAUDE.md):
 *   did:web:open-jpn-gov.etzhayyim.com                       — controller
 *   did:web:open-jpn-gov.etzhayyim.com:ministry:mof          — 財務省
 *   did:web:open-jpn-gov.etzhayyim.com:agency:digital        — デジタル庁
 *   did:web:open-jpn-gov.etzhayyim.com:cabinet:cao           — 内閣府
 */

export const OJG_DID_PREFIX = "did:web:open-jpn-gov.etzhayyim.com:" as const;

export type GovOrgType =
  | "ministry"
  | "agency"
  | "cabinet"
  | "bureau"
  | "council"
  | "commission"
  | "court"
  | "other";

export const GOV_ORG_TYPES: ReadonlySet<GovOrgType> = new Set([
  "ministry",
  "agency",
  "cabinet",
  "bureau",
  "council",
  "commission",
  "court",
  "other",
]);

export interface GovOrgRecord {
  did: string;
  type: GovOrgType;
  /** Stable slug (lowercase alnum + hyphen), unique within type. */
  slug: string;
  nameJa: string;
  nameEn?: string;
  /** Parent org slug (e.g. an agency under a ministry). */
  parentSlug?: string;
  /** Establishing statute (設置法), e.g. "財務省設置法". */
  establishedLaw?: string;
  url?: string;
  source?: string;
  collectedAt: string;
  createdAt: string;
}

export interface GovOrgView extends GovOrgRecord {
  orgUri: string;
}

export interface RegisterOrgInput {
  type: GovOrgType;
  slug: string;
  nameJa: string;
  nameEn?: string;
  parentSlug?: string;
  establishedLaw?: string;
  url?: string;
  source?: string;
}

export interface RegisterOrgOutput {
  status: "registered" | "alreadyExists" | "rejected";
  orgUri?: string;
  did?: string;
  slug?: string;
  error?: string;
}

export interface GetOrgInput {
  type: GovOrgType;
  slug: string;
}

export interface GetOrgOutput {
  org?: GovOrgView;
  error?: string;
}

export interface ListOrgsInput {
  type?: GovOrgType;
  parentSlug?: string;
  limit?: number;
  cursor?: string;
}

export interface ListOrgsOutput {
  items: GovOrgView[];
  cursor?: string;
  total: number;
}

export interface CoverageInput {
  maxScan?: number;
}

export interface CoverageOutput {
  total?: number;
  byType?: Record<string, number>;
  withEstablishedLaw?: number;
  truncated?: boolean;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}

export function orgDid(type: GovOrgType, slug: string): string {
  return `${OJG_DID_PREFIX}${type}:${normalizeSlug(slug)}`;
}

export function orgRkey(type: GovOrgType, slug: string): string {
  return `${type}-${normalizeSlug(slug)}`;
}
