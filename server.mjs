import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const hostAddress = process.env.HOST || '127.0.0.1';
const staticRoot = path.join(root, 'dist', 'FocusFlowApp', 'browser');
const allowedHosts = new Set(
  (process.env.CANVAS_ALLOWED_HOSTS || 'canvas.tip.edu.ph')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);
const maxBodyBytes = 16 * 1024;
const requestTimeoutMs = 20_000;

export class CanvasApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

export async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw new CanvasApiError(413, 'Request body is too large.');
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new CanvasApiError(400, 'Request body must be valid JSON.');
  }
}

function validatedHost(value) {
  if (typeof value !== 'string' || value.length > 255) {
    throw new CanvasApiError(400, 'Enter a valid Canvas domain.');
  }

  let url;
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    throw new CanvasApiError(400, 'Enter a valid Canvas domain.');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !allowedHosts.has(hostname)
  ) {
    throw new CanvasApiError(
      400,
      'This Canvas domain is not allowed. Configure CANVAS_ALLOWED_HOSTS on the server.',
    );
  }
  return hostname;
}

async function canvasRequest(host, token, url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch {
    throw new CanvasApiError(502, 'Could not connect securely to Canvas. Check the domain and try again.');
  }

  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? 401 : 502;
    throw new CanvasApiError(
      status,
      response.status === 401 || response.status === 403
        ? 'Canvas rejected this access token. Check that it is active and try again.'
        : `Canvas returned an error (HTTP ${response.status}).`,
    );
  }

  try {
    return {
      data: await response.json(),
      next: response.headers
        .get('link')
        ?.split(',')
        .map((link) => /<([^>]+)>;\s*rel="?next"?/.exec(link)?.[1])
        .find(Boolean) ?? null,
    };
  } catch {
    throw new CanvasApiError(502, 'Canvas returned an unreadable response.');
  }
}

async function canvasJson(host, token, resource) {
  const url = new URL(`/api/v1/${resource}`, `https://${host}`);
  return (await canvasRequest(host, token, url)).data;
}

async function canvasList(host, token, resource) {
  const results = [];
  let url = new URL(`/api/v1/${resource}`, `https://${host}`);
  let pageCount = 0;

  while (url) {
    if (url.origin !== `https://${host}` || !url.pathname.startsWith('/api/v1/')) {
      throw new CanvasApiError(502, 'Canvas returned an invalid pagination link.');
    }
    if (pageCount >= 20) {
      throw new CanvasApiError(502, 'Canvas returned too many pages. Narrow your active courses and try again.');
    }

    const response = await canvasRequest(host, token, url);
    if (!Array.isArray(response.data)) {
      throw new CanvasApiError(502, 'Canvas returned an invalid list response.');
    }
    results.push(...response.data);
    url = response.next ? new URL(response.next) : null;
    pageCount += 1;
  }

  return results;
}

function displayDueDate(value) {
  if (!value) {
    return { dueAt: null };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { dueAt: null };
  }
  return { dueAt: date.toISOString() };
}

function courseCode(course) {
  return course.course_code || course.name?.slice(0, 8) || `C-${course.id}`;
}

export async function syncCanvas(body) {
  const host = validatedHost(body?.domain || 'canvas.tip.edu.ph');
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token || token.length > 4096 || /[\r\n]/.test(token)) {
    throw new CanvasApiError(400, 'Enter a valid Canvas access token.');
  }

  const profile = await canvasJson(host, token, 'users/self/profile');
  const rawCourses = await canvasList(
    host,
    token,
    'courses?enrollment_state=active&include[]=term&per_page=100',
  );
  if (!Array.isArray(rawCourses)) {
    throw new CanvasApiError(502, 'Canvas returned an invalid course list.');
  }

  const courses = rawCourses.filter((course) => course && (course.name || course.course_code));
  const coursesById = new Map(courses.map((course) => [Number(course.id), course]));
  let assignments = [];
  let plannerFailed = false;
  let warning;

  try {
    const plannerItems = await canvasList(host, token, 'planner/items?per_page=100');
    if (!Array.isArray(plannerItems)) {
      throw new CanvasApiError(502, 'Canvas returned an invalid planner response.');
    }
    assignments = plannerItems
      .filter((item) => ['assignment', 'quiz'].includes(item.plannable_type))
      .map((item) => {
      const course = coursesById.get(Number(item.course_id));
      const due = displayDueDate(item.plannable?.due_at || item.plannable_date);
      const assignmentId = String(item.plannable?.id || item.id);
      return {
        id: `canvas-${item.course_id || 'course'}-${assignmentId}`,
        title: item.plannable?.title || item.title || 'Canvas assignment',
        courseCode: course ? courseCode(course) : 'CANVAS',
        ...due,
        duration: item.plannable_type === 'quiz' ? 45 : 50,
        priority: 'high',
        ticketId: `CNV-${item.course_id || 'COURSE'}-${assignmentId}`,
      };
      });
  } catch (error) {
    if (!(error instanceof CanvasApiError) || ![401, 502].includes(error.status)) {
      throw error;
    }
    plannerFailed = true;
  }

  if (assignments.length === 0 && courses.length > 0) {
    const results = await Promise.allSettled(
      courses.slice(0, 30).map(async (course) => {
        const rawAssignments = await canvasList(
          host,
          token,
          `courses/${encodeURIComponent(course.id)}/assignments?per_page=100&order_by=due_at`,
        );
        if (!Array.isArray(rawAssignments)) {
          throw new CanvasApiError(502, 'Canvas returned an invalid assignment list.');
        }
        return rawAssignments.map((assignment) => {
          const due = displayDueDate(assignment.due_at);
          return {
            id: `canvas-${course.id}-${assignment.id}`,
            title: assignment.name || 'Canvas assignment',
            courseCode: courseCode(course),
            ...due,
            duration: assignment.quiz_id ? 45 : 50,
            priority: 'high',
            ticketId: `CNV-${course.id}-${assignment.id}`,
          };
        });
      }),
    );

    let successfulCourses = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successfulCourses += 1;
        assignments.push(...result.value);
      }
    }
    if (successfulCourses === 0 && results.length > 0) {
      throw new CanvasApiError(502, 'Canvas assignments could not be loaded. Try syncing again.');
    }
    if (courses.length > 30) {
      warning = 'Canvas planner is unavailable; assignments were read from the first 30 active courses only.';
    }
  } else if (plannerFailed && courses.length === 0) {
    throw new CanvasApiError(502, 'Canvas planner is unavailable and no courses were found.');
  }

  return {
    success: true,
    student: { name: profile.name || profile.short_name || 'Canvas student' },
    courses: courses.map((course) => ({
      id: String(course.id),
      name: course.name || course.course_code || `Course ${course.id}`,
      code: courseCode(course),
    })),
    assignments,
    warning,
  };
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);

async function serveStatic(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid URL.' });
    return;
  }

  const requestedFile = path.resolve(staticRoot, `.${pathname}`);
  if (requestedFile !== staticRoot && !requestedFile.startsWith(`${staticRoot}${path.sep}`)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  let filePath = requestedFile;
  try {
    if ((await stat(filePath)).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    await stat(filePath);
  } catch {
    filePath = path.join(staticRoot, 'index.html');
  }

  try {
    const contents = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    sendJson(response, 404, { error: 'Production build not found. Run npm run build first.' });
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (pathname === '/api/canvas/sync' && request.method === 'POST') {
    try {
      const body = await readJson(request);
      sendJson(response, 200, await syncCanvas(body));
    } catch (error) {
      const status = error instanceof CanvasApiError ? error.status : 500;
      const message =
        error instanceof CanvasApiError ? error.message : 'Canvas sync failed unexpectedly.';
      sendJson(response, status, { success: false, error: message });
    }
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    await serveStatic(request, response);
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  server.listen(port, hostAddress, () => {
    console.log(`FocusFlow API listening on http://${hostAddress}:${port}`);
  });
}
