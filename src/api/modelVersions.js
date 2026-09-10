import { API_BASE, getJson, patchJson, postJson } from './apiUtils';

const MODEL_VERSIONS_URL = `${API_BASE}/api/v3/model-versions`;

export async function fetchModelVersionsPage({
    page = 1,
    pageSize = 20,
    projectId,
    runId,
    stage,
} = {}) {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('page_size', pageSize);
    if (projectId != null && String(projectId).trim()) params.set('project_id', projectId);
    if (runId != null && String(runId).trim()) params.set('run_id', runId);
    if (stage) params.set('stage', stage);
    return getJson(`${MODEL_VERSIONS_URL}?${params.toString()}`);
}

export function fetchModelVersion(modelVersionId) {
    return getJson(`${MODEL_VERSIONS_URL}/${encodeURIComponent(modelVersionId)}`);
}

export function createModelVersion({ runId, version, stage = 'development', description } = {}) {
    return postJson(MODEL_VERSIONS_URL, {
        run_id: runId,
        version,
        stage,
        description: description || null,
    });
}

export function updateModelVersion(modelVersionId, patch = {}) {
    const payload = {};
    ['version', 'stage', 'description'].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) payload[key] = patch[key];
    });
    return patchJson(`${MODEL_VERSIONS_URL}/${encodeURIComponent(modelVersionId)}`, payload);
}
