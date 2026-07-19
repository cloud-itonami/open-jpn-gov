// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 etzhayyim Japan株式会社 / etzhayyim. All rights reserved.
// Licensed under the Apache License, Version 2.0 — see LICENSE at repo root.

// etzhayyim-project-open-jpn-gov — Japanese central-government open directory + e-Gov law proxy
//
// 5 XRPC methods under com.etzhayyim.apps.openJpnGov.*:
//   listMinistries   (query)  — roster of 1府11省 + 庁 + 独立機関 + 外局
//   getMinistry      (query)  — single entity by code or DID
//   listAgencies     (query)  — agencies under a parent ministry
//   searchLaws       (query)  — proxy to e-Gov 法令API (法令一覧取得API)
//   getLaw           (query)  — proxy to e-Gov 法令API (法令取得API)
//
// No DB. Roster is embedded; law data is proxied live to elaws.e-gov.go.jp
// (cached 1h in CF edge). Single-file Worker.

import { ROSTER, didFor, type Entity } from "./roster";
import AV1 from "../../dodaf/AV-1.json";
import OV1 from "../../dodaf/OV-1.json";
import OV5b from "../../dodaf/OV-5b.json";
import OV6a from "../../dodaf/OV-6a.json";
import CV2 from "../../dodaf/CV-2.json";
import SV1 from "../../dodaf/SV-1.json";
import searchLawForm from "../../forms/searchLaw.form.json";
import resolveMinistryForm from "../../forms/resolveMinistry.form.json";
import { bootstrapDodaf } from "./dodaf-bootstrap";

const DODAF_VIEWS: Record<string, any> = {
  "open-jpn-gov.AV-1": AV1,
  "open-jpn-gov.OV-1": OV1,
  "open-jpn-gov.OV-5b": OV5b,
  "open-jpn-gov.OV-6a": OV6a,
  "open-jpn-gov.CV-2": CV2,
  "open-jpn-gov.SV-1": SV1,
};
const FORMS: Record<string, any> = {
  "openJpnGov.searchLaw.v1": searchLawForm,
  "openJpnGov.resolveMinistry.v1": resolveMinistryForm,
};

export interface Env {
  PDS?: Fetcher;
  APP_HANDLE: string;
  PRIMARY_DID: string;
}

const ELAWS_API = "https://laws.e-gov.go.jp/api/2"; // e-Gov 法令API v2

const LAW_TYPE_MAP: Record<string, string> = {
  constitution: "1",
  law: "2",
  cabinetOrder: "3",
  ministerialOrdinance: "4",
  rule: "5",
  all: "1,2,3,4,5",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}
const err = (error: string, message: string, status = 400) =>
  json({ error, message }, status);

// ─────────────────────────────────────────────────────────────────
// Roster handlers
// ─────────────────────────────────────────────────────────────────
function toPublic(e: Entity) {
  return {
    code: e.code,
    did: didFor(e),
    nameJa: e.nameJa,
    nameEn: e.nameEn,
    category: e.category,
    kind: e.kind,
    parentCode: e.parentCode,
    established: e.established,
    statuteJa: e.statuteJa,
    website: e.website,
    description: e.description,
  };
}

function listMinistries(params: URLSearchParams): Response {
  const category = params.get("category");
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? 50)));
  const offset = Math.max(0, Number(params.get("offset") ?? 0));
  const filtered = category ? ROSTER.filter((e) => e.category === category) : ROSTER;
  const page = filtered.slice(offset, offset + limit).map(toPublic);
  return json({ ministries: page, total: filtered.length, offset, limit });
}

function getMinistry(params: URLSearchParams): Response {
  const code = params.get("code");
  const did = params.get("did");
  if (!code && !did) return err("InvalidRequest", "code or did required");
  const hit = ROSTER.find((e) => (code && e.code === code) || (did && didFor(e) === did));
  if (!hit) return err("NotFound", "ministry not found", 404);
  const body: any = toPublic(hit);
  body.agencies = ROSTER.filter((e) => e.parentCode === hit.code).map(didFor);
  return json(body);
}

function listAgencies(params: URLSearchParams): Response {
  const parentCode = params.get("parentCode");
  if (!parentCode) return err("InvalidRequest", "parentCode required");
  const limit = Math.min(200, Math.max(1, Number(params.get("limit") ?? 50)));
  const offset = Math.max(0, Number(params.get("offset") ?? 0));
  const kids = ROSTER.filter((e) => e.parentCode === parentCode);
  const page = kids.slice(offset, offset + limit).map(toPublic);
  return json({ agencies: page, total: kids.length, offset, limit });
}

// ─────────────────────────────────────────────────────────────────
// e-Gov law proxy
// ─────────────────────────────────────────────────────────────────
// The e-Gov 法令API returns XML by default. We do minimal XML→JSON extraction
// via regex to keep this Worker dependency-free. Callers that need the full
// document should set format=xml.

async function fetchElawsXml(path: string): Promise<string> {
  const res = await fetch(`${ELAWS_API}${path}`, {
    headers: { accept: "application/xml" },
    cf: { cacheTtl: 3600, cacheEverything: true } as any,
  });
  if (!res.ok) throw new Error(`e-Gov upstream ${res.status}`);
  return await res.text();
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1].trim());
  return out;
}
function extractOne(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return m?.[1]?.trim();
}

async function searchLaws(params: URLSearchParams): Promise<Response> {
  const query = (params.get("query") ?? "").trim();
  const lawType = params.get("lawType") ?? "all";
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 20)));
  const offset = Math.max(0, Number(params.get("offset") ?? 0));

  const typeParam = LAW_TYPE_MAP[lawType] ?? LAW_TYPE_MAP.all;
  try {
    const xml = await fetchElawsXml(`/lawlists/${encodeURIComponent(typeParam)}`);
    // Parse <LawNameListInfo> blocks
    const blocks = extractAll(xml, "LawNameListInfo");
    const all = blocks.map((b) => ({
      lawNum: extractOne(b, "LawNo") ?? "",
      lawId: extractOne(b, "LawId") ?? "",
      lawName: extractOne(b, "LawName") ?? "",
      lawType: extractOne(b, "LawType") ?? "",
      promulgationDate: extractOne(b, "PromulgationDate") ?? "",
    }));
    const filtered = query
      ? all.filter(
          (l) =>
            l.lawName.includes(query) ||
            l.lawNum.includes(query) ||
            l.lawId.toLowerCase().includes(query.toLowerCase())
        )
      : all;
    const page = filtered.slice(offset, offset + limit);
    return json({ laws: page, total: filtered.length, offset, limit });
  } catch (e: any) {
    return err("UpstreamError", e?.message ?? "e-Gov fetch failed", 502);
  }
}

async function getLaw(params: URLSearchParams): Promise<Response> {
  const lawNumOrId = params.get("lawNumOrId");
  if (!lawNumOrId) return err("InvalidRequest", "lawNumOrId required");
  const format = params.get("format") ?? "plain";
  try {
    const xml = await fetchElawsXml(`/lawdata/${encodeURIComponent(lawNumOrId)}`);
    const lawNum = extractOne(xml, "LawNum") ?? lawNumOrId;
    const lawName =
      extractOne(xml, "LawTitle") ?? extractOne(xml, "LawName") ?? "";
    const body =
      format === "xml"
        ? xml
        : xml
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    return json({
      lawNum,
      lawId: lawNumOrId,
      lawName,
      body,
      sourceUri: `https://laws.e-gov.go.jp/law/${encodeURIComponent(lawNumOrId)}`,
    });
  } catch (e: any) {
    return err("UpstreamError", e?.message ?? "e-Gov fetch failed", 502);
  }
}

// ─────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);
      if (url.pathname === "/health" || url.pathname === "/_worker/health") {
        return json({ ok: true, did: env.PRIMARY_DID, ts: new Date().toISOString() });
      }
      if (url.pathname === "/_app/meta") {
        if (env.PDS) { try { await bootstrapDodaf(env as any); } catch {} }
        return json({
          did: env.PRIMARY_DID,
          handle: env.APP_HANDLE,
          xrpc: [
            "com.etzhayyim.apps.openJpnGov.listMinistries",
            "com.etzhayyim.apps.openJpnGov.getMinistry",
            "com.etzhayyim.apps.openJpnGov.listAgencies",
            "com.etzhayyim.apps.openJpnGov.searchLaws",
            "com.etzhayyim.apps.openJpnGov.getLaw",
          ],
          rosterSize: ROSTER.length,
          upstream: ELAWS_API,
          dodaf: Object.keys(DODAF_VIEWS),
          forms: Object.keys(FORMS),
          bpmn: ["searchLaw", "resolveMinistry"],
          dmn:  ["openJpnGov.lawTypeClassification"],
        });
      }
      if (url.pathname === "/dodaf") {
        return json({
          views: Object.entries(DODAF_VIEWS).map(([id, v]: [string, any]) => ({
            viewId: id, viewType: v.viewType, title: v.title, version: v.version,
          })),
        });
      }
      if (url.pathname.startsWith("/dodaf/")) {
        const id = decodeURIComponent(url.pathname.slice("/dodaf/".length));
        const v = DODAF_VIEWS[id];
        return v ? json(v) : err("InvalidRequest", `no such view: ${id}`, 404);
      }
      if (url.pathname === "/forms") {
        return json({ forms: Object.values(FORMS).map((f: any) => ({ formKey: f.formKey, name: f.name, version: f.version })) });
      }
      if (url.pathname.startsWith("/forms/")) {
        const key = decodeURIComponent(url.pathname.slice("/forms/".length));
        const f = FORMS[key];
        return f ? json(f) : err("InvalidRequest", `no such form: ${key}`, 404);
      }
      if (!url.pathname.startsWith("/xrpc/")) return err("InvalidRequest", "only /xrpc/*", 404);
      const nsid = url.pathname.slice("/xrpc/".length);
      if (req.method !== "GET") return err("InvalidRequest", "GET only (all methods are query)", 405);
      switch (nsid) {
        case "com.etzhayyim.apps.openJpnGov.listMinistries":
          return listMinistries(url.searchParams);
        case "com.etzhayyim.apps.openJpnGov.getMinistry":
          return getMinistry(url.searchParams);
        case "com.etzhayyim.apps.openJpnGov.listAgencies":
          return listAgencies(url.searchParams);
        case "com.etzhayyim.apps.openJpnGov.searchLaws":
          return await searchLaws(url.searchParams);
        case "com.etzhayyim.apps.openJpnGov.getLaw":
          return await getLaw(url.searchParams);
        default:
          return err("InvalidRequest", `unknown NSID: ${nsid}`, 404);
      }
    } catch (e: any) {
      return err("InternalError", e?.message ?? String(e), 500);
    }
  },
};
