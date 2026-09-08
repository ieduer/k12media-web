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
