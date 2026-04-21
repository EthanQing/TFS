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

function normId(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildPageQuery({ projectId, modelVersionId, isActive, status, page = 1, pageSize = 50 } = {}) {
  const qs = new URLSearchParams();
  qs.set("page", String(Math.max(1, Number(page) || 1)));
  qs.set("page_size", String(Math.min(500, Math.max(1, Number(pageSize) || 50))));
  const pid = normId(projectId);
  if (pid != null) qs.set("project_id", String(pid));
  const mvid = normId(modelVersionId);
  if (mvid != null) qs.set("model_version_id", String(mvid));
  if (typeof isActive === "boolean") qs.set("is_active", isActive ? "1" : "0");
  const st = String(status || "").trim();
  if (st) qs.set("status", st);
  return qs.toString();
}

function mapPage(data) {
  const items = data && Array.isArray(data.items) ? data.items : [];
  const meta = data && data.meta ? data.meta : { page: 1, page_size: items.length, total: items.length };
  return { items, meta };
}

export async function fetchDeploymentsPage(params = {}) {
  const query = buildPageQuery(params);
  const res = await fetch(`${API_BASE}/api/v3/deployments?${query}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return mapPage(data);
}

export async function createDeployment(payload = {}) {
  const res = await fetch(`${API_BASE}/api/v3/deployments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function fetchDeployment(deploymentId) {
  const did = normId(deploymentId);
  if (did == null) throw new Error("Missing deployment id");
  const res = await fetch(`${API_BASE}/api/v3/deployments/${encodeURIComponent(String(did))}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function fetchActiveDeployment(projectId) {
  const page = await fetchDeploymentsPage({
    projectId,
    isActive: true,
    page: 1,
    pageSize: 200,
  });
  const items = Array.isArray(page.items) ? page.items : [];
  if (!items.length) return null;
  const active = items.find((it) => String(it.status || "").toLowerCase() === "active");
  return active || items[0];
}

export async function fetchDeploymentRollbackCandidates(deploymentId) {
  const did = normId(deploymentId);
  if (did == null) throw new Error("Missing deployment id");
  const res = await fetch(`${API_BASE}/api/v3/deployments/${encodeURIComponent(String(did))}/rollback/candidates`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data || {};
}

export async function rollbackDeployment(deploymentId, payload = {}) {
  const did = normId(deploymentId);
  if (did == null) throw new Error("Missing deployment id");
  const res = await fetch(`${API_BASE}/api/v3/deployments/${encodeURIComponent(String(did))}/rollback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return data;
}

export async function fetchDeploymentRollbackHistory(deploymentId, { limit = 200 } = {}) {
  const did = normId(deploymentId);
  if (did == null) throw new Error("Missing deployment id");
  const safeLimit = Math.min(5000, Math.max(1, Number(limit) || 200));
  const res = await fetch(
    `${API_BASE}/api/v3/deployments/${encodeURIComponent(String(did))}/rollback/history?limit=${safeLimit}`
  );
  const data = await safeJson(res);
  if (!res.ok) throw new Error(toErrorMessage(data, res));
  return Array.isArray(data) ? data : [];
}
