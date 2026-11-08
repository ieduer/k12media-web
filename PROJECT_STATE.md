## Current student portal and premarking teacher candidate — 2026-11-08T23:29:43.945011+00:00

`paper.bdfz.net` remains on accepted runtime source `0fafb9fafdb305ed4c8fa4a27d0d113b16d285b7`, Pages `9f6e7eac-67b9-4075-8db0-7475b570cd08`, effective2026-11-08T11:58:40.654687Z. Source repository `ieduer/k12media-web`, student branch `codex/paper-student-20261107`; public alias `paper-student-exports-202611.k12media-web.pages.dev`; rollback `paper-student-fixed-20261108.k12media-web.pages.dev`. Legacy master/Pages and disabled old Worker remain separate. No public runtime, configuration or source-account change in this batch.

Accepted student scope remains16 own exams,53 reports,28 answer originals; embedded/list scores, centered reports, HD previews/downloads and per-exam/all AI ZIP. The source did not return23 subject answer sets; their cause is unproven. No R2. Existing encrypted verification input/results retain7days; entry has no fixed expiry, sessions/catalogs2hours. [Accepted public update](https://status.bdfz.net/?update=paper-history-downloads-20261108&revision=1) was already verified in stored record, public page and RSS. No new public release occurred, so no additional Status claim is due.

New real source acceptance at2026-11-08T23:24:31Z: one existing-account premarking login succeeded; six `getTestStudentInfo` requests for test10918/papers52090–52095 each returned230 rows, the same unique student-ID set, all with explicit `缺考(无卷)`. Seven total calls, no retries or student login. Response rows contain only testNo/color/testStudentId/testStudentName/status; no school/class or echoed test/paper scope. This establishes those request results, not physical file absence, reason for missing scans, grades, TQWEB identity equivalence or student-facing preparatory acceptance.

Candidate source `bbbf6eedb130040cfcc7f62e1d82bc1cf5c76c33` replaces the former unmounted `teacher-yue.js` management path with `teacher-premarking.js`. It reads the premarking roster, maps explicit no-sheet status to `no_answer_images`, preserves unknown/permission/auth/timeout distinctions, deduplicates reads per teacher/test/paper, and has finite lifetime/request/body bounds. No management grade/ink endpoints, image guesses, R2, source writes or automatic login retries.11 focused tests and browser-target bundling pass. Live protocol acceptance used the bounded operator probe; the compiled adapter has not been deployed or exercised against a real student session.

The adapter remains unmounted. Existing student-source data stays authoritative and untouched. Public teacher supplementation still requires verifiable teacher scores/physical pages and a trusted mapping from the authenticated TQWEB actor to Yue testStudentId plus school/class. A name match or equal numeric IDs across namespaces is insufficient. The prior denied management targets and TQMS attempts remain closed; their unique evidence is retained in the earlier student-release report. Do not request another student login merely to reproduce the confirmed no-sheet roster state.

[Current implementation, source evidence and limits](/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/premarking/REPORT.md). Evidence owner01a1b986, retain_hot through2026-12-08. Sections below are historical; this summary supersedes their current/pending labels where they differ.

# K12Media viewer project state

Last updated: 2026-09-07 PDT / 2026-09-08 UTC.
Owner: suen; privacy release owner codex-docs-completion.
Current objective: the bounded authentication/DWR/exam/image diagnostic privacy repair is published and promoted; keep the existing public API availability and broader security gaps explicit.

- Release source: `ieduer/k12media-web`, branch `codex/k12-diagnostics-privacy-20260908`, source commit `14fc101681c6f490e051fa33d66d76bf061e4170`. The default `master` remains `142ce977`; it is not the new Worker release authority.
- Canonical local checkout remains `canonical/remote-20260827` at `142ce977`, with the preserved privacy patch and documentation changes uncommitted. Do not reset it or assume its branch name proves deployment parity.
- Worker: `k12media-api`, version `0634e136-01ca-4a14-9720-b6127dc700b2` at 100%, deployment `f482daa4-c888-4fec-b582-133c6adc5c24`. Read back at `2026-09-08T03:17:29.885Z`.
- Exact deployed bundle: 260,786 bytes; SHA-256 `dd3309d8c69d35e6f856450109997fe9533d99ab3709be8279d142ba0399f768`. Production content matches the reviewed candidate byte for byte.
- Worker rollback: `b1cbdb66-110f-44f4-99ab-88fc21868763`. The code rollback is separate from external account/data recovery.
- Pages is unchanged: `k12media-web`, deployment `4baa32fe-5e16-4200-9561-39fca7990a1b`; its dirty `82643d2` deployment metadata does not establish a reproducible frontend source. No Pages push/deploy was triggered.
- Configuration, four bindings, compatibility `2024-01-01`, observability, routes, custom domains and public-exposure settings are unchanged.

Completed verification: old Git source rebuilt to the exact live bundle (259,253 bytes, SHA-256 `7426b53eafb8472bfca022ae47d50af39ea615a8183ed26c8b47c0254ab1968d`); unchanged 222,702-byte third-party prefix; independent six-module diff review; 19/19 actual-source synthetic tests; 27/27 restricted Cloudflare edge preview cases across three rounds; three `request_failed` log events with no synthetic canary leakage; exact production allocation/content/config readback. Node 24.18.0, locked Wrangler 4.60.0 / esbuild 0.27.0 / CryptoJS 4.2.0 were used, with no dependency version drift.

Known blockers: the existing frontend calls `k12media-api.bdfz.workers.dev`, but both workers.dev and previews are disabled and there are no routes/custom domains. The public API returned 404 before release. The privacy release preserves this exposure state; real sign-in/search/image/reload acceptance is still blocked, and this task did not use a real account or student data. Existing arbitrary image/redirect/Cookie policies and the general students route's object/array defect were not expanded into this release. Reopening public access needs a separately bounded security review and account acceptance; do not enable it merely to make health checks pass.

Next action: resolve the protected public-activation/security and frontend source gates with the current owner. No further privacy release or retry is needed.
Operations authority: [docs/OPERATIONS.md](docs/OPERATIONS.md).
Evidence and guarded recovery: [release report](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/README.md), [production readback](/Users/ylsuen/CF/reports/operations/local_docs_completion_20260908/k12-production-verification.json), and the unchanged predecessor privacy preimage chain linked from the manual. Current source and evidence are `retain_hot`, review 2026-09-15; release worktree/build/dependencies are disposable and removed by the task runtime manifest at closeout.
