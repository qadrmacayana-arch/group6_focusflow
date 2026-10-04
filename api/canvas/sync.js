module.exports = async function syncCanvasHandler(request, response) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');

  const canvasApi = await import('../../server.mjs');

  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    response.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }

  try {
    let body = request.body;

    if (body === undefined) {
      body = await canvasApi.readJson(request);
    } else if (typeof body === 'string') {
      if (Buffer.byteLength(body, 'utf8') > 16 * 1024) {
        throw new canvasApi.CanvasApiError(413, 'Request body is too large.');
      }
      try {
        body = JSON.parse(body);
      } catch {
        throw new canvasApi.CanvasApiError(400, 'Request body must be valid JSON.');
      }
    } else if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 16 * 1024) {
      throw new canvasApi.CanvasApiError(413, 'Request body is too large.');
    }

    response.status(200).json(await canvasApi.syncCanvas(body));
  } catch (error) {
    const status = error instanceof canvasApi.CanvasApiError ? error.status : 500;
    const message = error instanceof canvasApi.CanvasApiError
      ? error.message
      : 'Canvas sync failed unexpectedly.';
    response.status(status).json({ success: false, error: message });
  }
};
