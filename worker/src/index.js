/**
 * K12Media API Proxy Worker
 * 
 * Routes:
 * - POST /api/login      - Login with username/password via SSO
 * - POST /api/auth       - Validate cookie
 * - GET  /api/students   - Get all students from configured classes
 * - GET  /api/student/:identifier/images - Get images for a student
 * - GET  /api/proxy-image - Proxy image requests
 */

import { validateCookie, ssoLogin } from './auth.js';
import { fetchAllStudents, findStudent } from './dwr.js';
import { fetchStudentImages, proxyImage } from './image.js';
import { fetchExams } from './exam.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Cookie',
};

// Class configuration (from k12media_download_imgs.py)
const CLASSES = [
  { classId: 91268, isTeacherClass: false, label: '格物3班' },
  { classId: 91272, isTeacherClass: false, label: '致知3班' },
  { classId: 1883835, isTeacherClass: true, label: '格物3班' },
  { classId: 1883842, isTeacherClass: true, label: '致知3班' },
];

const SUBJECT_NAMES = {
  1: '語文',
  2: '數學',
  3: '英語',
  4: '物理',
  5: '化學',
  6: '生物',
  7: '政治',
  8: '歷史',
  9: '地理',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route handling
      if (path === '/api/login' && request.method === 'POST') {
        return await handleLoginRoute(request, env);
      }

      if (path === '/api/auth' && request.method === 'POST') {
        return await handleAuthRoute(request, env);
      }

      if (path === '/api/students' && request.method === 'GET') {
        return await handleStudentsRoute(request, env);
      }

      if (path.startsWith('/api/student/') && path.endsWith('/images')) {
        return await handleStudentImagesRoute(request, env, path);
      }

      if (path === '/api/proxy-image' && request.method === 'GET') {
        return await handleProxyImageRoute(request, env);
      }

      if (path === '/api/exams' && request.method === 'GET') {
        return await handleExamsRoute(request, env);
      }

      if (path === '/api/subjects') {
        return jsonResponse({ subjects: SUBJECT_NAMES });
      }

      // Class students endpoint
      if (path.match(/^\/api\/class\/\d+\/students$/) && request.method === 'GET') {
        return await handleClassStudentsRoute(request, env, path);
      }

      // Download preparation endpoint
      if (path === '/api/download/prepare' && request.method === 'POST') {
        return await handleDownloadPrepareRoute(request, env);
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      return jsonResponse({ error: 'Not Found' }, 404);
    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ error: error.message }, 500);
    }
  },
};

// Route handlers
async function handleLoginRoute(request, env) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return jsonResponse({ error: '用戶名和密碼不能為空' }, 400);
  }

  const result = await ssoLogin(username, password);
  return jsonResponse(result);
}

async function handleAuthRoute(request, env) {
  const body = await request.json();
  const cookie = body.cookie;

  if (!cookie) {
    return jsonResponse({ error: 'Cookie is required' }, 400);
  }

  const result = await validateCookie(cookie, env);
  return jsonResponse(result);
}

async function handleStudentsRoute(request, env) {
  const cookie = request.headers.get('X-Cookie');
  if (!cookie) {
    return jsonResponse({ error: 'X-Cookie header is required' }, 401);
  }

  const url = new URL(request.url);
  const testId = url.searchParams.get('testId');

  if (!testId) {
    return jsonResponse({ error: 'testId parameter is required' }, 400);
  }

  const students = await fetchAllStudents(cookie, CLASSES, testId, env);
  return jsonResponse({ students, count: students.length });
}

async function handleStudentImagesRoute(request, env, path) {
  const cookie = request.headers.get('X-Cookie');
  if (!cookie) {
    return jsonResponse({ error: 'X-Cookie header is required' }, 401);
  }

  // Extract identifier from path: /api/student/{identifier}/images
  const matches = path.match(/\/api\/student\/(.+)\/images/);
  if (!matches) {
    return jsonResponse({ error: 'Invalid path' }, 400);
  }

  const identifier = decodeURIComponent(matches[1]);
  const url = new URL(request.url);
  const subjectId = url.searchParams.get('subjectId');
  const testId = url.searchParams.get('testId');

  if (!testId) {
    return jsonResponse({ error: 'testId parameter is required' }, 400);
  }

  // First, find the student
  const students = await fetchAllStudents(cookie, CLASSES, testId, env);
  const student = findStudent(students, identifier);

  if (!student) {
    return jsonResponse({ error: 'Student not found' }, 404);
  }

  // Fetch images for specified subject or all subjects
  const subjects = subjectId ? [parseInt(subjectId)] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const result = {};

  for (const sid of subjects) {
    const images = await fetchStudentImages(cookie, student, sid, testId, env);
    result[sid] = {
      subjectName: SUBJECT_NAMES[sid] || `科目${sid}`,
      images: images,
    };
  }

  return jsonResponse({
    student: {
      name: student.name,
      noInClass: student.noInClass,
      classLabel: student.classLabel,
      classId: student.classId,
    },
    subjects: result,
  });
}

async function handleProxyImageRoute(request, env) {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');
  const cookie = request.headers.get('X-Cookie');

  if (!imageUrl) {
    return jsonResponse({ error: 'url parameter is required' }, 400);
  }

  const imageResponse = await proxyImage(imageUrl, cookie, env);

  return new Response(imageResponse.body, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': imageResponse.contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function handleClassStudentsRoute(request, env, path) {
  const cookie = request.headers.get('X-Cookie');
  if (!cookie) {
    return jsonResponse({ error: 'X-Cookie header is required' }, 401);
  }

  const url = new URL(request.url);
  const testId = url.searchParams.get('testId');
  const isTeacherClass = url.searchParams.get('isTeacherClass') === '1';

  if (!testId) {
    return jsonResponse({ error: 'testId parameter is required' }, 400);
  }

  // Extract classId from path
  const matches = path.match(/\/api\/class\/(\d+)\/students/);
  if (!matches) {
    return jsonResponse({ error: 'Invalid path' }, 400);
  }

  const classId = parseInt(matches[1]);
  const classConfig = CLASSES.find(c => c.classId === classId);
  const config = classConfig || { classId, isTeacherClass, label: `班級 ${classId}` };

  const allStudents = await fetchAllStudents(cookie, [config], testId, env);
  return jsonResponse({ students: allStudents, count: allStudents.length });
}

async function handleDownloadPrepareRoute(request, env) {
  const cookie = request.headers.get('X-Cookie');
  if (!cookie) {
    return jsonResponse({ error: 'X-Cookie header is required' }, 401);
  }

  const body = await request.json();
  const { type, identifier, classId, subjectIds, testId, isTeacherClass } = body;

  if (!testId) {
    return jsonResponse({ error: 'testId is required' }, 400);
  }

  const subjects = subjectIds && subjectIds.length > 0 ? subjectIds : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const result = { images: [], students: [] };

  if (type === 'student') {
    // Single student download
    if (!identifier) {
      return jsonResponse({ error: 'identifier is required for student download' }, 400);
    }

    const students = await fetchAllStudents(cookie, CLASSES, testId, env);
    const student = findStudent(students, identifier);

    if (!student) {
      return jsonResponse({ error: 'Student not found' }, 404);
    }

    result.students.push({
      name: student.name,
      noInClass: student.noInClass,
      classLabel: student.classLabel,
    });

    for (const sid of subjects) {
      const images = await fetchStudentImages(cookie, student, sid, testId, env);
      for (const img of images) {
        result.images.push({
          studentName: student.name,
          studentNo: student.noInClass,
          subjectId: sid,
          subjectName: SUBJECT_NAMES[sid] || `科目${sid}`,
          pageIndex: img.pageIndex,
          url: img.url,
        });
      }
    }
  } else if (type === 'class') {
    // Class batch download
    if (!classId) {
      return jsonResponse({ error: 'classId is required for class download' }, 400);
    }

    const classConfig = CLASSES.find(c => c.classId === classId);
    const config = classConfig || { classId, isTeacherClass: isTeacherClass || false, label: `班級 ${classId}` };

    const students = await fetchAllStudents(cookie, [config], testId, env);

    for (const student of students) {
      result.students.push({
        name: student.name,
        noInClass: student.noInClass,
        classLabel: student.classLabel,
      });

      for (const sid of subjects) {
        const images = await fetchStudentImages(cookie, student, sid, testId, env);
        for (const img of images) {
          result.images.push({
            studentName: student.name,
            studentNo: student.noInClass,
            subjectId: sid,
            subjectName: SUBJECT_NAMES[sid] || `科目${sid}`,
            pageIndex: img.pageIndex,
            url: img.url,
          });
        }
      }
    }
  } else {
    return jsonResponse({ error: 'type must be "student" or "class"' }, 400);
  }

  return jsonResponse({
    totalImages: result.images.length,
    totalStudents: result.students.length,
    students: result.students,
    images: result.images,
  });
}

async function handleExamsRoute(request, env) {
  const cookie = request.headers.get('X-Cookie');
  if (!cookie) {
    return jsonResponse({ error: 'X-Cookie header is required' }, 401);
  }

  const url = new URL(request.url);
  const includeDebug = url.searchParams.get('debug') === '1';

  const result = await fetchExams(cookie, includeDebug);

  if (includeDebug) {
    return jsonResponse(result);
  } else {
    return jsonResponse({ exams: result });
  }
}

// Utility function
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
