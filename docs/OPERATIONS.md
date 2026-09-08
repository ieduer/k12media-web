# K12Media viewer operations authority

Reviewed: 2026-09-07 PDT / September 8 UTC. Owner: suen. Lifecycle: protected
Worker privacy release accepted; existing public API remains disabled.
Data class: `external_sensitive`.

## Current privacy release and remaining availability gate

The Worker privacy source is published as
`ieduer/k12media-web@14fc101681c6f490e051fa33d66d76bf061e4170` on
`codex/k12-diagnostics-privacy-20260908`. Version
`0634e136-01ca-4a14-9720-b6127dc700b2` is at 100%, deployment
`f482daa4-c888-4fec-b582-133c6adc5c24`; exact content, allocation and config were
read back at `2026-09-08T03:17:29.885Z`. Immediate code rollback is
`b1cbdb66-110f-44f4-99ab-88fc21868763`. See
[source parity](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/k12-source-parity.json),
[edge acceptance](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/k12-edge-preview.json),
and [production readback](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/k12-production-verification.json).

The old source rebuilt to the live bundle byte for byte. Only the six privacy
modules were transplanted; the third-party prefix, dependency versions, four
bindings, compatibility date, observability, routes and domains are unchanged.
Node is now declared exactly as 24.18.0. Build authority is the existing lockfile
(Wrangler 4.60.0, esbuild 0.27.0, CryptoJS 4.2.0), not a floating install.
The release used one temporary worktree and one locked dependency tree; their
exact removal is recorded at closeout in the release report. Reproduce with the
explicit source-hydrate and worker-cwd commands below; compare the candidate SHA-256 `dd3309d8c69d35e6f856450109997fe9533d99ab3709be8279d142ba0399f768`
before any upload. Do not push master: its legacy workflow also deploys Pages.

The public page still references `k12media-api.bdfz.workers.dev`. Both
workers.dev and previews were already disabled; no Worker route/custom domain
exists, and the public API returned 404 before this release. Therefore the
27 restricted edge cases and three fixed `request_failed` log events prove
the changed response/diagnostic paths, not real account/paper acceptance.
No authenticated source request or student data was used. Public activation
requires its own review of the existing image/redirect/Cookie risks and known
students object/array defect; this release does not enable that exposure.
Pages deployment `4baa32fe-5e16-4200-9561-39fca7990a1b` is unchanged, and its
frontend source reproducibility remains separately open.

Read-only exact-release verification (no receipt overwrite):

```sh
/Users/ylsuen/.nvm/versions/node/v24.18.0/bin/node /Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/k12-release.mjs verify --no-write
```

The same guarded controller's explicit `rollback` operation restores only the
immutable Worker baseline and refuses changed allocation/configuration; it is
a recovery mutation, not a health probe. After an explicit rollback, `verify
--no-write` intentionally fails because it requires the new version. Use
`node /Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/k12-release.mjs verify-rollback --no-write`
with Node24.18.0 instead: it requires old version `b1cbdb66-110f-44f4-99ab-88fc21868763`
at 100%, exact old content (259,253 bytes; SHA-256
`7426b53eafb8472bfca022ae47d50af39ea615a8183ed26c8b47c0254ab1968d`), and unchanged
baseline config/entrypoint/Pages/routes/domains. This task did not roll back;
only the expected rejection of the old target while the new version was active
was tested. Never rerun the original baseline capture or overwrite release
receipts. Source rollback and external account data recovery remain separate. Current source, exact old/new bundle and receipts
are `retain_hot`, owner suen / codex-docs-completion, review 2026-09-15. No
new account/data backup, restore or archive acceptance is claimed.

## Source and runtime map

| Resource | Verified location and boundary |
| --- | --- |
| Local source | `/Users/ylsuen/CF/platforms/k12media-web`; repository `ieduer/k12media-web`, preserved local branch `canonical/remote-20260827` tracks `origin/master`; Worker release authority is the published privacy branch above |
| Frontend | `frontend/`; catalog maps `paper.bdfz.net` to Pages `k12media-web`; deployment ID and unchanged status were read back; frontend source reproducibility and the current automatic trigger remain unaccepted |
| Worker | `worker/wrangler.toml`, main `worker/src/index.js`, name `k12media-api`, compatibility `2024-01-01` |
| External service | K12Media SSO, exam metadata and image hosts named in `worker/src/`; user account/answer data remain external-sensitive |
| Bindings | September 7 inventory lists only `BASE_URL_IMG`, `BASE_URL_MAIN`, `SCHOOL_ID`, `TEST_ID` as plain-text names; values are not part of this manual |

Current Worker version and source gaps are in [PROJECT_STATE.md](../PROJECT_STATE.md).
The September 7 local patches remove raw auth/DWR/image diagnostics, upstream
error reflection, DWR debug body snippets and exam HTML/exception/call samples.
`diagnostics.js` admits fixed events; exam debug responses have scalar allowlists
at both module and API boundaries. These changes now match the live privacy bundle exactly. The original
September 7 local-only receipt remains historical. Redirect policy, frontend behavior and full business paths remain separate
review gaps. The July 15 hardened candidate and its 26-test receipt must not be
substituted for current source parity. No real K12Media account flow was executed; the Cloudflare edge preview used intended restricted authentication.

## Preflight and procedure boundaries

1. Read [AGENTS.md](../AGENTS.md), workspace ownership, and the
   [backend router](/Users/ylsuen/CF/runbooks/backend/README.md).
2. Record exact current Worker/Pages versions, source commit and maintenance
   owner. Preserve the current branch and all unrelated work.
3. Inspect the candidate's privacy/security diff before any real-account flow.
4. Resolve exact Node/npm/Wrangler authority. The current exact Node declaration and locked
   Wrangler/esbuild/CryptoJS tuple are recorded above; preserve that graph.
5. Establish a rollback, restricted candidate, privacy-safe diagnostics and
   authenticated readback plan before a release.

`npm --prefix worker run dev` starts a local Worker and can send upstream
requests. `npm --prefix worker run deploy` deploys immediately. Both are
operational entrypoints requiring the preceding scope and gates. Do not use
README's legacy `wrangler publish`, the workspace map's root cwd, or an assumed
GitHub trigger as release authority. The September 8 UTC release used the exact locked build and guarded Worker-only
upload/promotion recorded above. Local synthetic tests are described below.

## Resource location and restore

- Source is the published exact commit and the existing local Git object store.
  After capacity/ownership and runtime-manifest gates, set `K12_RESTORE` and
  `K12_BUILD` to absent, explicitly registered paths under one task root. The
  following hydrates code only and does not deploy:

  ```sh
  (
  set -eu
  export PATH="/Users/ylsuen/.nvm/versions/node/v24.18.0/bin:$PATH"
  K12_SOURCE=14fc101681c6f490e051fa33d66d76bf061e4170
  test -n "$K12_RESTORE" && test ! -e "$K12_RESTORE" && test ! -L "$K12_RESTORE"
  test -n "$K12_BUILD" && test ! -e "$K12_BUILD" && test ! -L "$K12_BUILD"
  git -C /Users/ylsuen/CF/platforms/k12media-web worktree add --detach "$K12_RESTORE" "$K12_SOURCE"
  test "$(git -C "$K12_RESTORE" rev-parse HEAD)" = "$K12_SOURCE"
  git -C "$K12_RESTORE" diff --exit-code HEAD -- .nvmrc worker/package.json worker/package-lock.json worker/wrangler.toml worker/src
  (cd "$K12_RESTORE/worker" && npm ci --ignore-scripts --no-audit --no-fund && npm run deploy -- --dry-run --outdir "$K12_BUILD")
  shasum -a 256 "$K12_BUILD/index.js"
  )
  ```

  Stop on any failed gate/command; the final hash must equal the candidate
  hash above before upload. The source/baseline rebuild was tested in this
  task; a new target still needs its own content verification and cleanup.
  A fresh clone is not needed while this object store is present.
- External K12Media account state and answer data are not owned by this
  repository. No export/restore authority for them was established.
- Historical local security/recovery evidence is referenced by the dated
  2026-07-15 action-log entries. Its present availability and restore receipt
  are `review_required`; do not delete or replace it.
- Git does not restore cookies, sessions, external account data or Pages/Worker
  state. Tested application restore, backup retention and last full restore:
  `review_required`. Keep local source and existing recovery material hot.

## Verification standard

1. Source: exact published privacy commit plus byte-identical live bundle/config parity accepted above; Pages source equivalence remains open.
2. Health: bounded exact-release control-plane/content verification above. Public API remains disabled/404; this is not healthy user-path acceptance.
3. Contract: 27 restricted edge response cases and three redacted failure events passed. Real account sign-in, search/image/reload remain blocked by the public entrypoint.
4. Deploy: exact published source, restricted candidate and guarded Worker-only promotion. Direct deployment from the preserved local inventory branch or default master is forbidden.
5. Dependencies: external K12Media auth and image hosts; separately verify
   portal/Pulse and any discovered shared contracts without changing them.
6. Backup/restore: source and external data boundaries above; restore remains open.
7. Rollback: retain current immutable Worker/Pages baselines independently;
   re-read them before mutation; never treat code rollback as data recovery.
8. Last verified: September 8 UTC production content/allocation/config and restricted edge receipt above; September 7 inventory is historical.

## Local privacy regression and rollback

From the project root, run the source-only suite:

```bash
node --experimental-vm-modules --test worker/tests/auth-privacy.test.mjs worker/tests/data-privacy.test.mjs
```

September 7 result: 19/19 pass (seven original auth cases plus twelve data/debug
privacy cases). Actual auth/index/diagnostics/DWR/exam/image sources run with
synthetic CryptoJS and an in-memory fetch queue with no network fallback. Tests
cover login success/error boundaries, DWR empty/error/dedup/direct lookup, normal
and debug exam parsing, fixed error events, 401/404 behavior and image failure,
bytes, content type, CORS and cache-header compatibility. An additional mocked
exam producer proves the actual API boundary drops unsafe new debug fields.
All test identities, records, HTML and credentials are synthetic; no runtime
fixture paths are created. This is privacy/control-flow evidence, not real
cryptography, dependency, Worker, account or complete business acceptance.

Compatibility: DWR `{allStudents, debugLogs}` and student-not-found envelopes
remain, but diagnostic array strings are fixed event codes. `debug=1` still
returns `{exams, debug}`; debug contains only status/length/counts/booleans and
fixed error codes. Raw HTML, exception text, URL and call-sample fields are
removed. Legitimate exam names/IDs and successful student/image content remain.
The image proxy body/status/content type/CORS/cache behavior was not changed.
The pre-existing general students route still treats the DWR result object as an
array; that projection defect and broader empty-result semantics are outside
this bounded repair and cannot be declared accepted from these tests.
The Node VM API requires the explicit experimental flag; no package or global
runtime version was changed.

Original source/docs and hashes are in
[security-edits.json](/Users/ylsuen/CF/reports/operations/local_docs_remediation_20260907/security-edits.json),
with scope/test limits in
[security-results.json](/Users/ylsuen/CF/reports/operations/local_docs_remediation_20260907/security-results.json).
The next layer is [security-followup-edits.json](/Users/ylsuen/CF/reports/operations/local_docs_remediation_20260907/security-followup-edits.json),
with [follow-up results](/Users/ylsuen/CF/reports/operations/local_docs_remediation_20260907/security-followup-results.json).
The current top layer is
[root-edits.json](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/root-edits.json)
and the guarded local rollback command in the
[release report](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/README.md).
It controls this continuation's three docs, `.nvmrc` and worker package metadata.
First select and unwrap those exact current post-hashes; then match each older
follow-up post-hash and restore its
preimage/remove its task-new test, then apply the original layer only after its
post-hashes match. Never overwrite either historical receipt. Remove only
receipt-listed newly created files after the same guard. Do not reset the repository or deploy the older unsafe
source. This rollback does not change Worker, Pages or account state.

## Monitoring and work space

Monitoring/business-error coverage and exact cost envelope are `review_required`.
Never retain credentials, raw responses, student identifiers or answer images in
operational logs. Future browser work follows the
[browser operations runbook](/Users/ylsuen/CF/runbooks/macos_browser_automation_operations.md).
Create no private cache/clone by default; any build/browser/restore needs disk
and rollout gates plus a registered task manifest. The September 7 VM phase
created only source/tests/docs/receipts, and the K12 synthetic suite creates no
runtime fixture paths. The September 8 release additionally materialized one
registered worktree, locked dependencies and dry-run bundles; their exact
cleanup and retained evidence are recorded in the release report and
`reports/private/runtime-artifact-manifests/20260908-docs-completion.json`. `CAPABILITY_FIT`: `no-new-capability`, local
authentication/data-path diagnostic repair; no new Cloudflare capability or configuration change; only the reviewed Worker diagnostic bundle was promoted.
