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
export async function fetchExams(cookie) {
    try {
        const response = await fetch(EXAM_LIST_URL, {
            method: 'GET',
            headers: buildHeaders(cookie),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch exam list: ${response.status}`);
        }

        const html = await response.text();
        return parseExamList(html);
    } catch (error) {
        console.error('Error fetching exams:', error);
        return [];
    }
}

/**
 * Parse HTML to extract exam info
 * Matches: onclick="viewTest(121588);" ... >Exam Name</span>
 */
function parseExamList(html) {
    const exams = [];
    // Regex to match: onclick="viewTest(121588);" ... >2025-2026学年第一学期高二元培语文-12.17&nbsp;&nbsp;</span>
    // Updated to be more robust for handling the span tag inside the anchor
    const regex = /onclick="viewTest\((\d+)\);".*?<span[^>]*>([^<]+)<\/span>/g;

    // Also try to find date if possible, but name usually contains it or is enough
    // The provided HTML snippet shows date in a separate <p> tag: <p ...>2025-12-17</p>
    // But parsing that relative to the onclick might be complex with simple regex.
    // Let's stick to ID and Name for now.

    let match;
    while ((match = regex.exec(html)) !== null) {
        const id = parseInt(match[1]);
        let name = match[2].trim().replace(/&nbsp;/g, '').trim();

        // Avoid duplicates if multiple matches (though usually unique per list item)
        if (!exams.find(e => e.id === id)) {
            exams.push({ id, name });
        }
    }

    return exams;
}
