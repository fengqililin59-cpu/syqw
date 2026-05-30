#!/usr/bin/env node
/**
 * @file 结束占用指定 TCP 端口的进程（macOS / Linux 使用 lsof）。
 * @example node scripts/kill-port.mjs 5173
 * @example node scripts/kill-port.mjs 5173 5174
 */
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).filter(Boolean);
const list = ports.length > 0 ? ports : ['5173'];

for (const port of list) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    const pids = [...new Set(out.split(/\s+/).filter(Boolean))];
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`);
        console.log(`Killed PID ${pid} on port ${port}`);
      } catch {
        /* ignore */
      }
    }
    if (pids.length === 0) console.log(`No listener on port ${port}`);
  } catch {
    console.log(`No listener on port ${port}`);
  }
}
