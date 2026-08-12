/**
 * Free a port before a dev server tries to bind it.
 *
 * `EADDRINUSE: address already in use :::3000` is almost never a real conflict
 * here — it is yesterday's dev server, or a second terminal, or the start
 * script having already brought the same thing up. The message names the port
 * but not the process, so the fix is a lookup, a kill and a retry every single
 * time, which is a poor use of the minutes before a demo.
 *
 * Wired as a `predev` step, so `npm run dev` simply works.
 *
 * Only ever the process *listening on that exact port*. Never a match on a
 * process name: those patterns catch other people's terminals, and have
 * previously matched the running command's own line and killed it.
 */
import { execSync } from "node:child_process";

const port = process.argv[2];
if (!port || !/^\d+$/.test(port)) {
  console.error("usage: node free-port.mjs <port>");
  process.exit(1);
}

const sh = (command) => {
  try {
    return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return ""; // no match is a normal outcome, not a failure
  }
};

/** The pid holding the port, by whichever tool this machine has. */
function listenerPid() {
  const ss = sh(`ss -tlnp 2>/dev/null | grep ":${port} "`);
  const fromSs = ss.match(/pid=(\d+)/);
  if (fromSs) return fromSs[1];

  const lsof = sh(`lsof -ti tcp:${port} -sTCP:LISTEN 2>/dev/null`).trim();
  return lsof.split("\n")[0] || null;
}

const pid = listenerPid();
if (!pid) process.exit(0); // already free — say nothing

// Ask first. A dev server given SIGTERM closes its sockets and flushes; killed
// outright it can leave the port in TIME_WAIT and the retry fails too.
try {
  process.kill(Number(pid), "SIGTERM");
} catch {
  process.exit(0); // it exited between the lookup and here
}

const deadline = Date.now() + 4000;
while (Date.now() < deadline) {
  if (!listenerPid()) break;
  execSync("sleep 0.25");
}

if (listenerPid()) {
  try {
    process.kill(Number(pid), "SIGKILL");
  } catch { /* gone */ }
}

console.log(`  freed port ${port} (was pid ${pid})`);
