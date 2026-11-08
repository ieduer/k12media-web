## Current accepted student portal and Yue bridge gate — 2026-11-08T13:49:58.139952+00:00

`paper.bdfz.net` remains on accepted runtime source `0fafb9fafdb305ed4c8fa4a27d0d113b16d285b7`, Pages `9f6e7eac-67b9-4075-8db0-7475b570cd08`, effective 2026-11-08T11:58:40.654687Z. Canonical source is `ieduer/k12media-web`, branch `codex/paper-student-20261107`; public alias `paper-student-exports-202611.k12media-web.pages.dev`; rollback `paper-student-fixed-20261108.k12media-web.pages.dev`. Legacy master/canonical Pages and disabled old Worker remain separate. No new business runtime or bindings were deployed in this continuation.

Accepted: all16 own exams,53 reports,28 answer originals; embedded/list scores, centered reports, original previews/HD downloads, per-exam/all AI ZIP386 entries. The source did not return23 subject answer sets; the cause is unproven, so do not label them definitely unarchived or unpublished. No R2. Encrypted login verification input/results retain the existing7-day policy; entry has no fixed expiry and sessions/catalogs last2hours. Independent preparatory-student acceptance is still pending.

[Public update](https://status.bdfz.net/?update=paper-history-downloads-20261108&revision=1) is now published and verified in immutable API readback, rendered browser page and global/paper RSS. The registered Status tool independently validates the accepted public Pages/DNS channel and preserves the legacy canonical deployment. Source/config/DNS and12 public asset hashes matched. Publication evidence and rollback are in the single report below. This supersedes earlier Status-pending entries.

Latest user direction is Yue direct, not TQMS. Existing teacher login succeeded once, and live `GetAllTestInfo` returned17 tests/38 papers. Three dynamically selected source papers52118/52119/52120 returned permission denial from `GetPaperScore`. For52118 the source also denied `GetAnswerPaperStatusInfo`, `GetItemGroupImageSummaryInfo`, `GetAnswerPaperMissing` and `DownloadInkSynthesis`; zero student records, score rows or image files were returned. These were source-issued current candidates, not fixed historical IDs. Do not replay these denied targets without changed access evidence.

`teacher-yue.js` is an unmounted candidate adapted from Mark34ad49b: bounded source-only catalog, same-session score cache, original-image metadata and download, exact source StudentID checks, no historical/R2 fallback, no guessed filenames or name-only authorization. Five focused tests and browser-target bundling passed. It has not passed real grade/image acceptance and must not be enabled in the student router. A visible catalog is not proof of score permissions; a synthesized roster is not grade data. Cross-source student identity mapping is still required before public projection.

The earlier TQMS candidate is superseded and retained only as a source patch in the evidence directory. Local teacher lookup rejected; later SSO schema recovery hit a DWR batch exception before form submission and was closed when the user switched routes. No TQMS adapter is active.

Evidence/source-patch retention: `retain_hot`, owner01a1b986, review2026-12-08; temporary worktrees/dependencies/builds are removed at closeout. [Single report](/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/student-release/REPORT.md). Older entries below are historical and superseded where this summary differs.

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

## Student portal candidate — 2026-11-08 UTC

This section supersedes the historical login-only flow for the student candidate
branch `codex/paper-student-20261107`. The legacy teacher Worker is separate and
remains disabled. Public activation and exact receipt are tracked in
`/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/integration/`.

The source student flow uses auth type 100030, source-returned school/class
choices, the normal security-check form and authenticated dispatcher. DWR date
literals are decoded as numeric data without eval. The former login-only
`source_form_submitted` state did not establish a session; the portal now verifies
the student homepage and lists only its exams. A prior 47.307-second unknown
result was incorrectly described as a 135-second timeout: its generic catch did
not preserve enough evidence to identify the transport cause.

`STUDENT_SESSION_KEY` is a Pages encrypted secret shared by preview and production.
It seals HttpOnly Secure SameSite cookies and report capabilities with AES-GCM,
bound to the exact host, session and a two-hour lifetime. Entry availability has
no fixed deadline; `STUDENT_LOGIN_TEST_ENABLED=false` closes the portal. No visitor
password or raw source response is stored. Successful-login logs contain only an
opaque receipt, event code and exam count; the receipt does not enable login.

Every exam capability originates from the authenticated student's home. Subject
and image parameters come from that student's report; arbitrary actor/exam/URL
inputs are not accepted. Source HTML loses scripts, event handlers, forms and
external navigation. Reports run in a scriptless sandbox; source charts and own
answer images pass through scoped same-origin endpoints without public caching.
Image-host requests never receive the source login cookie. School/class IDs are
source-derived, including preparatory-school users; synthetic isolation is not a
claim of actual preparatory-account acceptance.

Verification: `node --test worker/tests/student-source.test.mjs
worker/tests/student-preview.test.mjs`; `node scripts/test-student-portal.mjs`
uses locked Miniflare and synthetic source responses, with no source networking.
Build with Node 24.18.0 and locked dependencies via
`node scripts/build-student-preview.mjs <registered-task>/build none`.
One bounded real source login is reserved for hosted candidate acceptance; keep
its cookie in memory and inspect only aggregates. Do not replay after a terminal
rejection or uncertain login. Public rollout requires exact pushed source,
artifact manifest, preview/own-data acceptance and current rollback readback.

## Affinity, school-network login and grade overview candidate — 2026-11-08

Preserve source-issued SERVERID with JSESSIONID/DWRSESSIONID, including rotations
on later source reads. Old sessions without backend affinity require a normal
login. An empty reloaded catalog after a known nonempty catalog is an error, not
a claim that the student has no exams. Same-account cooldown remains60 seconds;
a shared network allows20 distinct submissions per10 seconds. Local cooldown
and source429 are distinct, with Retry-After for the former. No automatic
credential replay or credential database is introduced.

The exam overview uses only subject links in the authenticated student's report.
It shows published scores, valid maxima, rates, levels and scoped report/answer
actions; an unpublished score is distinct from zero. New candidates must prove
all available reports and answer-image bytes on the affected authorized account.
The preparatory-school user will verify after release, per the user's explicit
choice; never infer that acceptance from another account or synthetic fixtures.
Evidence: `/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/completion/`.
Candidate work is not yet a claim of public acceptance.

## Encrypted verification capture — current user correction, 2026-11-08

The user explicitly requires every valid student login submission to be retained
for subsequent testing, including unsuccessful submissions. Earlier receipt-only
logging did not satisfy that requirement and cannot reconstruct past inputs.
New code stores input and outcome separately in dedicated STUDENT_VERIFICATION
KV, with a seven-day automatic retention. Username/password and successful
sealed session are envelope encrypted (RSA-OAEP-SHA256 + AES-256-GCM); only the
public key is deployed. The private JWK is in the existing operator secret store
under PAPER_STUDENT_VERIFY_PRIVATE_JWK. No public read/decrypt route exists.
Raw values must never be printed, copied into reports or ordinary diagnostic logs.
Storage failure before source login stops the submission. Verify actual remote
write/read/decryption and compare to the authorized test credentials in memory
before asking students to test. This new authority supersedes the earlier
receipt-only/no-vault behavior; old records remain unavailable.
CAPABILITY_FIT: stable Workers KV, dedicated namespace, no shared hub or account
identity change. Automatic TTL avoids a scheduler; retain rollback bindings and
unique records, never delete them as task-generated build output.
