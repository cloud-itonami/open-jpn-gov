import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  registerOrg,
  getOrg,
  listOrgs,
  coverage,
  isValidSlug,
  orgDid,
  orgRkey,
} from "../src/index.js";

describe("open-jpn-gov kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:open-jpn-gov.etzhayyim.com" });
  });

  describe("helpers", () => {
    it("validates slugs", () => {
      expect(isValidSlug("mof")).toBe(true);
      expect(isValidSlug("e-gov")).toBe(true);
      expect(isValidSlug("-bad")).toBe(false);
      expect(isValidSlug("Bad")).toBe(false);
      expect(isValidSlug("white space")).toBe(false);
    });
    it("derives did + rkey", () => {
      expect(orgDid("ministry", "MOF")).toBe(
        "did:web:open-jpn-gov.etzhayyim.com:ministry:mof"
      );
      expect(orgRkey("agency", "Digital")).toBe("agency-digital");
    });
  });

  describe("registerOrg", () => {
    const mof = {
      type: "ministry" as const,
      slug: "mof",
      nameJa: "財務省",
      nameEn: "Ministry of Finance",
      establishedLaw: "財務省設置法",
    };
    it("registers a ministry", async () => {
      const r = await registerOrg(e, mof);
      expect(r.status).toBe("registered");
      expect(r.did).toContain("ministry:mof");
    });
    it("is idempotent on (type, slug)", async () => {
      await registerOrg(e, mof);
      const again = await registerOrg(e, mof);
      expect(again.status).toBe("alreadyExists");
    });
    it("rejects an invalid type", async () => {
      const r = await registerOrg(e, { ...mof, type: "kingdom" as any });
      expect(r.status).toBe("rejected");
      expect(r.error).toBe("invalidType");
    });
    it("rejects an invalid slug", async () => {
      const r = await registerOrg(e, { ...mof, slug: "Bad Slug" });
      expect(r.status).toBe("rejected");
      expect(r.error).toBe("invalidSlug");
    });
    it("normalizes slug case", async () => {
      await registerOrg(e, { ...mof, slug: "MOF" });
      const got = await getOrg(e, { type: "ministry", slug: "mof" });
      expect(got.org?.nameJa).toBe("財務省");
    });
  });

  describe("list + coverage", () => {
    beforeEach(async () => {
      await registerOrg(e, {
        type: "ministry",
        slug: "mof",
        nameJa: "財務省",
        establishedLaw: "財務省設置法",
      });
      await registerOrg(e, {
        type: "agency",
        slug: "ntastatistics",
        nameJa: "国税庁",
        parentSlug: "mof",
        establishedLaw: "財務省設置法",
      });
      await registerOrg(e, {
        type: "cabinet",
        slug: "cao",
        nameJa: "内閣府",
      });
    });
    it("filters by type", async () => {
      const ministries = await listOrgs(e, { type: "ministry" });
      expect(ministries.total).toBe(1);
    });
    it("filters by parentSlug", async () => {
      const underMof = await listOrgs(e, { parentSlug: "mof" });
      expect(underMof.total).toBe(1);
      expect(underMof.items[0].nameJa).toBe("国税庁");
    });
    it("coverage aggregates by type + established-law count", async () => {
      const cov = await coverage(e);
      expect(cov.total).toBe(3);
      expect(cov.byType?.ministry).toBe(1);
      expect(cov.byType?.agency).toBe(1);
      expect(cov.byType?.cabinet).toBe(1);
      expect(cov.withEstablishedLaw).toBe(2);
    });
  });
});
