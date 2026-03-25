import { API_BASE } from "@/utils/request";

async function safeJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

function toErrorMessage(data, res) {
  const msg = data && (data.detail || data.message);
  if (typeof msg === "string" && msg.trim()) return msg;
  if (msg && typeof msg === "object") return JSON.stringify(msg);
  return `Request failed: ${res?.status || "unknown"}`;
}

async function getJson(url) {
  const res = await fetch(url);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function fetchSystemMetricsSummary({ nodeId = "backend", nodeType = "backend" } = {}) {
  const qs = new URLSearchParams();
  qs.set("node_id", String(nodeId || "backend"));
  qs.set("node_type", String(nodeType || "backend"));
  return getJson(`${API_BASE}/api/v2/system-metrics/summary?${qs.toString()}`);
}

export async function fetchSystemMetricsHistory({
  minutes = 10,
  node = "backend",
  nodeType = "backend",
  stepSeconds = 5,
} = {}) {
  const qs = new URLSearchParams();
  qs.set("minutes", String(Math.max(1, Number(minutes) || 10)));
  qs.set("node", String(node || "backend"));
  qs.set("node_type", String(nodeType || "backend"));
  qs.set("step_seconds", String(Math.max(1, Number(stepSeconds) || 5)));
  return getJson(`${API_BASE}/api/v2/system-metrics/history?${qs.toString()}`);
}
