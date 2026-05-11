/**
 * Illegal Dataset API — V3
 * All endpoints target /api/v3/illegal-datasets
 */
import {
    API_BASE,
    safeJson, postJson, putJson, deleteJson, getJson,
    xhrUploadJson,
    toAbsUrl, encodePathSegments, formatMb, normalizeFileArray,
    pickErrorMessage,
} from './apiUtils';

const PREFIX = `${API_BASE}/api/v3/illegal-datasets`;

// ── Thumbnail helper ──────────────────────────────────────────────────────

export function buildIllegalThumbnailUrl(datasetId, relPath, { versionId = null, size = null } = {}) {
    if (!datasetId || !relPath) return '';
    const cleanRelPath = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanRelPath) return '';
    const params = new URLSearchParams();
    if (versionId != null && versionId !== '') params.set('version_id', String(versionId));
    if (size != null && size !== '') params.set('size', String(size));
    const qs = params.toString();
    const base = `/api/v3/thumbnails/illegal/${encodeURIComponent(datasetId)}/${encodePathSegments(cleanRelPath)}`;
    return toAbsUrl(qs ? `${base}?${qs}` : base);
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function fetchIllegalDatasets(page = 1, pageSize = 50) {
    try {
        const url = `${PREFIX}?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
        const data = await getJson(url);
        const list = (data && Array.isArray(data.items) && data.items) || [];
        return list.map(item => ({
            ...item,
            dataset_name: item.name || item.dataset_name,
            dataset_type: item.dataset_type || item.type || 'detection',
            dataset_id: item.illegal_dataset_id || item.id,
            num_images: item.statistics?.num_images || 0,
            num_classes: item.statistics?.num_classes || 0,
            dataset_size_mb: item.statistics?.size_mb ? `${item.statistics.size_mb.toFixed(2)}MB` : '0MB',
        }));
    } catch (error) {
        console.error('获取原始数据集失败:', error);
        return [];
    }
}

export async function createIllegalDataset({ name, dataset_type, description = null } = {}) {
    return postJson(PREFIX, {
        name,
        dataset_type,
        description: description || undefined,
    });
}

export async function fetchIllegalDataset(datasetId) {
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}`);
}

export async function fetchIllegalDatasetDetail(datasetId, { versionsLimit = 20, eventsLimit = 20 } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/detail?versions_limit=${versionsLimit}&events_limit=${eventsLimit}`;
    return getJson(url);
}

export async function updateIllegalDataset(datasetId, patch) {
    const res = await fetch(`${PREFIX}/${encodeURIComponent(datasetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

export async function deleteIllegalDataset(datasetId, { deleteFiles = false, force = false } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}?delete_files=${deleteFiles ? '1' : '0'}&force=${force ? '1' : '0'}`;
    return deleteJson(url);
}

// ── Upload ────────────────────────────────────────────────────────────────

export function uploadIllegalDatasetArchive(
    datasetId,
    file,
    { message = null, created_by = null, onProgress = null, onUploadDone = null } = {}
) {
    if (!datasetId) return { promise: Promise.reject(new Error('缺少 datasetId')), cancel: () => {} };
    const formData = new FormData();
    formData.append('file', file);
    if (message) formData.append('message', message);
    if (created_by) formData.append('created_by', created_by);

    return xhrUploadJson(
        `${PREFIX}/${encodeURIComponent(datasetId)}/upload`,
        formData,
        { onProgress, onUploadDone }
    );
}

export function appendIllegalDatasetArchive(
    datasetId,
    file,
    { message = null, created_by = null, onProgress = null, onUploadDone = null } = {}
) {
    if (!datasetId) return { promise: Promise.reject(new Error('缺少 datasetId')), cancel: () => {} };
    const formData = new FormData();
    formData.append('file', file);
    if (message) formData.append('message', message);
    if (created_by) formData.append('created_by', created_by);

    return xhrUploadJson(
        `${PREFIX}/${encodeURIComponent(datasetId)}/append`,
        formData,
        { onProgress, onUploadDone }
    );
}

export function uploadIllegalDatasetImages(datasetId, files, {
    relativeDir = 'images',
    labels = [],
    labelsRelativeDir = null,
    message = null,
    createdBy = null,
    onProgress = null,
    onUploadDone = null,
} = {}) {
    if (!datasetId) return { promise: Promise.reject(new Error('缺少 datasetId')), cancel: () => {} };
    const imageFiles = normalizeFileArray(files);
    const labelFiles = normalizeFileArray(labels);
    if (!imageFiles.length) return { promise: Promise.reject(new Error('请选择要上传的图片')), cancel: () => {} };

    const formData = new FormData();
    imageFiles.forEach(f => formData.append('files', f));
    formData.append('relative_dir', relativeDir);
    if (labelFiles.length > 0) {
        labelFiles.forEach(l => formData.append('labels', l));
        if (labelsRelativeDir) formData.append('labels_relative_dir', labelsRelativeDir);
    }
    if (message) formData.append('message', message);
    if (createdBy) formData.append('created_by', createdBy);

    return xhrUploadJson(
        `${PREFIX}/${encodeURIComponent(datasetId)}/uploads/images`,
        formData,
        { onProgress, onUploadDone }
    );
}

// ── Versions ──────────────────────────────────────────────────────────────

export async function fetchIllegalDatasetVersions(datasetId, { page = 1, pageSize = 50 } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/versions?page=${page}&page_size=${pageSize}`;
    return getJson(url);
}

export async function activateIllegalDatasetVersion(datasetId, versionId) {
    return postJson(
        `${PREFIX}/${encodeURIComponent(datasetId)}/versions/${encodeURIComponent(versionId)}/activate`,
        {}
    );
}

// ── Events ────────────────────────────────────────────────────────────────

export async function fetchIllegalDatasetEvents(datasetId, { page = 1, pageSize = 50 } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/events?page=${page}&page_size=${pageSize}`;
    return getJson(url);
}

// ── Labels / Mapping ──────────────────────────────────────────────────────

export async function fetchIllegalDatasetRawLabels(datasetId) {
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}/raw-labels`);
}

export async function fetchIllegalDatasetLabelMappings(datasetId) {
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}/label-mappings`);
}

export async function updateIllegalDatasetLabelMappings(datasetId, items) {
    return putJson(`${PREFIX}/${encodeURIComponent(datasetId)}/label-mappings`, { items });
}

// ── Publish (illegal → standard) ──────────────────────────────────────────

export async function publishIllegalDataset(
    datasetId,
    {
        name,
        description = null,
        version_id = null,
        label_filters = [],
        label_mapping_overrides = null,
        split = null,
        publish_config = null,
    } = {}
) {
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/publish`, {
        name,
        description: description || undefined,
        version_id: version_id != null && version_id !== '' ? Number(version_id) : undefined,
        label_filters: Array.isArray(label_filters) ? label_filters : [],
        label_mapping_overrides: label_mapping_overrides && typeof label_mapping_overrides === 'object' ? label_mapping_overrides : {},
        split: split && typeof split === 'object' ? split : {},
        publish_config: publish_config && typeof publish_config === 'object' ? publish_config : {},
    });
}

// ── View / Annotations / Statistics / Files ──────────────────────────────

export async function fetchIllegalDatasetView(datasetId, { versionId = null, classId = null, page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams();
    if (versionId != null && versionId !== '') params.set('version_id', String(versionId));
    if (classId != null && classId !== '') params.set('class_id', String(classId));
    params.set('page', String(page || 1));
    params.set('page_size', String(pageSize || 50));

    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/view?${params.toString()}`;
    const data = await getJson(url);
    return {
        dataset_id: data.dataset_id,
        version_id: data.version_id,
        categories: data.categories || [],
        items: (data.items || []).map(item => {
            const relPath = String(item.path || item.name || '').trim();
            return {
                ...item,
                image_name: item.name,
                image_path: relPath || item.name,
                image_url: toAbsUrl(item.url),
                thumbnail_url: relPath
                    ? buildIllegalThumbnailUrl(datasetId, relPath, { versionId, size: 320 })
                    : toAbsUrl(item.thumbnail_url),
                objects_count: Number(item.object_count ?? item.classes?.length ?? 0) || 0,
                classes_in_image: item.classes || [],
            };
        }),
        meta: {
            page: Number(data?.meta?.page || 1) || 1,
            page_size: Number(data?.meta?.page_size || pageSize || 50) || 50,
            total_items: Number(data?.meta?.total_items || 0) || 0,
            total_pages: Number(data?.meta?.total_pages || 0) || 0,
            thumbnail_status: data?.meta?.thumbnail_status || null,
            thumbnail_progress: data?.meta?.thumbnail_progress ?? null,
            view_index_status: data?.meta?.view_index_status || null,
        },
    };
}

export async function fetchIllegalDatasetAnnotations(datasetId, imagePath, { versionId = null } = {}) {
    if (!datasetId) throw new Error('缺少 datasetId');
    if (!imagePath) throw new Error('缺少 imagePath');
    const params = new URLSearchParams();
    params.set('image_path', String(imagePath));
    if (versionId != null && versionId !== '') params.set('version_id', String(versionId));

    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/image-annotations?${params.toString()}`;
    const data = await getJson(url);
    return {
        ...data,
        image_url: toAbsUrl(data?.image_url || ''),
        boxes: Array.isArray(data?.boxes) ? data.boxes : [],
        object_count: Number(data?.object_count || 0) || 0,
        width: Number(data?.width || 0) || 0,
        height: Number(data?.height || 0) || 0,
    };
}

export async function fetchIllegalDatasetStatistics(datasetId, { versionId = null } = {}) {
    const params = new URLSearchParams();
    if (versionId != null && versionId !== '') params.set('version_id', String(versionId));
    const qs = params.toString();
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/statistics${qs ? `?${qs}` : ''}`;
    const stats = await getJson(url);
    const totalImages = Number(stats?.total_images ?? 0) || 0;
    const totalSizeMb = Number(stats?.total_size_mb ?? 0) || 0;
    return {
        ...stats,
        num_images: totalImages,
        dataset_size_mb: formatMb(totalSizeMb),
        num_classes: Number(stats?.num_classes ?? 0) || 0,
    };
}

export async function fetchIllegalDatasetFiles(datasetId, { page = 1, pageSize = 100, versionId = null } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (versionId != null && versionId !== '') params.set('version_id', String(versionId));

    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/files?${params.toString()}`;
    return getJson(url);
}
