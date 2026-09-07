import {
    API_BASE,
    getJson,
    postJson,
    safeJson,
    pickErrorMessage,
} from './apiUtils';

const PREFIX = `${API_BASE}/api/v3/custom-models`;

export async function fetchCustomModelPackages({
    include_retired,
    name,
    skip,
    limit,
} = {}) {
    const params = new URLSearchParams();
    if (include_retired !== undefined && include_retired !== null) {
        params.set('include_retired', String(include_retired));
    }
    if (name !== undefined && name !== null && String(name).trim()) {
        params.set('name', String(name));
    }
    if (skip !== undefined && skip !== null) {
        params.set('skip', String(skip));
    }
    if (limit !== undefined && limit !== null) {
        params.set('limit', String(limit));
    }

    const query = params.toString();
    const data = await getJson(`${PREFIX}${query ? `?${query}` : ''}`);
    return data || { items: [], total: 0 };
}

export async function fetchCustomModelPackage(packageId) {
    const id = String(packageId ?? '').trim();
    if (!id) throw new Error('缺少 package_id');
    return getJson(`${PREFIX}/${encodeURIComponent(id)}`);
}

export async function uploadCustomModelPackage(file) {
    if (!file) throw new Error('缺少上传文件');

    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${PREFIX}/upload`, {
        method: 'POST',
        body: formData,
    });
    const data = await safeJson(response);
    if (!response.ok) {
        throw new Error(pickErrorMessage(data, response));
    }
    return data;
}

export async function retireCustomModelPackage(packageId) {
    const id = String(packageId ?? '').trim();
    if (!id) throw new Error('缺少 package_id');
    return postJson(`${PREFIX}/${encodeURIComponent(id)}/retire`, {});
}
