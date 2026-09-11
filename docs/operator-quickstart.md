# Operator quickstart

Most commands below were run against this tree on **2026-08-15** on macOS
(darwin 25.3.0, Node 26.3.0, npm 11.16.0). Where a command fails in this
workspace, the failure is reproduced verbatim rather than hidden. **§2 was
rewritten on 2026-09-07** after `worker/svelte/` was removed and replaced with
a ClojureScript (shadow-cljs + reagent) UI (PR #1); its build was verified by
that PR ("Build completed. (95 files, 0 compiled, 0 warnings, 14.74s)") but not
independently re-run for this rewrite, because doing so requires the exact
worktree layout `deps.edn` assumes (see §2). The one step that was *not*
exercised at all is marked as such — see [Deploy](#deploy).

There are two independent build targets. Neither depends on the other.

`node_modules/`, `.shadow-cljs/` and `web/dist/js/` are gitignored, so
following this document leaves the tree clean. Lockfiles are not ignored:
`npm install` will leave a `package-lock.json` behind, and whether to commit
it is a decision for this repo rather than a side effect of running these
steps.

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

## 2. The UI build (shadow-cljs + reagent) — what `assets.directory` serves

Through 2026-09-05 this section described `worker/svelte/`, which
`wrangler.jsonc` `main` pointed at. That directory is gone; the UI is now a
ClojureScript (shadow-cljs + reagent, on `kotoba-ui`/`appkit`) build at the
repo root (`deps.edn`, `shadow-cljs.edn`, `src/cloud_itonami/open_jpn_gov/`,
`web/`), and `wrangler.jsonc` `main` now points at `./src/app.ts` directly
(see §3) — `assets.directory` points at `web/dist`, which this build populates.

### A layout caveat before you build

`deps.edn`'s `:cljs` alias resolves `appkit` via a committed relative
`:local/root` path (`../../../../kotoba-lang/appkit`), and its own comment
says this depth is correct **only from the specific worktree the build was
verified in** (an `orgs/cloud-itonami/_wt-open-jpn-gov`-style sibling
worktree inside the superproject), not from an arbitrary checkout path or a
`/tmp` worktree. If `amu compile --target wasm32-browser app` fails to resolve `appkit`,
this is why — check the actual depth from your checkout to
`orgs/kotoba-lang/appkit` before assuming the build itself is broken.

### Build

Heavy builds in this workspace are serialised by the shared resource governor,
so do not invoke `shadow-cljs` / `npm run build` directly. `resource-guard.mjs`
lives in the superproject, *outside* this repo — give it an absolute path
rather than counting `../`:

```bash
ROOT=~/github/com-junkawasaki          # your superproject checkout
npm install
node "$ROOT/scripts/resource-guard.mjs" run build -- amu compile --target wasm32-browser app
```

Per PR #1 (merged 2026-09-05, from an `appkit`-resolving worktree): **Build
completed. (95 files, 0 compiled, 0 warnings, 14.74s)**, emitting
`web/dist/js/main.js`. That run is not independently re-verified by this
rewrite of this document (see the note at the top of this file) — if you hit a
different result, trust what you see over this transcript.

### What you just built

A single static page (`web/dist/index.html` + `web/dist/js/main.js` +
`web/dist/vendor/kotoba-ui.css`): an info card describing this project (name,
kind, route count, whether XRPC is enabled, the public routes, the runtime
bindings, and the source path), ported 1:1 from the content of the former
`worker/svelte/src/routes/+page.svelte` scaffold page. It has no logic of its
own and does not call `worker/src/app.ts` — it is a static description, not a
live client of the roster/XRPC methods below.

---

## 3. `worker/src/app.ts` — the deployable entrypoint, and the upstream check

This is what `wrangler.jsonc` `main` now points at directly (`./src/app.ts`).
It serves the 38-entry roster, the five `com.etzhayyim.apps.openJpnGov.*`
methods, the e-Gov proxy, and the DoDAF/form endpoints — see the README.
`worker/src/xrpc-proxy.ts` (the former SvelteKit `/xrpc/<nsid>` →
MCP-router forwarder) is **not** part of this file and is not wired in; see
the README for why.

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
   record** (re-verified 2026-09-07). Neither does `mcp.etzhayyim.com`, the
   forwarding target `worker/src/xrpc-proxy.ts` used before it was preserved
   unwired. (`etzhayyim.com` itself does resolve.)
2. Deploying today would serve `worker/src/app.ts` (roster, XRPC methods,
   e-Gov proxy — wired) behind the static UI in `web/dist` — this is real
   progress over the previous scaffold-only state, but it has not been
   exercised, so treat it as unverified rather than ready.

`CLAUDE.md` documents `e7m actor deploy .` as the deploy path. That command was
not run and its behaviour here is unverified. The wiring gap described in
earlier versions of this document is closed (`main` now points at
`worker/src/app.ts`); what remains open is that no route has a hostname and no
deploy has been exercised. Treat the deploy story as open until the hostname
exists and a deploy is actually run.
