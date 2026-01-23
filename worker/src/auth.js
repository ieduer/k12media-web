/**
 * SSO Authentication module for K12Media
 * Handles username/password login via sso.k12media.cn
 * 
 * Uses DWR (Direct Web Remoting) simulation and AES encryption
 */

import CryptoJS from 'crypto-js';

const SSO_BASE_URL = 'https://sso.k12media.cn';
const SSO_LOGIN_URL = `${SSO_BASE_URL}/unify/getToken`;
const AUTH_REDIRECT_URL = 'https://test.k12media.cn/tqms/SSOSDK/GetAuthCode';
const BASE_URL_MAIN = 'https://test.k12media.cn';
const DWR_URL = `${SSO_BASE_URL}/unify/dwr/call/plaincall/DemoService.findUserInfoDto.dwr`;
const DWR_ENGINE_URL = `${SSO_BASE_URL}/unify/dwr/engine.js`;

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// AES Key for sso.k12media.cn
const AES_KEY = CryptoJS.enc.Utf8.parse("abcdefgabcdefg12");

/**
 * Encrypt word using AES-128-ECB Pkcs7
 * Same as client-side function encrypt(word)
 */
function encrypt(word) {
    if (!word) return "";
    const srcs = CryptoJS.enc.Utf8.parse(word);
    const encrypted = CryptoJS.AES.encrypt(srcs, AES_KEY, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    return encrypted.toString();
}

/**
 * Generate a random DWR page ID (mimics dwr.engine.util.tokenify)
 * Python script uses int(time.time() * 1000) which is Date.now()
 */
function generatePageId() {
    return Date.now().toString();
}

/**
 * Login using username and password via SSO
 * Returns session cookies on success
 */
export async function ssoLogin(username, password) {
    try {
        console.log(`Starting SSO login for user: ${username}`);

        // Step 1: Get initial SSO session to establish JSESSIONID
        const initialResponse = await fetch(`${SSO_LOGIN_URL}?redirecturi=${encodeURIComponent(AUTH_REDIRECT_URL)}`, {
            method: 'GET',
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'manual',
        });

        let ssoCookies = extractCookies(initialResponse);
        console.log('SSO initial cookies:', Object.keys(ssoCookies));

        // Step 1.5: Fetch dwr/engine.js to potentially trigger DWRSESSIONID generation by server
        // DWR often embeds the session ID in the engine.js script body: dwr.engine._dwrSessionId = "..."
        console.log('Fetching engine.js...');
        const engineResponse = await fetch(DWR_ENGINE_URL, {
            method: 'GET',
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Cookie': formatCookies(ssoCookies),
                'Referer': `${SSO_LOGIN_URL}?redirecturi=${encodeURIComponent(AUTH_REDIRECT_URL)}`,
            },
        });

        // Check cookies from engine response
        const engineCookies = extractCookies(engineResponse);
        ssoCookies = { ...ssoCookies, ...engineCookies };
        console.log('Cookies after engine.js:', Object.keys(ssoCookies));

        // Check body for embedded session ID
        const engineText = await engineResponse.text();
        const embeddedSessionMatch = engineText.match(/dwr\.engine\._dwrSessionId\s*=\s*"([^"]+)"/);

        if (embeddedSessionMatch) {
            console.log('Found embedded DWRSESSIONID in engine.js:', embeddedSessionMatch[1]);
            ssoCookies.DWRSESSIONID = embeddedSessionMatch[1];
        } else {
            console.log('No embedded DWRSESSIONID found in engine.js');
        }

        // Generate DWR Session ID handling
        // If server didn't provide DWRSESSIONID (via cookie or script), we try fallback
        // But for CSRF check, we MUST put this ID in the cookie too
        if (!ssoCookies.DWRSESSIONID) {
            console.log('Generating fallback DWRSESSIONID');
            ssoCookies.DWRSESSIONID = Date.now().toString();
        }
        const dwrSessionId = ssoCookies.DWRSESSIONID;
        const pageId = generatePageId();
        const scriptSessionId = `${dwrSessionId}/${pageId}`;

        console.log(`DWR Session Config: DWR=${dwrSessionId}, Page=${pageId}, Script=${scriptSessionId}`);

        // Step 2: Encrypt credentials
        const encUsername = encrypt(username);
        const encPassword = encrypt(password);

        console.log('Credentials encrypted.');

        // DWR Payload aligned with dwr.js structure
        // Added httpSessionId back as it is often required even if empty
        const dwrBody = [
            'callCount=1',
            'nextReverseAjaxIndex=0',
            'c0-scriptName=DemoService',
            'c0-methodName=findUserInfoDto',
            'c0-id=0',
            `c0-param0=string:${encUsername}`,
            `c0-param1=string:${encPassword}`,
            'batchId=1',
            'instanceId=0',
            'page=/unify/getToken',
            'httpSessionId=',
            `scriptSessionId=${scriptSessionId}`
        ].join('\n');

        const cookieHeader = formatCookies(ssoCookies);
        console.log('Sending DWR Request with Cookies:', cookieHeader);

        const dwrResponse = await fetch(DWR_URL, {
            method: 'POST',
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Content-Type': 'text/plain',
                'Origin': SSO_BASE_URL,
                'Referer': `${SSO_LOGIN_URL}?redirecturi=${encodeURIComponent(AUTH_REDIRECT_URL)}`,
                'Cookie': cookieHeader,
            },
            body: dwrBody,
        });

        if (!dwrResponse.ok) {
            throw new Error(`DWR request failed: ${dwrResponse.status}`);
        }

        const dwrText = await dwrResponse.text();
        console.log('DWR Response:', dwrText);

        // Parse DWR response to find userId
        // Response format: {userId:3807672,schoolName:"..."} or userId="3807672"
        // FIXED: Regex now handles:
        // 1. userId:3807672 (unquoted number, from recent logs)
        // 2. userId="3807672" (quoted string, older server version?)
        const userIdMatch = dwrText.match(/userId:['"]?(\d+)['"]?/);

        let userNo = '';
        if (userIdMatch) {
            const userId = userIdMatch[1];
            console.log(`Found userId: ${userId}`);
            userNo = encrypt(userId);
        } else {
            // Return debug info
            const debugInfo = dwrText.substring(0, 500);
            return { success: false, error: `DWR Check Failed (Regex miss). Response: ${debugInfo}` };
        }

        // Step 4: POST login credentials
        const formData = new URLSearchParams({
            'redirecturi': AUTH_REDIRECT_URL,
            'userNo': userNo,
            'j_username': username,
            'j_password': password,
            'select_sty': userNo,
        });

        console.log('Submitting login form...');

        const loginResponse = await fetch(SSO_LOGIN_URL, {
            method: 'POST',
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': SSO_BASE_URL,
                'Referer': `${SSO_LOGIN_URL}?redirecturi=${encodeURIComponent(AUTH_REDIRECT_URL)}`,
                'Cookie': formatCookies(ssoCookies),
            },
            body: formData.toString(),
            redirect: 'manual',
        });

        // Check for 302 redirect (successful login)
        if (loginResponse.status !== 302) {
            const text = await loginResponse.text();
            console.log('Login failed response (first 200 chars):', text.substring(0, 200));

            if (text.includes('密码') || text.includes('password') || text.includes('错误')) {
                const msgMatch = text.match(/<font color="red">([^<]+)<\/font>/) || text.match(/alert\('([^']+)'\)/);
                const specificError = msgMatch ? msgMatch[1] : '用戶名或密碼錯誤';
                return { success: false, error: specificError };
            }
            return { success: false, error: `登錄失敗 (HTTP ${loginResponse.status}): 請檢查賬號密碼或稍後再試` };
        }

        // Get redirect URL with token
        const redirectUrl = loginResponse.headers.get('Location');
        if (!redirectUrl || !redirectUrl.includes('token=')) {
            console.error('Login 302 but no token in location:', redirectUrl);
            return { success: false, error: '無法獲取認證令牌 (No Token)' };
        }

        console.log('SSO redirect URL found via DWR flow');

        // Step 5: Follow redirect to get test.k12media.cn cookies
        const authResponse = await fetch(redirectUrl, {
            method: 'GET',
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': SSO_BASE_URL + '/',
            },
            redirect: 'manual',
        });

        // Extract cookies from auth response
        const authCookies = extractCookies(authResponse);
        console.log('Auth cookies:', Object.keys(authCookies));

        // Step 6: Follow any additional redirects
        let currentUrl = authResponse.headers.get('Location');
        let allCookies = { ...authCookies };

        let attempts = 0;

        while (currentUrl && attempts < 5) {
            // Handle relative URLs
            const nextUrl = currentUrl.startsWith('http') ? currentUrl : `${BASE_URL_MAIN}${currentUrl}`;

            const followResponse = await fetch(nextUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': DEFAULT_USER_AGENT,
                    'Cookie': formatCookies(allCookies),
                },
                redirect: 'manual',
            });

            const newCookies = extractCookies(followResponse);
            allCookies = { ...allCookies, ...newCookies };

            currentUrl = followResponse.headers.get('Location');
            attempts++;
        }

        // Verify we got the necessary cookies
        if (!allCookies.JSESSIONID && !allCookies.SERVERID) {
            return { success: false, error: '無法建立會話 (Missing Cookies)' };
        }

        // Step 7: Fetch test.k12media.cn/tqms/dwr/engine.js to get the correct DWRSESSIONID for the main domain
        // The one we got from SSO domain might not be valid for the test domain DWR calls
        try {
            console.log('Fetching main domain engine.js to ensure valid DWRSESSIONID...');
            const mainEngineResponse = await fetch(`${BASE_URL_MAIN}/tqms/dwr/engine.js`, {
                method: 'GET',
                headers: {
                    'User-Agent': DEFAULT_USER_AGENT,
                    'Cookie': formatCookies(allCookies),
                    'Referer': `${BASE_URL_MAIN}/tqms/report/ShowStudentImgsAction.a`,
                },
            });

            // Extract main domain cookies
            const mainEngineCookies = extractCookies(mainEngineResponse);
            allCookies = { ...allCookies, ...mainEngineCookies };

            // Extract embedded session ID
            const mainEngineText = await mainEngineResponse.text();
            const mainEmbeddedMatch = mainEngineText.match(/dwr\.engine\._dwrSessionId\s*=\s*"([^"]+)"/);

            if (mainEmbeddedMatch) {
                console.log('Found main domain DWRSESSIONID:', mainEmbeddedMatch[1]);
                allCookies.DWRSESSIONID = mainEmbeddedMatch[1];
            } else {
                console.log('No embedded DWRSESSIONID found in main engine.js');
                // Use fallback if not found
                if (!allCookies.DWRSESSIONID) {
                    allCookies.DWRSESSIONID = Date.now().toString();
                }
            }
        } catch (e) {
            console.error('Failed to fetch main engine.js:', e);
            // Non-fatal, continue with what we have
        }

        console.log('Login success via DWR flow. Cookies:', Object.keys(allCookies));

        const cookieString = formatCookies(allCookies);

        return {
            success: true,
            cookie: cookieString,
            message: '登錄成功',
        };

    } catch (error) {
        console.error('SSO login error:', error);
        return { success: false, error: `登錄失敗: ${error.message}` };
    }
}

/**
 * Extract cookies from response headers
 * Cloudflare Workers Headers don't have getAll(), use entries() iterator instead
 */
function extractCookies(response) {
    const cookies = {};
    const setCookieHeaders = [];

    // Modern Workers API support
    if (typeof response.headers.getSetCookie === 'function') {
        const headerList = response.headers.getSetCookie();
        if (headerList && headerList.length > 0) {
            setCookieHeaders.push(...headerList);
        }
    }

    // Use Headers iterator to get all Set-Cookie headers if getSetCookie failed or not supported
    if (setCookieHeaders.length === 0) {
        for (const [key, value] of response.headers.entries()) {
            if (key.toLowerCase() === 'set-cookie') {
                setCookieHeaders.push(value);
            }
        }
    }

    // Fallback: try headers.get() if no cookies found via iterator
    if (setCookieHeaders.length === 0) {
        const single = response.headers.get('Set-Cookie');
        if (single) {
            setCookieHeaders.push(single);
        }
    }

    for (const header of setCookieHeaders) {
        if (!header) continue;
        // Parse each Set-Cookie header
        const parts = header.split(';')[0].split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            cookies[key] = value;
        }
    }

    return cookies;
}

/**
 * Format cookies object to string
 */
function formatCookies(cookies) {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

/**
 * Parse cookie string into object
 */
export function parseCookie(cookieStr) {
    const cookies = {};
    if (!cookieStr) return cookies;

    cookieStr.split(';').forEach(part => {
        const [key, value] = part.split('=').map(s => s.trim());
        if (key && value) {
            cookies[key] = value;
        }
    });

    return cookies;
}

/**
 * Extract DWRSESSIONID from cookie string
 */
export function extractDwrSessionId(cookieStr) {
    const match = cookieStr.match(/DWRSESSIONID=([^;]+)/);
    return match ? match[1] : String(Date.now());
}

/**
 * Validate cookie by making a test request to the exam list page
 * This is the same page that fetchExams uses, so it's more reliable
 */
export async function validateCookie(cookie, env) {
    try {
        // Use the exam list page for validation - this is more reliable
        const response = await fetch(`${BASE_URL_MAIN}/tqms/exam/ExamAction.a?doQuery`, {
            method: 'GET',
            headers: {
                'Cookie': cookie,
                'User-Agent': DEFAULT_USER_AGENT,
            },
            redirect: 'manual',
        });

        // Check for redirect to login
        if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('Location') || '';
            if (location.includes('login') || location.includes('sso') || location.includes('getToken')) {
                return { valid: false, message: 'Cookie 已過期，請重新登錄' };
            }
        }

        if (response.status === 200) {
            const text = await response.text();

            // Check for login page indicators (session expired)
            if (text.includes('getToken') || text.includes('j_password') || text.includes('j_username')) {
                return { valid: false, message: 'Cookie 已過期，請重新登錄' };
            }

            // Check for valid content - viewTest is used in the exam list page
            // Also check for the platform title as a backup indicator
            if (text.includes('viewTest') || text.includes('教育大数据分析平台') || text.includes('ExamAction')) {
                return { valid: true, message: '認證有效' };
            }
        }

        return { valid: false, message: '無法驗證認證狀態' };
    } catch (error) {
        return { valid: false, message: `驗證失敗: ${error.message}` };
    }
}

/**
 * Build headers for k12media requests
 */
export function buildHeaders(cookie) {
    return {
        'User-Agent': DEFAULT_USER_AGENT,
        'Cookie': cookie,
        'Accept': '*/*',
        'Origin': BASE_URL_MAIN,
        'Referer': `${BASE_URL_MAIN}/tqms/report/ShowStudentImgsAction.a`,
    };
}
