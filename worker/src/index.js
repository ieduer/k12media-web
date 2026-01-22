/**
 * K12Media API Proxy Worker
 * 
 * Routes:
 * - POST /api/auth      - Validate cookie
 * - GET  /api/students  - Get all students from configured classes
 * - GET  /api/student/:identifier/images - Get images for a student
 * - GET  /api/proxy-image - Proxy image requests
 */

import { handleAuth, validateCookie } from './auth.js';
import { fetchAllStudents, findStudent } from './dwr.js';
import { fetchStudentImages, proxyImage } from './image.js';

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

      if (path === '/api/subjects') {
        return jsonResponse({ subjects: SUBJECT_NAMES });
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

  const students = await fetchAllStudents(cookie, CLASSES, env);
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

  // First, find the student
  const students = await fetchAllStudents(cookie, CLASSES, env);
  const student = findStudent(students, identifier);

  if (!student) {
    return jsonResponse({ error: 'Student not found' }, 404);
  }

  // Fetch images for specified subject or all subjects
  const subjects = subjectId ? [parseInt(subjectId)] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const result = {};

  for (const sid of subjects) {
    const images = await fetchStudentImages(cookie, student, sid, env);
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
