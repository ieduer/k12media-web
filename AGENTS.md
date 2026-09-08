# K12Media viewer operating constraints

Read the workspace AGENTS.md, [current state](PROJECT_STATE.md), and
[operations authority](docs/OPERATIONS.md) before changes. The September 8 UTC privacy release has exact source/bundle parity and restricted edge acceptance as recorded in PROJECT_STATE; public account acceptance remains blocked by the existing disabled API. Future runtime changes require their own bounded release gate. Preserve unrelated work and verify
current action-log ownership before mutation.

## Purpose and authority

- Canonical local path: `/Users/ylsuen/CF/platforms/k12media-web`.
- `frontend/` is the paper viewer; `worker/` proxies the external K12Media
  authentication, exam and image paths. The Worker config is
  `worker/wrangler.toml`, naming `k12media-api`; the root is not a Worker cwd.
- Data class: `external_sensitive`. Credentials, cookies, student lookups and
  answer images must never enter documentation, diagnostic captures or Git.
- The baseline branch `canonical/remote-20260827` is preserved source inventory.
  The current Worker privacy release is the published branch
  `codex/k12-diagnostics-privacy-20260908` at the exact source commit in STATE;
  default master and the July hardened candidate are not its release authority.
- The September 7 local patches remove raw auth/DWR/image diagnostics and API
  error reflection. `worker/src/diagnostics.js` enforces fixed events; never add
  raw errors, cookies, upstream bodies, redirect URLs or identifiers. DWR
  `debugLogs` retains only fixed event strings. Exam `debug=1` preserves the
  `exams`/`debug` envelope but only allowlisted scalar observations, never HTML,
  exception text, URLs or call samples. Legitimate exam/student/image content
  remains in its existing successful response fields.
- Nineteen synthetic actual-source VM privacy/control-flow tests pass. Exact
  live bundle parity, 27 restricted edge cases and three fixed diagnostic events
  were accepted for the privacy release. Real sign-in, broader frontend/security
  behavior and full business acceptance remain unverified; the disabled API
  blocks that path. Do not substitute the July hardened candidate.

## Change boundaries

- Preserve README as historical product documentation. Its `wrangler publish`
  command and automatic Pages deployment claim are not current release
  instructions; source/build triggers and a protected maintenance window must
  be re-established first.
- Do not contact external accounts or replay real cookies merely to validate
  documentation. Use only an explicitly authorized account and bounded flow.
- Worker rollback, Pages rollback and external account state are independent.
- No D1/R2 binding was present in the September 7 name/type inventory; that
  observation is not proof that private information is absent from traffic.
- Do not add another shared AI provider, identity service, or storage layer.
- Node authority is `.nvmrc` and `worker/package.json` engines: 24.18.0;
  the lockfile pins Wrangler 4.60.0 / esbuild 0.27.0 / CryptoJS 4.2.0.
  The exact-source build was verified; external account/data restore is still open.

## Verification and handoff

Use the eight-point verification standard and September 8 UTC release receipt
in the operations manual. Production content, allocation and config match the
reviewed privacy candidate; real sign-in and paper-viewing acceptance remains
blocked by the pre-existing disabled endpoint. Report
only aggregate outcomes, and update state/manual with exact accepted evidence.
