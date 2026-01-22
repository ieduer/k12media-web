/**
 * DWR (Direct Web Remoting) API module for K12Media
 * Ported from k12media_download_imgs.py
 */

import { extractDwrSessionId, buildHeaders } from './auth.js';

const BASE_URL_MAIN = 'https://test.k12media.cn';
const DWR_STUDENT_LIST_URL = `${BASE_URL_MAIN}/tqms/dwr/call/plaincall/SelectSchoolUtil.findStudentListByClassId.dwr`;
const TEST_ID = 119274;
const SCHOOL_ID = 3600;

/**
 * Build DWR request body for fetching student list
 */
function buildDwrBody(testId, schoolId, classId, isTeacherClass, dwrSessionId) {
    const teacherFlag = isTeacherClass ? '1' : '0';
    const scriptSessionId = `${dwrSessionId}/${Date.now()}`;

    return [
        'callCount=1',
        'nextReverseAjaxIndex=0',
        'c0-scriptName=SelectSchoolUtil',
        'c0-methodName=findStudentListByClassId',
        'c0-id=0',
        `c0-param0=string:${testId}`,
        `c0-param1=string:${schoolId}`,
        `c0-param2=string:${classId}`,
        `c0-param3=string:${teacherFlag}`,
        'batchId=1',
        'instanceId=0',
        'page=/tqms/report/ShowStudentImgsAction.a',
        `scriptSessionId=${scriptSessionId}`,
    ].join('\n');
}

/**
 * Decode DWR Unicode escape sequences (\\uXXXX)
 */
function decodeDwrUnicode(str) {
    try {
        return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
        );
    } catch {
        return str;
    }
}

/**
 * Parse DWR response to extract student list
 */
function parseStudentList(text, classConfig) {
    const pattern = /classId:(\d+),.*?noInClass:"([^"]+)".*?orgUser:\{.*?name:"([^"]+)"/gs;
    const students = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const [, classIdStr, noInClass, rawName] = match;
        students.push({
            classId: parseInt(classIdStr),
            classLabel: classConfig.label,
            isTeacherClass: classConfig.isTeacherClass,
            noInClass: noInClass,
            name: decodeDwrUnicode(rawName),
        });
    }

    return students;
}

/**
 * Fetch students for a single class
 */
async function fetchStudentsForClass(cookie, classConfig) {
    const dwrSessionId = extractDwrSessionId(cookie);
    const body = buildDwrBody(TEST_ID, SCHOOL_ID, classConfig.classId, classConfig.isTeacherClass, dwrSessionId);

    const response = await fetch(DWR_STUDENT_LIST_URL, {
        method: 'POST',
        headers: {
            ...buildHeaders(cookie),
            'Content-Type': 'text/plain',
        },
        body: body,
    });

    if (!response.ok) {
        throw new Error(`DWR request failed: ${response.status}`);
    }

    const text = await response.text();
    return parseStudentList(text, classConfig);
}

/**
 * Fetch all students from all configured classes
 */
export async function fetchAllStudents(cookie, classes, env) {
    const allStudents = [];
    const seen = new Set();

    for (const classConfig of classes) {
        try {
            const students = await fetchStudentsForClass(cookie, classConfig);

            for (const student of students) {
                const key = `${student.classId}-${student.noInClass}-${student.name}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allStudents.push(student);
                }
            }
        } catch (error) {
            console.error(`Failed to fetch class ${classConfig.classId}:`, error);
        }
    }

    return allStudents;
}

/**
 * Find a student by name or student number
 */
export function findStudent(students, identifier) {
    // Try exact match by student number first
    let found = students.find(s => s.noInClass === identifier);
    if (found) return found;

    // Try exact match by name
    found = students.find(s => s.name === identifier);
    if (found) return found;

    // Try partial match by name
    found = students.find(s => s.name.includes(identifier) || identifier.includes(s.name));
    return found;
}
