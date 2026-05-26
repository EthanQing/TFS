import { API_BASE, deleteJson, getJson, postJson } from './apiUtils';

const PREFIX = `${API_BASE}/api/v3/dataset-imports`;

export async function fetchDatasetImportRoots() {
    return getJson(`${PREFIX}/roots`);
}

export async function createDatasetImportRoot({ path, label = null } = {}) {
    if (!path) throw new Error('请选择目录');
    return postJson(`${PREFIX}/roots`, {
        path,
        label: label || undefined,
    });
}

export async function deleteDatasetImportRoot(rootId) {
    if (!rootId) throw new Error('缺少目录 ID');
    return deleteJson(`${PREFIX}/roots/${encodeURIComponent(rootId)}`);
}

export async function fetchDatasetImportFsEntries({ path = '' } = {}) {
    const qs = new URLSearchParams();
    qs.set('path', path || '');
    return getJson(`${PREFIX}/fs/entries?${qs.toString()}`);
}

export async function fetchDatasetImportEntries({ rootId = 'default', path = '' } = {}) {
    const qs = new URLSearchParams();
    qs.set('root_id', rootId || 'default');
    qs.set('path', path || '');
    return getJson(`${PREFIX}/entries?${qs.toString()}`);
}

export async function inspectDatasetImportPath({ rootId = 'default', path = '' } = {}) {
    return postJson(`${PREFIX}/inspect`, {
        root_id: rootId || 'default',
        path: path || '',
    });
}
