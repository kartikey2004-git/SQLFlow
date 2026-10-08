#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const args = parseArgs(process.argv.slice(2));
const BASE = (args.base || process.env.BASE_URL || "").replace(/\/$/, "");
if (!BASE) die("--base (or BASE_URL) is required, e.g. --base http://localhost:5000");
const ORIGIN = args.origin || process.env.ORIGIN || "http://localhost:3000";
const STAGES = String(args.stages || "10,50,100,250,500").split(",").map(Number).filter((n) => n > 0);
const STAGE_MS = Number(args["stage-seconds"] || 60) * 1000;
const JOB_MODE = args["job-mode"] || "poll";
const JOB_TIMEOUT_MS = Number(args["job-timeout-ms"] || 30000);
const PASSWORD = args.password || process.env.LT_PASSWORD || "Lt-" + Math.random().toString(36).slice(2) + "-Aa1!";
const PREFIX = args.prefix || "lt";
const RUN_ID = Date.now().toString(36);
const OUT = args.out || `loadtest-result-${RUN_ID}.json`;
const SELECT_SQL = args.select || "SELECT 1 AS one";
const SCRIPT_SQL = args.script || "CREATE TEMP TABLE lt(a int); INSERT INTO lt VALUES (1),(2),(3); SELECT sum(a) AS total FROM lt;";
const GRADE_SQL = args["grade-query"] || "SELECT 1";
const FIXED_ASSIGNMENT = args["assignment-id"] ? Number(args["assignment-id"]) : null;

if (!/^(https?:)/.test(BASE)) die("--base must be http(s) URL");

let stageStats;
const newStats = () => ({ labels: {}, requests: 0, rateLimited: 0, networkErrors: 0, httpErrors: 0, jobFailures: 0, jobTimeouts: 0, appErrors: 0 });
function record(label, ms, status, isErr) {
  const l = (stageStats.labels[label] ??= { lat: [], status: {}, errors: 0 });
  l.lat.push(ms);
  l.status[status] = (l.status[status] || 0) + 1;
  if (isErr) l.errors++;
  stageStats.requests++;
}
function recordJob(label, ms) {
  const l = (stageStats.labels[label] ??= { lat: [], status: {}, errors: 0 });
  l.lat.push(ms);
}
const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(1);
};
const summarize = (lat) => ({ count: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: lat.length ? +Math.max(...lat).toFixed(1) : null, mean: lat.length ? +(lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1) : null });

class Client {
  constructor() { this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; "); }
  absorb(res) {
    const set = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of set) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) {
        const name = pair.slice(0, i).trim(), val = pair.slice(i + 1).trim();
        if (/;\s*max-age=0/i.test(c) || val === "") this.jar.delete(name); else this.jar.set(name, val);
      }
    }
  }
  async call(label, method, path, body, { raw = false } = {}) {
    const t0 = performance.now();
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: { "content-type": "application/json", origin: ORIGIN, cookie: this.cookieHeader() },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      this.absorb(res);
      if (raw) return { res, t0 };
      const text = await res.text();
      const ms = performance.now() - t0;
      let json = null; try { json = JSON.parse(text); } catch { }
      const isErr = res.status >= 400;
      if (res.status === 429) stageStats.rateLimited++;
      else if (isErr) stageStats.httpErrors++;
      record(label, ms, res.status, isErr);
      return { status: res.status, json, ms, ok: !isErr };
    } catch (e) {
      const ms = performance.now() - t0;
      stageStats.networkErrors++;
      record(label, ms, "network_error", true);
      return { status: 0, json: null, ms, ok: false, networkError: String(e.message || e) };
    }
  }
}

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
async function waitForJob(client, label, jobId, t0) {
  const deadline = performance.now() + JOB_TIMEOUT_MS;
  let final = null;
  if (JOB_MODE === "sse") {
    try {
      const res = await fetch(`${BASE}/sandbox/jobs/${jobId}/stream`, {
        headers: { origin: ORIGIN, cookie: client.cookieHeader(), accept: "text/event-stream" },
        signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
      });
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const ev = /event: (.*)/.exec(block)?.[1], data = /data: (.*)/.exec(block)?.[1];
          if (ev === "status" && data) { const s = JSON.parse(data); if (TERMINAL.has(s.state)) { final = s; reader.cancel().catch(() => {}); break outer; } }
          if (ev === "error") break outer;
        }
      }
      record(label + ":stream", performance.now() - t0, res.status, res.status >= 400);
    } catch { }
  }
  while (!final && performance.now() < deadline) {
    const r = await client.call(label + ":poll", "GET", `/sandbox/jobs/${jobId}`);
    const d = r.json?.data;
    if (d && TERMINAL.has(d.state)) final = d; else await sleep(300);
  }
  const ms = performance.now() - t0;
  recordJob(label + ":job_e2e", ms);
  if (!final) { stageStats.jobTimeouts++; return null; }
  if (final.state !== "completed") stageStats.jobFailures++;
  else if (final.output?.error) stageStats.appErrors++;
  return final;
}

async function runJob(client, label, path, body) {
  const t0 = performance.now();
  const r = await client.call(label, "POST", path, body);
  const jobId = r.json?.data?.jobId;
  if (!r.ok || !jobId) return null;
  return waitForJob(client, label, jobId, t0);
}

const users = [];
async function ensureUser(i) {
  if (users[i]) return users[i];
  const u = (users[i] = { client: new Client(), email: `${PREFIX}.${RUN_ID}.${i}@loadtest.invalid`, ready: false });
  const su = await u.client.call("auth:sign-up", "POST", "/auth/sign-up/email", { name: `LT ${i}`, email: u.email, password: PASSWORD });
  const si = await u.client.call("auth:sign-in", "POST", "/auth/sign-in/email", { email: u.email, password: PASSWORD });
  u.ready = si.ok && (su.ok || su.status === 422 || su.status === 400);
  return u;
}

async function vuLoop(i, stopAt) {
  const u = await ensureUser(i);
  if (!u.ready) { await sleep(1000); return; }
  const { client } = u;
  while (Date.now() < stopAt) {
    const list = await client.call("assignments:list", "GET", "/assignments");
    const items = Array.isArray(list.json?.data) ? list.json.data : list.json?.data?.assignments;
    const assignmentId = FIXED_ASSIGNMENT ?? items?.[0]?.id;
    if (!assignmentId) { await sleep(500); continue; }
    await runJob(client, "sandbox:init", "/sandbox/init", { assignmentId });
    await runJob(client, "sandbox:execute_select", "/sandbox/execute", { assignmentId, query: SELECT_SQL });
    await runJob(client, "sandbox:execute_script", "/sandbox/execute", { assignmentId, query: SCRIPT_SQL });
    await runJob(client, "sandbox:grade", "/sandbox/grade", { assignmentId, query: GRADE_SQL });
    await sleep(200 + Math.random() * 300);
  }
}

const result = { tool: "sqlflow/loadtest/run.mjs", note: "Measured values only. Record environment details alongside.", base: BASE, jobMode: JOB_MODE, stageSeconds: STAGE_MS / 1000, startedAt: new Date().toISOString(), stages: [] };
for (const vus of STAGES) {
  stageStats = newStats();
  const t0 = Date.now(); const stopAt = t0 + STAGE_MS;
  console.error(`stage: ${vus} VUs for ${STAGE_MS / 1000}s ...`);
  const rampMs = Math.min(STAGE_MS * 0.1, 10000);
  const vuTasks = Array.from({ length: vus }, async (_, i) => {
    await sleep((i / vus) * rampMs);
    await vuLoop(i, stopAt);
  });
  await Promise.all(vuTasks);
  const secs = (Date.now() - t0) / 1000;
  const perLabel = {};
  for (const [name, l] of Object.entries(stageStats.labels)) perLabel[name] = { ...summarize(l.lat), errors: l.errors, status: l.status };
  const all = Object.entries(stageStats.labels).filter(([n]) => !n.endsWith(":job_e2e")).flatMap(([, l]) => l.lat);
  result.stages.push({
    vus, durationSeconds: +secs.toFixed(1), requests: stageStats.requests, rps: +(stageStats.requests / secs).toFixed(2),
    overall: summarize(all),
    errors: { http: stageStats.httpErrors, rateLimited429: stageStats.rateLimited, network: stageStats.networkErrors, jobFailed: stageStats.jobFailures, jobTimeout: stageStats.jobTimeouts, jobAppError: stageStats.appErrors },
    perLabel,
  });
  const s = result.stages.at(-1);
  console.error(`  rps=${s.rps} p50=${s.overall.p50}ms p95=${s.overall.p95}ms p99=${s.overall.p99}ms errors=${JSON.stringify(s.errors)}`);
}
result.finishedAt = new Date().toISOString();
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.error(`wrote ${OUT}`);
console.log(JSON.stringify(result.stages.map((s) => ({ vus: s.vus, rps: s.rps, p50: s.overall.p50, p95: s.overall.p95, p99: s.overall.p99, errors: s.errors })), null, 2));

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function die(m) { console.error(m); process.exit(1); }
function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"; o[k] = v; }
  }
  return o;
}
