## Current accepted student portal and teacher-source blocker — 2026-11-08T12:43:12.889364+00:00

https://paper.bdfz.net serves source `0fafb9fafdb305ed4c8fa4a27d0d113b16d285b7`
from `ieduer/k12media-web`, branch `codex/paper-student-20261107`, deployment
`9f6e7eac-67b9-4075-8db0-7475b570cd08`, effective 2026-11-08T11:58:40.654687Z.
Public alias `paper-student-exports-202611.k12media-web.pages.dev` is production:
do not overwrite it with candidate uploads. Legacy master/canonical Pages and
old disabled Worker remain separate historical surfaces. The registered one-use
preview/DNS transaction governs this branch. Rollback alias:
`paper-student-fixed-20261108.k12media-web.pages.dev` (source226fc29).

All exams automatically show subject scores in embedded/list views. Per-exam and
all-history ZIP include JSON/CSV, report text/tables/HTML/charts and original answer
images. Reports fit/center; all answer pages preview, zoom and download at source
resolution. Source student IDs must match sealed session actor before capabilities
are issued. Images have a30-second stream deadline and one transient read retry;
login submissions are never automatically replayed. No data is transferred to R2.

Actual account acceptance:16 exams,16 full reports,37 subject reports,28 original
answer pages. ZIP386 entries/11931457 bytes; all208 images decoded (28 answer and
180 report charts), CRC and credential/URL exclusion passed. Source explicitly
lacks23 subject answer sets; ZIP manifest lists them and remains incomplete.
Desktop/mobile embedded/list, report fit and original-size zoom passed.33 focused
unit checks and12 workerd groups passed. Latest isolated and public real login,
grade/full/subject/image-data/HD attachment paths passed; all12 public assets match.

New login inputs/results are encrypted in dedicated verification KV for7 days;
private decryption key stays in the operator secret store. Latest vault readback
has5 inputs, all the authorized test account. There is no
independent preparatory-student submission to accept. The test student is not
preparatory and correctly has no Haidian midterm. Entry has no fixed expiry;
sealed student sessions/catalogs last2 hours.

Teacher supplement remains unaccepted after historical-paper checks. Source SSO
identity lookup accepted the existing owner credential, but both the original and
corrected service-provider-initiated callback ended at the teacher application's
login error page. The displayed error is generic username/password rejection; it
does not establish that the same credential is invalid in the student or Yue
systems. No further teacher-analysis login replay is allowed without new evidence.
Historical TQMS test137797/subject1/class94856 exports returned upstream302 for
both primary and cron sources, so neither produced grades. Mark historical
paper50473/test10644 returned zero pages with timeout in both current-session and
verified-readonly-env modes. Its archived task route returned423 before source
access; archive locks were preserved. The exact item-group945018 records route
returned500/AbortError. Historical receipts identify real existing papers but do
not establish current source access. No teacher adapter was enabled, no production
release or source score/role/password change was made, and no data moved to R2.

The user has superseded waiting for new papers: validate against existing history.
Student-owned reads remain the accepted path; only missing components may be
supplemented after exact source user ID plus school/class agreement. Name-only
matching is forbidden. Teacher failure must preserve student data and login.
The blocking next step is a demonstrably readable teacher source session/route,
followed by same-student grade/report/full-image acceptance. New student login
attempts cannot resolve the current teacher-source failure.

Student-led preparatory acceptance remains pending. Status for the earlier
accepted student release remains pending its registered preview/DNS channel
support; no teacher-success update is publishable. See the
[historical-source diagnosis](/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/teacher-history/REPORT.md).

Current evidence and remaining work:
[release report](/Users/ylsuen/CF/reports/operations/paper-student-20261107-01a1b986/completion/REPORT.md).
Earlier sections below are historical and superseded where this summary differs.


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
