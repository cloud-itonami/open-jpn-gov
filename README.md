# open-jpn-gov

**A directory of the Japanese central government, plus a read-only proxy to the
e-Gov 法令 (statute) API.** The name is the subject: `open` (public, no auth, no
PII), `jpn`, `gov`. Nothing here is an actor — it holds no keys, makes no
outbound decisions, and governs nothing. Neighbouring repos that *are* actors
(`bengoshi`, `judge`, `legal-aid`) may reference this one for ministry DID
lookups; this repo does not reference them.

Apache-2.0. Public data only.

## What is actually here, and what actually runs

This repo is **not** a single deployed service. It is several parts at
different stages. Read this table before you believe anything else in this
repo — including `CLAUDE.md`, which describes an intended end state rather
than the current one.

| Part | What it is | State (verified 2026-09-07) |
|---|---|---|
| `kotoba/` | TypeScript library: gov-org registry over AT PDS records via `@etzhayyim/sdk` | **Working.** 10/10 tests pass, `tsc --noEmit` clean |
| `worker/src/` | Single-file Worker: 38-entry roster + 5 XRPC methods + e-Gov proxy | **Wired.** `wrangler.jsonc` `main` points at `./src/app.ts` |
| `src/`, `web/` | ClojureScript (shadow-cljs + reagent) UI, built to `web/dist` | **Builds.** Static info card, ported 1:1 from the former Svelte scaffold page |
| `worker/src/xrpc-proxy.ts` | Former SvelteKit `/xrpc/<nsid>` → MCP-router forwarder | **Preserved, not wired.** See below |

**Nothing is deployed.** `open-jpn-gov.etzhayyim.com` has no DNS record
(re-verified 2026-09-07).

### History: the Svelte → cljs migration

Through 2026-09-05 the deployable entrypoint was a SvelteKit edge BFF at
`worker/svelte/`, and `wrangler.jsonc` `main` pointed at its build output
(`svelte/.svelte-kit/cloudflare/_worker.js`). That build did not import
`worker/src/app.ts` at all, so deploying served a scaffold page and a single
`POST /xrpc/<nsid>` route that forwarded to `AGENTGATEWAY_MCP_ROUTER_URL`
(default `https://mcp.etzhayyim.com/...` — itself never had a DNS record, so
that path had no working upstream even when built).

That gap is now closed the way this README used to say it could be:
`worker/svelte/` was removed, `wrangler.jsonc` `main` was repointed at
`./src/app.ts` directly, and `assets.directory` was repointed at `web/dist`
(built by shadow-cljs from `src/cloud_itonami/open_jpn_gov/`). Static requests
are served from `web/dist`; anything else reaches `worker/src/app.ts`, which
serves the roster, the five `com.etzhayyim.apps.openJpnGov.*` methods, the
e-Gov proxy, and the DoDAF/form endpoints directly. **`worker/src/app.ts`
implements those five named methods only — it does not implement generic
`POST /xrpc/<nsid>` forwarding to an external MCP router.** That behaviour
existed only in the SvelteKit route and was not ported (its upstream had no
DNS record regardless); the original file is preserved, unwired, at
`worker/src/xrpc-proxy.ts` with a header explaining why it cannot run as-is
and that reviving it is an undecided product question. **Wiring an MCP-router
forwarder in is still open work if that behaviour is wanted going forward** —
it is just no longer implicitly promised by a leftover route nobody was
using.

## Layout

```
kotoba/                Working TypeScript library (registry over AT PDS)
worker/src/            Worker: roster, XRPC methods, e-Gov proxy — wired (wrangler `main`)
worker/src/xrpc-proxy.ts  Former SvelteKit MCP-router proxy — preserved, not wired
src/cloud_itonami/open_jpn_gov/  ClojureScript UI (reagent), built via shadow-cljs
web/                    UI build output (`web/dist`) — served as static assets
bpmn/ dmn/              Process + decision models (resolve-ministry, search-law)
dodaf/                  DoDAF views (AV-1, OV-1, OV-5b, OV-6a, CV-2, SV-1)
forms/                  Form definitions served by worker/src/app.ts
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
