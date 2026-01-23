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
     * @param {string} testId
     * @param {Array} classIds - Optional array of additional class IDs to search
     */
    async getStudents(testId, classIds = []) {
        let endpoint = `/students?testId=${testId}`;
        if (classIds && classIds.length > 0) {
            endpoint += `&classIds=${classIds.join(',')}`;
        }
        return await this.request(endpoint);
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
     * @param {Array} classIds - Optional array of additional class IDs to search
     */
    async getStudentImages(identifier, testId, subjectId = null, classIds = []) {
        let endpoint = `/student/${encodeURIComponent(identifier)}/images?testId=${testId}`;
        if (subjectId) {
            endpoint += `&subjectId=${subjectId}`;
        }
        if (classIds && classIds.length > 0) {
            endpoint += `&classIds=${classIds.join(',')}`;
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

    /**
     * Prepare download - get list of images for preview
     * @param {Object} params - { type: 'student'|'class', identifier?, classId?, subjectIds?, testId, isTeacherClass?, classIds? }
     */
    async prepareDownload(params) {
        return await this.request('/download/prepare', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * Get class students
     * @param {number} classId - Class ID
     * @param {string} testId - Test ID
     * @param {boolean} isTeacherClass - Whether this is a teacher class
     */
    async getClassStudents(classId, testId, isTeacherClass = false) {
        return await this.request(`/class/${classId}/students?testId=${testId}&isTeacherClass=${isTeacherClass ? '1' : '0'}`);
    }

    /**
     * Download images as ZIP file
     * @param {Array} images - Array of image objects with url, studentName, subjectName, pageIndex
     * @param {string} filename - Download filename
     * @param {Function} onProgress - Progress callback (current, total)
     */
    async downloadAsZip(images, filename, onProgress) {
        const zip = new JSZip();
        let completed = 0;

        for (const img of images) {
            try {
                const proxyUrl = this.getProxyImageUrl(img.url);
                const response = await fetch(proxyUrl, {
                    headers: { 'X-Cookie': this.cookie }
                });

                if (response.ok) {
                    const blob = await response.blob();
                    // Create folder structure: studentNo_studentName/subject/page.jpg
                    const folderPath = `${img.studentNo}_${img.studentName}/${img.subjectName}`;
                    const fileName = `第${img.pageIndex}頁.jpg`;
                    zip.file(`${folderPath}/${fileName}`, blob);
                }
            } catch (error) {
                console.error(`Failed to download image: ${img.url}`, error);
            }

            completed++;
            if (onProgress) {
                onProgress(completed, images.length);
            }
        }

        // Generate and download ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true, totalImages: images.length };
    }
}

// Export singleton instance
window.api = new K12MediaAPI();
