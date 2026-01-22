/**
 * Exam module for fetching exam lists
 */

import { buildHeaders } from './auth.js';

const BASE_URL_MAIN = 'https://test.k12media.cn';
const EXAM_LIST_URL = `${BASE_URL_MAIN}/tqms/exam/ExamAction.a?doQuery`;

/**
 * Fetch and parse the list of available exams
 * @param {string} cookie 
 * @returns {Promise<Array>} List of exams { id, name, date }
 */
export async function fetchExams(cookie, includeDebug = false) {
    const debug = {};
    try {
        debug.url = EXAM_LIST_URL;
        const response = await fetch(EXAM_LIST_URL, {
            method: 'GET',
            headers: buildHeaders(cookie),
        });

        debug.status = response.status;
        debug.isRedirect = response.status >= 300 && response.status < 400;

        if (!response.ok) {
            debug.error = `Failed to fetch exam list: ${response.status}`;
            return includeDebug ? { exams: [], debug } : [];
        }

        const html = await response.text();
        debug.htmlLength = html.length;
        debug.htmlPreview = html.substring(0, 1500);
        debug.containsLogin = html.includes('login') || html.includes('sso') || html.includes('getToken');
        debug.containsViewTest = html.includes('viewTest');

        const parseResult = parseExamList(html);
        debug.parseInfo = parseResult.debug;

        return includeDebug ? { exams: parseResult.exams, debug } : parseResult.exams;
    } catch (error) {
        debug.exception = error.message;
        return includeDebug ? { exams: [], debug } : [];
    }
}

/**
 * Parse HTML to extract exam info
 * Returns { exams: [], debug: {} }
 */
function parseExamList(html) {
    const exams = [];
    const debug = {};

    // FIXED: The actual HTML structure is:
    // <span class="hand" style="cursor: pointer;" onclick="viewTest(121588);">2025-2026学年第一学期高二元培语文-12.17&nbsp;&nbsp;</span>
    // The onclick is ON the span element, not before a separate span
    const regex = /<span[^>]*onclick="viewTest\((\d+)\);"[^>]*>([^<]+)<\/span>/g;

    let match;
    let matchCount = 0;
    while ((match = regex.exec(html)) !== null) {
        matchCount++;
        const id = parseInt(match[1]);
        // Clean up the name: remove &nbsp; and trim
        let name = match[2].trim().replace(/&nbsp;/g, '').replace(/\s+/g, ' ').trim();

        if (!exams.find(e => e.id === id)) {
            exams.push({ id, name });
        }
    }

    debug.matchCount = matchCount;

    // Try alternative patterns if nothing found
    if (exams.length === 0) {
        const viewTestMatches = html.match(/viewTest\(\d+\)/g);
        debug.viewTestCalls = viewTestMatches ? viewTestMatches.length : 0;
        debug.sampleViewTestCalls = viewTestMatches ? viewTestMatches.slice(0, 5) : [];

        // Look for common exam-related content
        debug.hasExamKeyword = html.includes('exam') || html.includes('考试') || html.includes('測驗');
        debug.hasTestId = html.includes('testId') || html.includes('test_id');
    }

    return { exams, debug };
}

