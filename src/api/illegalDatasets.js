/**
 * Illegal Dataset API — V3
 * All endpoints target /api/v3/illegal-datasets
 */
import {
    API_BASE,
    safeJson, postJson, putJson, deleteJson, getJson,
    xhrUploadJson,
    chunkedUpload,
    toAbsUrl, formatMb, normalizeFileArray,
    pickErrorMessage,
} from './apiUtils';

const PREFIX = `${API_BASE}/api/v3/illegal-datasets`;

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
            num_images: item.statistics?.num_images ?? item.statistics?.total_images ?? item.statistics?.image_count ?? 0,
            num_classes: item.statistics?.num_classes || 0,
            dataset_size_mb: item.statistics?.size_mb ? `${item.statistics.size_mb.toFixed(2)}MB` : '0MB',
            preview_image_url: '',
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

/**
 * 【分片上传】违规数据集 ZIP — 推荐使用。
 *
 * 流程：创建上传会话 → 分片上传 → 完成合并 → 返回 task_id
 * 调用方通过 onTaskReady 获取 task_id 后，可调用 pollUploadTask 轮询服务端处理状态。
 *
 * @param {string|number} datasetId
 * @param {File} file
 * @param {Object} options - 透传给 chunkedUpload，额外支持 message / created_by / mode
 * @returns {{ promise: Promise, cancel: Function }}
 */
export function uploadIllegalDatasetChunked(datasetId, file, options = {}) {
    if (!datasetId) return { promise: Promise.reject(new Error('缺少 datasetId')), cancel: () => {} };
    const baseUrl = `${PREFIX}/${encodeURIComponent(datasetId)}`;
    const { message, created_by, mode, ...rest } = options;

    const extraCreateFields = { mode: mode || 'upload' };
    if (message) extraCreateFields.message = message;
    if (created_by) extraCreateFields.created_by = created_by;

    const extraCompleteFields = {};
    if (message) extraCompleteFields.message = message;

    return chunkedUpload(baseUrl, file, {
        ...rest,
        extraCreateFields,
        extraCompleteFields,
    });
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

export async function importIllegalDatasetFromPath(
    datasetId,
    { root_id = 'default', path, mode = 'upload', storage_strategy = 'link', created_by = null, message = null } = {}
) {
    if (!datasetId) throw new Error('缺少 datasetId');
    if (path == null) throw new Error('请选择导入目录');
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/import-from-path`, {
        root_id,
        path: path || '',
        mode: mode || 'upload',
        storage_strategy,
        created_by: created_by || undefined,
        message: message || undefined,
    });
}

export async function createIllegalDatasetPublishJob(
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
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/publish-jobs`, {
        name,
        description: description || undefined,
        version_id: version_id != null && version_id !== '' ? Number(version_id) : undefined,
        label_filters: Array.isArray(label_filters) ? label_filters : [],
        label_mapping_overrides: label_mapping_overrides && typeof label_mapping_overrides === 'object' ? label_mapping_overrides : {},
        split: split && typeof split === 'object' ? split : {},
        publish_config: publish_config && typeof publish_config === 'object' ? publish_config : {},
    });
}

export async function fetchIllegalDatasetPublishJob(datasetId, jobId) {
    if (!datasetId) throw new Error('缺少 datasetId');
    if (!jobId) throw new Error('缺少 jobId');
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}/publish-jobs/${encodeURIComponent(jobId)}`);
}

export async function fetchActiveIllegalDatasetPublishJob(datasetId) {
    if (!datasetId) throw new Error('缺少 datasetId');
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}/publish-jobs/active`);
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
            const backendImageUrl = item.image_url || item.url || '';
            return {
                ...item,
                image_name: item.name,
                image_path: relPath || item.name,
                image_url: toAbsUrl(backendImageUrl),
                thumbnail_url: '',
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
