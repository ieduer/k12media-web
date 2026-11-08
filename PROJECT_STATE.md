## Current accepted student portal and Yue bridge gate — 2026-11-08T13:49:58.139952+00:00

`paper.bdfz.net` remains on accepted runtime source `0fafb9fafdb305ed4c8fa4a27d0d113b16d285b7`, Pages `9f6e7eac-67b9-4075-8db0-7475b570cd08`, effective 2026-11-08T11:58:40.654687Z. Canonical source is `ieduer/k12media-web`, branch `codex/paper-student-20261107`; public alias `paper-student-exports-202611.k12media-web.pages.dev`; rollback `paper-student-fixed-20261108.k12media-web.pages.dev`. Legacy master/canonical Pages and disabled old Worker remain separate. No new business runtime or bindings were deployed in this continuation.

Accepted: all16 own exams,53 reports,28 answer originals; embedded/list scores, centered reports, original previews/HD downloads, per-exam/all AI ZIP386 entries. The source did not return23 subject answer sets; the cause is unproven, so do not label them definitely unarchived or unpublished. No R2. Encrypted login verification input/results retain the existing7-day policy; entry has no fixed expiry and sessions/catalogs last2hours. Independent preparatory-student acceptance is still pending.

[Public update](https://status.bdfz.net/?update=paper-history-downloads-20261108&revision=1) is now published and verified in immutable API readback, rendered browser page and global/paper RSS. The registered Status tool independently validates the accepted public Pages/DNS channel and preserves the legacy canonical deployment. Source/config/DNS and12 public asset hashes matched. Publication evidence and rollback are in the single report below. This supersedes earlier Status-pending entries.

Latest user direction is Yue direct, not TQMS. Existing teacher login succeeded once, and live `GetAllTestInfo` returned17 tests/38 papers. Three dynamically selected source papers52118/52119/52120 returned permission denial from `GetPaperScore`. For52118 the source also denied `GetAnswerPaperStatusInfo`, `GetItemGroupImageSummaryInfo`, `GetAnswerPaperMissing` and `DownloadInkSynthesis`; zero student records, score rows or image files were returned. These were source-issued current candidates, not fixed historical IDs. Do not replay these denied targets without changed access evidence.

`teacher-yue.js` is an unmounted candidate adapted from Mark34ad49b: bounded source-only catalog, same-session score cache, original-image metadata and download, exact source StudentID checks, no historical/R2 fallback, no guessed filenames or name-only authorization. Five focused tests and browser-target bundling passed. It has not passed real grade/image acceptance and must not be enabled in the student router. A visible catalog is not proof of score permissions; a synthesized roster is not grade data. Cross-source student identity mapping is still required before public projection.

The earlier TQMS candidate is superseded and retained only as a source patch in the evidence directory. Local teacher lookup rejected; later SSO schema recovery hit a DWR batch exception before form submission and was closed when the user switched routes. No TQMS adapter is active.

Evidence/source-patch retention: `retain_hot`, owner01a1b986, review2026-12-08; temporary worktrees/dependencies/builds are removed at closeout. [Single report](/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/student-release/REPORT.md). Older entries below are historical and superseded where this summary differs.


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
