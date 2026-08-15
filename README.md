# open-jpn-gov

**A directory of the Japanese central government, plus a read-only proxy to the
e-Gov 法令 (statute) API.** The name is the subject: `open` (public, no auth, no
PII), `jpn`, `gov`. Nothing here is an actor — it holds no keys, makes no
outbound decisions, and governs nothing. Neighbouring repos that *are* actors
(`bengoshi`, `judge`, `legal-aid`) may reference this one for ministry DID
lookups; this repo does not reference them.

Apache-2.0. Public data only.

## What is actually here, and what actually runs

This repo is **not** a single deployed service. It is three parts at three very
different stages, and they are not wired to each other. Read this table before
you believe anything else in this repo — including `CLAUDE.md`, which describes
an intended end state rather than the current one.

| Part | What it is | State (verified 2026-08-15) |
|---|---|---|
| `kotoba/` | TypeScript library: gov-org registry over AT PDS records via `@etzhayyim/sdk` | **Working.** 10/10 tests pass, `tsc --noEmit` clean |
| `worker/src/` | Single-file Worker: 38-entry roster + 5 XRPC methods + e-Gov proxy | **Written, not wired.** Nothing imports it; it is absent from the build output |
| `worker/svelte/` | SvelteKit edge BFF — the actual `wrangler` entrypoint | **Builds, but is a scaffold placeholder** whose `/xrpc/*` forwards to an MCP router |

**Nothing is deployed.** `open-jpn-gov.etzhayyim.com` has no DNS record.

### The wiring gap

`wrangler.jsonc` sets `main` to `svelte/.svelte-kit/cloudflare/_worker.js`. That
build contains the SvelteKit app only. `worker/src/app.ts` — the roster, the five
`com.etzhayyim.apps.openJpnGov.*` methods, the e-Gov proxy, the DoDAF and form
endpoints — is imported by nothing, so **deploying this repo today would not
serve any of it.** Confirmed by grepping the built `_worker.js` for `ROSTER`,
`listMinistries` and `laws.e-gov`: zero hits.

What the SvelteKit route *does* do is forward any `POST /xrpc/<nsid>` to
`AGENTGATEWAY_MCP_ROUTER_URL`, defaulting to
`https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message`. **That host has no
DNS record either**, so the proxy path has no working upstream as configured.

Closing this gap — pointing `wrangler` at `worker/src/app.ts`, or importing it
from a SvelteKit route — is the outstanding work in this repo. It is not done,
and this README does not pretend otherwise.

## Layout

```
kotoba/          TypeScript library (registry over AT PDS) — the working part
worker/src/      Worker: roster, XRPC methods, e-Gov proxy — unwired
worker/svelte/   SvelteKit edge BFF — the wrangler entrypoint
bpmn/ dmn/       Process + decision models (resolve-ministry, search-law)
dodaf/           DoDAF views (AV-1, OV-1, OV-5b, OV-6a, CV-2, SV-1)
forms/           Form definitions served by worker/src/app.ts
```

## The roster

`worker/src/roster.ts` embeds **38 entries**, sourced from 内閣官房 組織図 (2024)
and 国家行政組織法 / 各省設置法:

| Category | Count | Examples |
|---|---|---|
| `cabinet` | 3 | 内閣官房, 内閣法制局, 内閣府 |
| `ministry` | 11 | 財務省, 法務省, 外務省 |
| `agency` | 22 | 外局 (`gaikyoku`), 特別の機関 (`tokubetsu`), 委員会 (`iinkai`) |
| `independent` | 2 | 人事院, 会計検査院 |

There is no DB. The roster is compiled in; law text is fetched live.

## DID pattern

```
did:web:open-jpn-gov.etzhayyim.com:{category}:{code}

did:web:open-jpn-gov.etzhayyim.com:ministry:mof        財務省
did:web:open-jpn-gov.etzhayyim.com:agency:digital      デジタル庁
did:web:open-jpn-gov.etzhayyim.com:cabinet:cao         内閣府
```

`kotoba/` uses the same shape but a wider `GovOrgType`
(`ministry | agency | cabinet | bureau | council | commission | court | other`)
and derives record keys as `{type}-{slug}`. The two vocabularies overlap but are
not identical — `kotoba/` is not a client of `worker/src/`.

## Upstream

e-Gov 法令API **v2** — `https://laws.e-gov.go.jp/api/2`. Live as of 2026-08-15
(`/laws?limit=1` → HTTP 200, `total_count: 9540`). Responses are edge-cached for
one hour by `worker/src/app.ts`. No API key is required.

## Not in scope

47 都道府県 / 市区町村 rosters, e-Stat statistics, 官報 ingestion, 電子調達 /
入札, マイナンバー / 法人番号 lookup.

## Getting started

See **[`docs/operator-quickstart.md`](docs/operator-quickstart.md)** — every
command there has been run against this tree, including the `npm install`
failure this workspace's npm config provokes and the way around it.
