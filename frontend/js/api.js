/**
 * API Client for K12Media Worker
 */

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:8787'
    : 'https://k12media-api.bdfz.workers.dev';

class K12MediaAPI {
    constructor() {
        this.cookie = null;
    }

    /**
     * Set the authentication cookie
     */
    setCookie(cookie) {
        this.cookie = cookie;
        localStorage.setItem('k12media_cookie', cookie);
    }

    /**
     * Get stored cookie
     */
    getCookie() {
        if (!this.cookie) {
            this.cookie = localStorage.getItem('k12media_cookie');
        }
        return this.cookie;
    }

    /**
     * Clear stored cookie
     */
    clearCookie() {
        this.cookie = null;
        localStorage.removeItem('k12media_cookie');
    }

    /**
     * Make API request with authentication
     */
    async request(endpoint, options = {}) {
        // Ensure endpoint starts with /
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        // Construct URL with /api prefix
        const url = `${API_BASE}/api${path}`;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.cookie) {
            headers['X-Cookie'] = this.cookie;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    }

    /**
     * Validate cookie
     */
    async validateCookie(cookie) {
        return await this.request('/auth', {
            method: 'POST',
            body: JSON.stringify({ cookie }),
        });
    }

    /**
     * Login with username/password
     */
    async login(username, password) {
        return await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }

    /**
     * Get list of exams
     */
    async getExams() {
        return await this.request('/exams');
    }

    /**
     * Get all students
     */
    async getStudents(testId) {
        return await this.request(`/students?testId=${testId}`);
    }

    /**
     * Get subject list
     */
    async getSubjects() {
        return await this.request('/subjects');
    }

    /**
     * Get student images
     * @param {string} identifier - Student number or name
     * @param {string|null} testId - Exam ID
     * @param {number|null} subjectId - Optional subject ID (null for all)
     */
    async getStudentImages(identifier, testId, subjectId = null) {
        let endpoint = `/student/${encodeURIComponent(identifier)}/images?testId=${testId}`;
        if (subjectId) {
            endpoint += `&subjectId=${subjectId}`;
        }
        return await this.request(endpoint);
    }

    /**
     * Get proxied image URL
     */
    getProxyImageUrl(originalUrl) {
        return `${API_BASE}/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
    }

    /**
     * Health check
     */
    async healthCheck() {
        return await this.request('/health');
    }
}

// Export singleton instance
window.api = new K12MediaAPI();
