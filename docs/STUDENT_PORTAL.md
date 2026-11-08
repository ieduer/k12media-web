# Student portal candidate — login test preview only

As of 2026-11-08 UTC, the user selected `paper.bdfz.net` for a dedicated student
portal. The canonical source for this candidate is the privacy-release branch
`codex/k12-diagnostics-privacy-20260908` plus `codex/paper-student-20261107`.
Default `master` is not the accepted Worker source. Do not trigger its legacy
deployment workflow.

Production page/API entrypoints remain unchanged. `frontend/student.html` and
`worker/src/student-preview.js` provide a bounded self-service login test, not
a student exam application. Each submission uses the observed source student
lookup and, for one matching school/class, its normal encrypted form POST.
The portal never treats a source redirect as verified student identity.

- Preview route: POST `/api/student/login-check`, exact-origin JSON only,
  bounded input, no-store responses and no raw exceptions or source cookies.
  Enabled on `paper.bdfz.net` and `*.k12media-web.pages.dev` preview hosts until an embedded
  deadline. CPU cap 100 ms, no storage/AI bindings, no source retries. Browser
  submits once per page; isolate-local hashed account/IP throttling is only a
  preview safeguard and is not a global production limiter.

The user requested the existing custom domain and Mark's current visual style.
`docs/MARK_STYLE_SOURCE.json` records the observed CSS/font/background hashes.
Only static design assets are reused; no Mark scripts, teacher controls, keys,
account data or backend integrations are included. The custom domain routes to
the source-pinned login-test branch through the existing proxied Pages CNAME.
This is an explicitly scoped public login-test front door, not acceptance of
the student exam portal. The existing production deployment and disabled
teacher Worker remain recoverable; the exact DNS preimage and release receipt
are held by the workspace `paper-login-test-domain-20261108` configuration channel.
- Source refusal, lock, network ambiguity, multiple school selection and form
  submission are distinct. `authenticated` is always false in this test.
  Multiple matches require the official source interface; this preview never
  silently chooses between student identities.
- No exam, image or discussion route is enabled. Successful real source
  identity confirmation remains a separate prerequisite.

Other implemented modules remain building blocks:

- `worker/src/student-source.js`: observed student-only pre-login selection;
  lookup/form submission is expressly unauthenticated. Real session/actor confirmation remains
  missing. Never exchange a successful lookup for a session or exam capability.
- `frontend/js/student-export.mjs`: browser-only ZIP volumes, manifest and score
  CSV. Requires a source-verified complete catalogue and session-bound image
  handles supplied by a future authenticated adapter. It stores no exam data.
- `frontend/js/student-chat.mjs`: text-only anonymous exam discussion UI. It
  requires a membership issuer bound to an authenticated source student and
  source-visible exam; no such issuer is implemented or enabled yet.

Source login is `https://test.k12media.cn:8000/tqweb/login.jsp`, using student
name/phone rather than assuming an exam number is the login name. Its DWR
encrypted strings require `encodeURIComponent`; omitted `instanceId` is rejected
before dispatch. Never eval DWR JavaScript. The public engine/interface GETs
were 404 while dispatcher POSTs worked.

Authentication attempts did not establish a student session. The first source
account ultimately returned a lock message; its prior state and contribution
from earlier malformed requests are unknown. The second named account returned
a generic source refusal. The user now directs students to enter credentials themselves; no further agent retries are authorized by this preview.
Credentials, account identities and raw source responses must stay out of Git.

Tests (Node 24.18.0 with the existing lockfile's crypto-js dependency):

```
node --experimental-vm-modules --test worker/tests/*.test.mjs
```

The new tests are synthetic; ZIP bytes are also decoded by Python's independent
zipfile implementation. The full original privacy tests must remain passing.
No R2 binding, cache, image upload, score write or AI call is added.

Build the isolated preview from a pushed candidate commit (the output path is
registered in the workspace artifact manifest):

```sh
node scripts/build-student-preview.mjs /private/tmp/cf-task-paper-student-20261107/build <DEADLINE_ISO_WITHIN_7_DAYS>
```

Use pinned Wrangler 4.60.0 from `worker/node_modules`, working in
`student-preview/`, branch `paper-student-test-20261108`, never `master`.
Exact account/project/baseline, source/artifact hashes and public readback belong
in the workspace report. Delete only the exact preview deployment to withdraw
it; production must still be the July deployment stated in the operations manual.
The preview is intentionally excluded from nav/User Center and does not announce
an accepted production release.

Before production release: implement and verify actual source actor/session confirmation,
current/historical exam pagination and publication semantics, owned image
capabilities, student dashboard, logout/cookie/origin protections, token issuer
and the time-chat namespace integration. Require two real students and a real
latest/history/image/export acceptance. Reconcile Pages source/security gates,
register exact source/target/artifact/rollback and bounded costs; then publish
through central release authority and verify Status. No production acceptance
is implied by these modules or tests.

Workspace investigation: `reports/operations/paper-student-20261107-01a1b986/REPORT.md`.
