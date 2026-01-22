/**
 * Authentication module for K12Media
 */

const BASE_URL_MAIN = 'https://test.k12media.cn';

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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            redirect: 'manual',
        });

        // If redirected to login page, cookie is invalid
        if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('Location') || '';
            if (location.includes('login')) {
                return { valid: false, message: 'Cookie 已過期，請重新獲取' };
            }
        }

        // Check if we got the expected page
        if (response.status === 200) {
            const text = await response.text();
            if (text.includes('ShowStudentImgsAction') || text.includes('testId')) {
                return { valid: true, message: '認證成功' };
            }
        }

        return { valid: false, message: '無法驗證 Cookie 狀態' };
    } catch (error) {
        return { valid: false, message: `驗證失敗: ${error.message}` };
    }
}

/**
 * Build headers for k12media requests
 */
export function buildHeaders(cookie) {
    return {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'Cookie': cookie,
        'Accept': '*/*',
        'Origin': BASE_URL_MAIN,
        'Referer': `${BASE_URL_MAIN}/tqms/report/ShowStudentImgsAction.a`,
    };
}
