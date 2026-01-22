/**
 * SSO Authentication module for K12Media
 * Handles username/password login via sso.k12media.cn
 */

const SSO_BASE_URL = 'https://sso.k12media.cn';
const SSO_LOGIN_URL = `${SSO_BASE_URL}/unify/getToken`;
const AUTH_REDIRECT_URL = 'https://test.k12media.cn/tqms/SSOSDK/GetAuthCode';
const BASE_URL_MAIN = 'https://test.k12media.cn';

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36';

/**
 * Login using username and password via SSO
 * Returns session cookies on success
 */
export async function ssoLogin(username, password) {
    try {
        // Step 1: Get initial SSO session
        const initialResponse = await fetch(`${SSO_LOGIN_URL}?redirecturi=${encodeURIComponent(AUTH_REDIRECT_URL)}`, {
            method: 'GET',
            headers: {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'manual',
        });

        // Extract JSESSIONID and DWRSESSIONID from SSO cookies
        const ssoCookies = extractCookies(initialResponse);
        console.log('SSO initial cookies:', Object.keys(ssoCookies));

        // Step 2: POST login credentials
        const formData = new URLSearchParams({
            'redirecturi': AUTH_REDIRECT_URL,
            'userNo': '29GwbsGX1VhWKDRuTelxyg==', // Encoded school ID
            'j_username': username,
            'j_password': password,
            'select_sty': '29GwbsGX1VhWKDRuTelxyg==',
        });

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
            if (text.includes('密码') || text.includes('password') || text.includes('错误')) {
                return { success: false, error: '用戶名或密碼錯誤' };
            }
            return { success: false, error: `登錄失敗: HTTP ${loginResponse.status}` };
        }

        // Get redirect URL with token
        const redirectUrl = loginResponse.headers.get('Location');
        if (!redirectUrl || !redirectUrl.includes('token=')) {
            return { success: false, error: '無法獲取認證令牌' };
        }

        console.log('SSO redirect URL:', redirectUrl);

        // Step 3: Follow redirect to get test.k12media.cn cookies
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

        // Step 4: Follow any additional redirects to fully establish session
        let currentUrl = authResponse.headers.get('Location');
        let allCookies = { ...authCookies };
        let attempts = 0;

        while (currentUrl && attempts < 5) {
            const followResponse = await fetch(currentUrl.startsWith('http') ? currentUrl : `${BASE_URL_MAIN}${currentUrl}`, {
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
            return { success: false, error: '無法建立會話' };
        }

        const cookieString = formatCookies(allCookies);
        console.log('Final cookie string length:', cookieString.length);

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
 */
function extractCookies(response) {
    const cookies = {};
    const setCookieHeaders = response.headers.getAll ?
        response.headers.getAll('Set-Cookie') :
        [response.headers.get('Set-Cookie')].filter(Boolean);

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
 * Validate cookie by making a test request
 */
export async function validateCookie(cookie, env) {
    try {
        const response = await fetch(`${BASE_URL_MAIN}/tqms/report/ShowStudentImgsAction.a`, {
            method: 'GET',
            headers: {
                'Cookie': cookie,
                'User-Agent': DEFAULT_USER_AGENT,
            },
            redirect: 'manual',
        });

        if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('Location') || '';
            if (location.includes('login') || location.includes('sso')) {
                return { valid: false, message: 'Cookie 已過期，請重新登錄' };
            }
        }

        if (response.status === 200) {
            const text = await response.text();
            if (text.includes('ShowStudentImgsAction') || text.includes('testId')) {
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
