# Operator quickstart

Every command below was run against this tree on **2026-08-15** on macOS
(darwin 25.3.0, Node 26.3.0, npm 11.16.0). Where a command fails in this
workspace, the failure is reproduced verbatim rather than hidden. The one step
that was *not* exercised is marked as such — see [Deploy](#deploy).

There are two independent build targets. Neither depends on the other.

`node_modules/` and `.svelte-kit/` are gitignored, so following this document
leaves the tree clean. Lockfiles are not ignored: `npm install` will leave a
`package-lock.json` behind, and whether to commit it is a decision for this
repo rather than a side effect of running these steps.

---

## 1. `kotoba/` — the library

This is the part of the repo that works end to end.

### Install

```bash
cd kotoba
npm install
```

**This fails in this workspace**, and the failure is not a defect in this repo:

```
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
npm error Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.
```

`~/.npmrc` in this workspace carries a user-level `allow-scripts[]` entry (added
so the Claude Code postinstall can place its native binary). npm 11.x passes
that flag down into the child install it spawns to prepare `git+https`
dependencies, and that child install rejects it. Both of this package's
dependencies — `@etzhayyim/sdk` and `@etzhayyim/sdk-mock` — are git
dependencies, so every install here hits it.

Install with a copy of your user config that has just that entry stripped —
this keeps any registry credentials and TLS settings you already rely on, and
never writes them anywhere new:

```bash
grep -v '^allow-scripts' ~/.npmrc > /tmp/npmrc-plain
npm install --userconfig /tmp/npmrc-plain
```

> **Do not "fix" this by adding an `allowScripts` block to `kotoba/package.json`.**
> The condition lives in the machine's npm config, not in this package, and
> committing a workaround for it would bake one workstation's setup into shared
> code. A previous automated pass attempted exactly that edit; it is not the fix.

The install completes with `found 0 vulnerabilities` and warns that 8 packages
have `prepare: tsc` scripts that were not run. **Both checks below still pass
with those scripts unrun** — do not chase that warning before you have seen an
actual failure.

### Test

```bash
npm test --userconfig /tmp/npmrc-plain
```

Expected — this is the pre-existing state, not an aspiration:

```
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

The suite covers slug validation, DID/rkey derivation, and the four exported
operations (`registerOrg` idempotency, `getOrg`, `listOrgs`, `coverage`) against
`MockEtzhayyim`. No network is used.

### Typecheck

```bash
npm run typecheck --userconfig /tmp/npmrc-plain   # tsc --noEmit → exit 0
```

---

## 2. `worker/svelte/` — the deployable entrypoint

This is what `wrangler.jsonc` actually points at
(`main: svelte/.svelte-kit/cloudflare/_worker.js`).

### Build

Heavy builds in this workspace are serialised by the shared resource governor,
so do not invoke `vite` / `npm run build` directly. `resource-guard.mjs` lives
in the superproject, *outside* this repo — give it an absolute path rather than
counting `../`:

```bash
ROOT=~/github/com-junkawasaki          # your superproject checkout
cd worker/svelte
node "$ROOT/scripts/resource-guard.mjs" run build -- npm run build
```

The build takes 5–8s and emits:

```
.svelte-kit/cloudflare/_worker.js       (~4.3 kB)
.svelte-kit/cloudflare/client/          (static assets)
```

### What you just built

Be clear about what this artifact is before shipping it. It contains the
SvelteKit scaffold page and one route, `POST /xrpc/[...path]`, which forwards
the request to `AGENTGATEWAY_MCP_ROUTER_URL` (default
`https://mcp.etzhayyim.com/...`).

It does **not** contain `worker/src/app.ts`. Verify for yourself:

```bash
grep -c 'ROSTER\|listMinistries\|laws\.e-gov' .svelte-kit/cloudflare/_worker.js   # → 0
```

So the 38-entry roster, the five `com.etzhayyim.apps.openJpnGov.*` methods, and
the e-Gov proxy are **not served by a deploy of this repo as it stands**. Wiring
them in is open work; see the README.

---

## 3. Upstream check

`worker/src/app.ts` proxies e-Gov 法令API v2. No key needed:

```bash
curl -sS 'https://laws.e-gov.go.jp/api/2/laws?limit=1'
```

Verified 2026-08-15: HTTP 200, `"total_count": 9540`. If this fails, the law
endpoints cannot work regardless of anything in this repo.

---

## Deploy

**Not exercised, and deliberately so.** Two facts to settle before anyone runs
`wrangler deploy`:

1. `open-jpn-gov.etzhayyim.com` — the route in `wrangler.jsonc` — **has no DNS
   record.** Neither does `mcp.etzhayyim.com`, the default upstream for the only
   live route in the build. (`etzhayyim.com` itself does resolve.)
2. Per §2, deploying today publishes a scaffold page and a proxy to a
   non-existent host — not the directory service this repo describes.

`CLAUDE.md` documents `e7m actor deploy .` as the deploy path. That command was
not run and its behaviour here is unverified. Treat the deploy story as open
until the wiring gap is closed and the hostname exists.
