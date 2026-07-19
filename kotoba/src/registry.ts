/**
 * open-jpn-gov kotoba — directory registry (slice 1, 4/4 canonical).
 *
 *   registerOrg — register a gov org (rkey={type}-{slug}, idempotent).
 *   getOrg      — by (type, slug).
 *   listOrgs    — cursor + type/parent filter.
 *   coverage    — aggregate counts by type + established-law count.
 *
 * Replaces vendor createKyselyDb()/vertex_open_jpn_gov_* with AT PDS records
 * (no RW). Public directory data → 3-axis clean.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  GOV_ORG_TYPES,
  isValidSlug,
  normalizeSlug,
  orgDid,
  orgRkey,
  type CoverageInput,
  type CoverageOutput,
  type GetOrgInput,
  type GetOrgOutput,
  type GovOrgRecord,
  type GovOrgType,
  type GovOrgView,
  type ListOrgsInput,
  type ListOrgsOutput,
  type RegisterOrgInput,
  type RegisterOrgOutput,
} from "./types.js";

const ORG_COLLECTION = "com.etzhayyim.apps.openJpnGov.org";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

export async function registerOrg(
  e: Etzhayyim,
  input: RegisterOrgInput
): Promise<RegisterOrgOutput> {
  if (!input.nameJa || !input.slug || !input.type) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  if (!GOV_ORG_TYPES.has(input.type)) {
    return { status: "rejected", error: "invalidType" };
  }
  const slug = normalizeSlug(input.slug);
  if (!isValidSlug(slug)) {
    return { status: "rejected", error: "invalidSlug" };
  }

  const rkey = orgRkey(input.type, slug);
  const existing = await e
    .read<GovOrgRecord>({ collection: ORG_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      orgUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      slug,
    };
  }

  const did = orgDid(input.type, slug);
  const now = new Date().toISOString();
  const record: GovOrgRecord = {
    did,
    type: input.type,
    slug,
    nameJa: input.nameJa,
    nameEn: input.nameEn,
    parentSlug: input.parentSlug ? normalizeSlug(input.parentSlug) : undefined,
    establishedLaw: input.establishedLaw,
    url: input.url,
    source: input.source,
    collectedAt: now,
    createdAt: now,
  };
  const receipt = await e.write({
    collection: ORG_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return { status: "registered", orgUri: receipt.uri, did, slug };
}

export async function getOrg(
  e: Etzhayyim,
  input: GetOrgInput
): Promise<GetOrgOutput> {
  if (!input.type || !input.slug) return { error: "missingTypeOrSlug" };
  const resp = await e
    .read<GovOrgRecord>({
      collection: ORG_COLLECTION,
      rkey: orgRkey(input.type, normalizeSlug(input.slug)),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { org: { ...r.value, orgUri: r.uri } };
}

export async function listOrgs(
  e: Etzhayyim,
  input: ListOrgsInput = {}
): Promise<ListOrgsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<GovOrgRecord>({
    collection: ORG_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: GovOrgView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.type && v.type !== input.type) return false;
      if (input.parentSlug && v.parentSlug !== normalizeSlug(input.parentSlug)) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, orgUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function coverage(
  e: Etzhayyim,
  input: CoverageInput = {}
): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  let cursor: string | undefined;
  let scanned = 0;
  const byType: Record<string, number> = {};
  let withEstablishedLaw = 0;
  while (scanned < maxScan) {
    const page = await e.read<GovOrgRecord>({
      collection: ORG_COLLECTION,
      cursor,
      limit: PAGE_LIMIT,
    });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      const v = r.value;
      byType[v.type as GovOrgType] = (byType[v.type as GovOrgType] ?? 0) + 1;
      if (v.establishedLaw) withEstablishedLaw += 1;
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) {
      break;
    }
    cursor = page.cursor;
  }
  return {
    total: scanned,
    byType,
    withEstablishedLaw,
    truncated: scanned >= maxScan,
  };
}
