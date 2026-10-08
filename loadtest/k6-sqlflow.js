import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE = (__ENV.BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const ORIGIN = __ENV.ORIGIN || "http://localhost:3000";
const STAGE_SECONDS = Number(__ENV.STAGE_SECONDS || 60);
const STAGES = (__ENV.STAGES || "10,50,100,250,500").split(",").map(Number);
const JOB_TIMEOUT_MS = Number(__ENV.JOB_TIMEOUT_S || 30) * 1000;
const PASSWORD = __ENV.LT_PASSWORD || "Lt-k6-Aa1!-" + Math.random().toString(36).slice(2);
const RUN_ID = Date.now().toString(36);
const SELECT_SQL = __ENV.SELECT_SQL || "SELECT 1 AS one";
const SCRIPT_SQL = __ENV.SCRIPT_SQL || "CREATE TEMP TABLE lt(a int); INSERT INTO lt VALUES (1),(2),(3); SELECT sum(a) AS total FROM lt;";
const GRADE_SQL = __ENV.GRADE_QUERY || "SELECT 1";

const jobE2E = new Trend("job_e2e_ms", true);
const jobFailed = new Counter("job_failed");
const jobTimeout = new Counter("job_timeout");
const jobAppError = new Counter("job_app_error");
const rateLimited = new Counter("rate_limited");

const scenarios = {};
STAGES.forEach((vus, i) => {
  scenarios[`stage_${vus}`] = {
    executor: "constant-vus",
    vus,
    duration: `${STAGE_SECONDS}s`,
    startTime: `${i * (STAGE_SECONDS + 15)}s`,
    gracefulStop: "30s",
    tags: { stage: String(vus) },
  };
});

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: false }],
    "http_req_duration{name:assignments_list}": ["p(95)<1500"],
    job_e2e_ms: ["p(95)<10000"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

let ready = false;
let email = null;
let assignmentId = __ENV.ASSIGNMENT_ID ? Number(__ENV.ASSIGNMENT_ID) : null;

function req(method, path, body, name) {
  const params = { headers: { "Content-Type": "application/json", Origin: ORIGIN }, tags: { name } };
  const res = http.request(method, BASE + path, body === undefined ? null : JSON.stringify(body), params);
  if (res.status === 429) rateLimited.add(1);
  return res;
}

function jobFlow(name, path, body) {
  const t0 = Date.now();
  const r = req("POST", path, body, name);
  if (!check(r, { [`${name} accepted`]: (x) => x.status === 202 })) return;
  const jobId = r.json("data.jobId");
  if (!jobId) return;
  while (Date.now() - t0 < JOB_TIMEOUT_MS) {
    const p = req("GET", `/sandbox/jobs/${jobId}`, undefined, `${name}_poll`);
    const state = p.json("data.state");
    if (state === "completed" || state === "failed" || state === "cancelled") {
      jobE2E.add(Date.now() - t0, { op: name });
      if (state !== "completed") jobFailed.add(1);
      else if (p.json("data.output.error")) jobAppError.add(1);
      return;
    }
    sleep(0.3);
  }
  jobTimeout.add(1);
}

export default function () {
  if (!ready) {
    email = `lt.${RUN_ID}.${__VU}@loadtest.invalid`;
    req("POST", "/auth/sign-up/email", { name: `LT ${__VU}`, email, password: PASSWORD }, "auth_sign_up");
    const si = req("POST", "/auth/sign-in/email", { email, password: PASSWORD }, "auth_sign_in");
    ready = si.status === 200;
    if (!ready) { sleep(1); return; }
  }
  const list = req("GET", "/assignments", undefined, "assignments_list");
  if (!assignmentId) {
    const d = list.json("data");
    const items = Array.isArray(d) ? d : (d && d.assignments) || [];
    if (items.length) assignmentId = items[0].id;
  }
  if (!assignmentId) { sleep(1); return; }

  jobFlow("sandbox_init", "/sandbox/init", { assignmentId });
  jobFlow("execute_select", "/sandbox/execute", { assignmentId, query: SELECT_SQL });
  jobFlow("execute_script", "/sandbox/execute", { assignmentId, query: SCRIPT_SQL });
  jobFlow("grade", "/sandbox/grade", { assignmentId, query: GRADE_SQL });
  sleep(0.2 + Math.random() * 0.3);
}
