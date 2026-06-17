import { API_BASE } from '@/utils/request';

async function safeJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

function pickPageItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function toError(data, res) {
  const msg = data && (data.detail || data.message);
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (msg && typeof msg === 'object') return JSON.stringify(msg);
  return `请求失败: ${res && res.status ? res.status : 'unknown'}`;
}

function mapProjectOut(p) {
  if (!p || typeof p !== 'object') return p;
  const standardDatasetId = Number(p.standard_dataset_id ?? p.dataset_id ?? p.dataset?.dataset_id ?? 0) || null;
  let dataset = p.dataset;
  if (!dataset && standardDatasetId) {
    dataset = {
      dataset_id: standardDatasetId,
      dataset_name: p.dataset_name || `标准数据集 #${standardDatasetId}`,
      dataset_type: p.task_type || null,
    };
  }
  return {
    ...p,
    project_id: p.project_id || p.id,
    project_name: p.project_name || p.name,
    name: p.name || p.project_name || '',
    dataset_id: standardDatasetId,
    standard_dataset_id: standardDatasetId,
    dataset,
    dataset_name: p.dataset_name || dataset?.dataset_name || '',
  };
}

export async function fetchProjects(page = 1, pageSize = 500) {
  const url = `${API_BASE}/api/v3/projects?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
  const response = await fetch(url);
  const data = await safeJson(response);
  if (!response.ok) throw new Error(toError(data, response));
  return pickPageItems(data).map(mapProjectOut);
}

export async function createProject(projectData = {}) {
  const payload = {
    name: projectData?.name || projectData?.project_name || projectData?.projectName,
    description: projectData?.description,
    standard_dataset_id: Number(projectData?.standard_dataset_id ?? projectData?.dataset_id ?? projectData?.dataset),
    task_type: projectData?.task_type || 'detection',
    created_by: projectData?.created_by || projectData?.user || '',
    tags: projectData?.tags,
  };
  const response = await fetch(`${API_BASE}/api/v3/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeJson(response);
  if (!response.ok) throw new Error(toError(data, response));
  return mapProjectOut(data);
}

export async function FetchProjectsDetail(projectId) {
  const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(projectId)}`);
  const data = await safeJson(response);
  if (!response.ok) throw new Error(toError(data, response));
  return mapProjectOut(data);
}

export async function deleteProject(projectId, { force = false } = {}) {
  const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(projectId)}?force=${force ? '1' : '0'}`, {
    method: 'DELETE',
  });
  const data = await safeJson(response);
  if (!response.ok) {
    const err = new Error(toError(data, response));
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data || { ok: true };
}

export async function FetchProjectModelsSize(projectId) {
  const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(projectId)}/model-size`);
  const data = await safeJson(response);
  if (!response.ok) throw new Error(toError(data, response));
  return data;
}

export async function FetchProjectsModelsSize(projectIds = []) {
  const ids = Array.isArray(projectIds) ? projectIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
  if (!ids.length) return [];
  const response = await fetch(`${API_BASE}/api/v3/projects/model-sizes?project_ids=${encodeURIComponent(ids.join(','))}`);
  const data = await safeJson(response);
  if (!response.ok) throw new Error(toError(data, response));
  return Array.isArray(data) ? data : [];
}

export async function fetchProjectTrainingAlerts(projectIds = []) {
  const ids = Array.isArray(projectIds) ? projectIds.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
  if (!ids.length) return [];
  const response = await fetch(`${API_BASE}/api/v3/projects/training-alerts?project_ids=${encodeURIComponent(ids.join(','))}`);
  const data = await safeJson(response);
  if (!response.ok) throw new Error(toError(data, response));
  return Array.isArray(data) ? data : [];
}

export async function fetchProjectCompareBaseline(projectId, frameworkKey) {
  const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(projectId)}/compare-baseline?framework_key=${encodeURIComponent(frameworkKey)}`);
  const data = await safeJson(response);
  if (!response.ok) {
    const err = new Error(toError(data, response));
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function setProjectCompareBaseline(projectId, payload = {}) {
  const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(projectId)}/compare-baseline`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      framework_key: String(payload.framework_key || '').trim(),
      baseline_run_id: String(payload.baseline_run_id || '').trim(),
    }),
  });
  const data = await safeJson(response);
  if (!response.ok) {
    const err = new Error(toError(data, response));
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function clearProjectCompareBaseline(projectId, frameworkKey) {
  const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(projectId)}/compare-baseline?framework_key=${encodeURIComponent(frameworkKey)}`, {
    method: 'DELETE',
  });
  const data = await safeJson(response);
  if (!response.ok) {
    const err = new Error(toError(data, response));
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}
