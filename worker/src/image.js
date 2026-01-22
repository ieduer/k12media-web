/**
 * Image handling module for K12Media
 * Fetches and proxies answer sheet images
 */

import { buildHeaders } from './auth.js';

const BASE_URL_MAIN = 'https://test.k12media.cn';
const BASE_URL_IMG = 'https://yue.k12media.cn';
const SHOW_STUDENT_FIND_PATH = '/tqms/report/ShowStudentImgsAction.a?findStudentImgs';
const SCHOOL_ID = 3600;
const TEST_STATE = 1;

/**
 * Fetch the HTML page containing student's answer sheet images
 */
async function fetchStudentImgHtml(cookie, student, subjectId, testId) {
    const url = `${BASE_URL_MAIN}${SHOW_STUDENT_FIND_PATH}`;

    const formData = new URLSearchParams({
        schoolId: String(SCHOOL_ID),
        testId: String(testId),
        testState: String(TEST_STATE),
        studentName: student.name,
        classId: String(student.classId),
        isTeacherClass: student.isTeacherClass ? '1' : '0',
        subjectId: String(subjectId),
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            ...buildHeaders(cookie),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch image page: ${response.status}`);
    }

    return await response.text();
}

/**
 * Extract DemoAction image URLs from HTML
 */
function extractImageUrls(html) {
    const imgSrcPattern = /<img[^>]+src=["']([^"']+)["']/gi;
    const urls = [];
    const seen = new Set();
    let match;

    while ((match = imgSrcPattern.exec(html)) !== null) {
        const src = match[1].trim();

        // Only include DemoAction URLs (actual answer images)
        if (src.includes('DemoAction.a') && !seen.has(src)) {
            seen.add(src);

            // Convert relative URLs to absolute
            let fullUrl = src;
            if (src.startsWith('/')) {
                fullUrl = `${BASE_URL_IMG}${src}`;
            } else if (!src.startsWith('http')) {
                fullUrl = `${BASE_URL_IMG}/tqms_image_server/${src}`;
            }

            urls.push(fullUrl);
        }
    }

    return urls;
}

/**
 * Fetch all images for a student and subject
 */
export async function fetchStudentImages(cookie, student, subjectId, testId, env) {
    try {
        const html = await fetchStudentImgHtml(cookie, student, subjectId, testId);
        const imageUrls = extractImageUrls(html);

        return imageUrls.map((url, index) => ({
            pageIndex: index + 1,
            url: url,
            // Return a proxy URL that the frontend can use
            proxyUrl: `/api/proxy-image?url=${encodeURIComponent(url)}`,
        }));
    } catch (error) {
        console.error(`Failed to fetch images for subject ${subjectId}:`, error);
        return [];
    }
}

/**
 * Proxy an image request to bypass CORS
 */
export async function proxyImage(imageUrl, cookie, env) {
    const response = await fetch(imageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Cookie': cookie || '',
            'Referer': `${BASE_URL_MAIN}${SHOW_STUDENT_FIND_PATH}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    const body = await response.arrayBuffer();

    return {
        body: body,
        contentType: contentType,
    };
}
