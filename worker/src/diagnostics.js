// Only fixed event names may enter diagnostics. Never pass an error, URL,
// identifier, response body, cookie, credentials or arbitrary metadata here.
const EVENTS = new Set([
  "sso_started",
  "sso_session_received",
  "sso_engine_requested",
  "sso_engine_received",
  "sso_session_embedded",
  "sso_session_missing",
  "sso_session_fallback",
  "sso_session_prepared",
  "credentials_prepared",
  "sso_check_requested",
  "sso_check_received",
  "sso_identity_found",
  "sso_form_requested",
  "sso_form_rejected",
  "sso_token_missing",
  "sso_redirect_received",
  "sso_auth_received",
  "main_engine_requested",
  "main_session_embedded",
  "main_session_missing",
  "main_engine_failed",
  "sso_succeeded",
  "sso_failed",
  "sso_check_unrecognized",
  "cookie_validation_failed",
  "request_failed",
  "dwr_class_empty",
  "dwr_class_parsed",
  "dwr_student_parse_failed",
  "dwr_class_fetch_failed",
  "dwr_direct_lookup_failed",
  "exam_upstream_http_error",
  "exam_fetch_failed",
  "image_fetch_failed"
]);

export function reportDiagnostic(event) {
    const safeEvent = typeof event === 'string' && EVENTS.has(event)
        ? event : 'unexpected_error';
    console.info('k12media', { event: safeEvent });
}

// Debug responses retain only bounded scalar observations, never HTML, URLs,
// error objects/messages, identifiers, samples or arbitrary upstream fields.
export function sanitizeExamDebug(debug = {}) {
    const safe = {};
    if (!debug || typeof debug !== 'object') return safe;
    if (Number.isInteger(debug.status) && debug.status >= 100 && debug.status <= 599) {
        safe.status = debug.status;
    }
    if (Number.isSafeInteger(debug.htmlLength) && debug.htmlLength >= 0) {
        safe.htmlLength = debug.htmlLength;
    }
    for (const key of ['isRedirect', 'containsLogin', 'containsViewTest']) {
        if (typeof debug[key] === 'boolean') safe[key] = debug[key];
    }
    if (debug.error === 'exam_fetch_failed' || debug.error === 'exam_upstream_http_error') {
        safe.error = debug.error;
    }
    if (debug.parseInfo && typeof debug.parseInfo === 'object') {
        safe.parseInfo = {};
        for (const key of ['matchCount', 'viewTestCalls']) {
            if (Number.isSafeInteger(debug.parseInfo[key]) && debug.parseInfo[key] >= 0) {
                safe.parseInfo[key] = debug.parseInfo[key];
            }
        }
        for (const key of ['hasExamKeyword', 'hasTestId']) {
            if (typeof debug.parseInfo[key] === 'boolean') safe.parseInfo[key] = debug.parseInfo[key];
        }
    }
    return safe;
}
