import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const children = [
  spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'serve', '--proxy-config', 'proxy.conf.json'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  }),
];
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) {
    return;
  }
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill();
    }
  }
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start FocusFlow development process:', error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
