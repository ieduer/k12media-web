/**
 * DWR (Direct Web Remoting) API module for K12Media
 * Ported from k12media_download_imgs.py
 */

import { extractDwrSessionId, buildHeaders } from './auth.js';
import { reportDiagnostic } from './diagnostics.js';

const BASE_URL_MAIN = 'https://test.k12media.cn';
const DWR_STUDENT_LIST_URL = `${BASE_URL_MAIN}/tqms/dwr/call/plaincall/SelectSchoolUtil.findStudentListByClassId.dwr`;
const SCHOOL_ID = 3600;

/**
 * Build DWR request body
 * Supports different method signatures
 */
function buildDwrBody(methodName, params, dwrSessionId) {
    const scriptSessionId = `${dwrSessionId}/${Date.now()}`;

    const lines = [
        'callCount=1',
        'nextReverseAjaxIndex=0',
        'c0-scriptName=SelectSchoolUtil',
        `c0-methodName=${methodName}`,
        'c0-id=0',
    ];

    // Add parameters
    params.forEach((param, index) => {
        lines.push(`c0-param${index}=string:${param}`);
    });

    lines.push(
        'batchId=1',
        'instanceId=0',
        'page=/tqms/report/ShowStudentImgsAction.a',
        `scriptSessionId=${scriptSessionId}`
    );

    return lines.join('\n');
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
    // Relaxed regex to handle unquoted noInClass
    // Matches: noInClass:12345 or noInClass:"12345"
    // Also captures name, handling possible quotes
    const pattern = /classId:(\d+),.*?noInClass:['"]?([^"',\}]+)['"]?.*?orgUser:\{.*?name:['"]?([^"',\}]+)['"]?/gs;
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

    if (students.length === 0) {
        reportDiagnostic('dwr_class_empty');
    } else {
        reportDiagnostic('dwr_class_parsed');
    }

    return students;
}

/**
 * Parse single student info from findStudentPersonScoreByNoInClass response
 */
function parseStudentInfo(text) {
    try {
        // Extract fields using regex
        const classIdMatch = text.match(/classId:(\d+)/);
        const nameMatch = text.match(/name:"([^"]+)"/);
        const noInClassMatch = text.match(/noInClass:"([^"]+)"/);
        // Sometimes class name is in orgClass:{name:"..."}
        // But for now we just need the ID to fetch the list later

        if (classIdMatch && nameMatch) {
            return {
                classId: parseInt(classIdMatch[1]),
                name: decodeDwrUnicode(nameMatch[1]),
                noInClass: noInClassMatch ? noInClassMatch[1] : '',
                // We default to false for isTeacherClass as it's safer
                isTeacherClass: false,
                classLabel: `班級 ${classIdMatch[1]}`
            };
        }
    } catch (e) {
        reportDiagnostic('dwr_student_parse_failed');
    }
    return null;
}

/**
 * Fetch students for a single class
 */
async function fetchStudentsForClass(cookie, classConfig, testId) {
    const dwrSessionId = extractDwrSessionId(cookie);
    const params = [
        testId,
        SCHOOL_ID,
        classConfig.classId,
        classConfig.isTeacherClass ? '1' : '0'
    ];

    const body = buildDwrBody('findStudentListByClassId', params, dwrSessionId);

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
    const students = parseStudentList(text, classConfig);

    return { students };
}

/**
 * Find student by Student No directly
 * Uses SelectSchoolUtil.findStudentPersonScoreByNoInClass(testId, testState, studentNo)
 */
export async function findStudentByNo(cookie, testId, studentNo) {
    const dwrSessionId = extractDwrSessionId(cookie);
    // Signature: findStudentPersonScoreByNoInClass(testId, testState, studentNo)
    // Assuming testState is '1' based on python script
    const params = [testId, '1', studentNo];

    const body = buildDwrBody('findStudentPersonScoreByNoInClass', params, dwrSessionId);

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
    return parseStudentInfo(text);
}

/**
 * Fetch all students from all configured classes
 */
export async function fetchAllStudents(cookie, classes, testId, env) {
    const allStudents = [];
    const seen = new Set();
    const debugLogs = [];

    for (const classConfig of classes) {
        try {
            const { students } = await fetchStudentsForClass(cookie, classConfig, testId);

            if (students.length === 0) {
                debugLogs.push('dwr_class_empty');
            }

            for (const student of students) {
                const key = `${student.classId}-${student.noInClass}-${student.name}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    allStudents.push(student);
                }
            }
        } catch (error) {
            reportDiagnostic('dwr_class_fetch_failed');
            debugLogs.push('dwr_class_fetch_failed');
        }
    }

    return { allStudents, debugLogs };
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
