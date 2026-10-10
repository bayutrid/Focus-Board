import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8']
]);

function requestedPort(args, environment) {
  const index = args.indexOf('--port');
  const value = index >= 0 ? args[index + 1] : environment.PORT;
  const port = value === undefined ? 4173 : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function resolveRequestPath(rawUrl) {
  let requestPath;
  try {
    requestPath = decodeURIComponent(rawUrl.split('?')[0]);
  } catch {
    return null;
  }
  if (requestPath.includes('\0')) return null;
  if (requestPath === '/') requestPath = '/index.html';

  const resolved = path.resolve(projectRoot, `.${requestPath}`);
  if (resolved !== projectRoot && !resolved.startsWith(`${projectRoot}${path.sep}`)) {
    return null;
  }
  return resolved;
}

const server = http.createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const filePath = resolveRequestPath(request.url ?? '/');
  if (!filePath) {
    response.writeHead(404).end('Not found');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    const contentType = mimeTypes.get(path.extname(filePath).toLowerCase());
    if (!contentType) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

const port = requestedPort(process.argv.slice(2), process.env);
server.listen(port, '127.0.0.1', () => {
  console.log(`FocusBoard available at http://127.0.0.1:${port}`);
});
