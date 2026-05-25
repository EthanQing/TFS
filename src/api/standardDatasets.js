/**
 * Standard Dataset API — V3
 * All endpoints target /api/v3/standard-datasets
 */
import {
    API_BASE, WS_BASE,
    safeJson, postJson, deleteJson, getJson,
    xhrUploadJson, chunkedUpload,
    toAbsUrl, encodePathSegments, formatMb,
    pickErrorMessage, createReconnectingWs,
} from './apiUtils';

const PREFIX = `${API_BASE}/api/v3/standard-datasets`;

// ── Thumbnail helper ──────────────────────────────────────────────────────

export function buildStandardThumbnailUrl(datasetId, relPath, { size = null } = {}) {
    if (!datasetId || !relPath) return '';
    const cleanRelPath = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanRelPath) return '';
    const params = new URLSearchParams();
    if (size != null && size !== '') params.set('size', String(size));
    const qs = params.toString();
    const base = `/api/v3/thumbnails/standard/${encodeURIComponent(datasetId)}/${encodePathSegments(cleanRelPath)}`;
    return toAbsUrl(qs ? `${base}?${qs}` : base);
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function fetchStandardDatasets({ page = 1, pageSize = 50 } = {}) {
    try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', String(pageSize));

        const url = `${PREFIX}?${params.toString()}`;
        const data = await getJson(url);
        const list = (data && Array.isArray(data.items) && data.items) || [];
        return list.map(item => ({
            ...item,
            dataset_name: item.name,
            dataset_type: item.dataset_type || item.type || 'detection',
            dataset_id: item.standard_dataset_id,
            format: 'yolo',
            num_images: item.statistics?.num_images ?? item.statistics?.total_images ?? item.statistics?.image_count ?? 0,
            num_classes: item.statistics?.num_classes || 0,
            dataset_size_mb: item.statistics?.size_mb ? `${item.statistics.size_mb.toFixed(2)}MB` : '0MB',
            preview_image_url: toAbsUrl(item.preview_image_url || ''),
        }));
    } catch (error) {
        console.error('获取标准数据集失败:', error);
        return [];
    }
}

export async function createStandardDataset({ name, dataset_type, description = null } = {}) {
    return postJson(PREFIX, {
        name,
        dataset_type,
        description: description || undefined,
    });
}

export async function fetchStandardDataset(datasetId) {
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}`);
}

export async function fetchStandardDatasetDetail(datasetId, { eventsLimit = 20 } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/detail?events_limit=${eventsLimit}`;
    return getJson(url);
}

export async function updateStandardDataset(datasetId, patch) {
    const res = await fetch(`${PREFIX}/${encodeURIComponent(datasetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

export async function deleteStandardDataset(datasetId, { deleteFiles = false, force = false } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}?delete_files=${deleteFiles ? '1' : '0'}&force=${force ? '1' : '0'}`;
    return deleteJson(url);
}

// ── Upload ────────────────────────────────────────────────────────────────

/**
 * 【分片上传】标准数据集 ZIP — 推荐使用。
 *
 * 流程：创建上传会话 → 分片上传 → 完成合并 → 返回 task_id
 * 调用方通过 onTaskReady 获取 task_id 后，可调用 pollUploadTask 轮询服务端处理状态。
 *
 * @param {string|number} datasetId
 * @param {File} file
 * @param {Object} options - 透传给 chunkedUpload，额外支持 created_by
 * @returns {{ promise: Promise, cancel: Function }}
 */
export function uploadStandardDatasetChunked(datasetId, file, options = {}) {
    if (!datasetId) return { promise: Promise.reject(new Error('缺少 datasetId')), cancel: () => {} };
    const baseUrl = `${PREFIX}/${encodeURIComponent(datasetId)}`;
    const { created_by, ...rest } = options;

    const extraCreateFields = { mode: 'upload' };
    if (created_by) extraCreateFields.created_by = created_by;

    return chunkedUpload(baseUrl, file, {
        ...rest,
        extraCreateFields,
    });
}

/**
 * 【已废弃】单次整包上传，仅保留作为后端未实现分片接口时的兼容降级。
 * 新代码请使用 uploadStandardDatasetChunked。
 * TODO: 后端分片接口稳定后删除此函数及其调用路径。
 */
export function uploadStandardDatasetArchive(
    datasetId,
    file,
    { created_by = null, onProgress = null, onUploadDone = null } = {}
) {
    if (!datasetId) return { promise: Promise.reject(new Error('缺少 datasetId')), cancel: () => {} };
    const formData = new FormData();
    formData.append('file', file);
    if (created_by) formData.append('created_by', created_by);

    return xhrUploadJson(
        `${PREFIX}/${encodeURIComponent(datasetId)}/upload`,
        formData,
        { onProgress, onUploadDone }
    );
}

// ── Events ────────────────────────────────────────────────────────────────

export async function fetchStandardDatasetEvents(datasetId, { page = 1, pageSize = 50 } = {}) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/events?page=${page}&page_size=${pageSize}`;
    return getJson(url);
}

// ── Split ─────────────────────────────────────────────────────────────────

export async function fetchStandardDatasetSplitSummary(datasetId, { page = 1, pageSize = 1, split = null } = {}) {
    if (!datasetId) throw new Error('缺少 datasetId');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (split != null && split !== '') params.set('split', String(split));
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/split?${params.toString()}`;
    const data = await getJson(url);
    return data && data.summary ? data.summary : data;
}

export async function splitStandardDataset(
    datasetId,
    {
        train_ratio = 0.9,
        val_ratio = 0.07,
        test_ratio = 0.03,
        seed = 42,
        shuffle = true,
        overwrite = true,
    } = {}
) {
    if (!datasetId) throw new Error('缺少 datasetId');
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/split`, {
        train_ratio,
        val_ratio,
        test_ratio,
        seed,
        shuffle: !!shuffle,
        overwrite: !!overwrite,
    });
}

// ── View / Annotations / Statistics / Files ──────────────────────────────

export async function fetchStandardDatasetView(datasetId, { classId = null, page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams();
    if (classId != null && classId !== '') params.set('class_id', String(classId));
    params.set('page', String(page || 1));
    params.set('page_size', String(pageSize || 50));

    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/view?${params.toString()}`;
    const data = await getJson(url);
    return {
        dataset_id: data.dataset_id,
        categories: data.categories || [],
        items: (data.items || []).map(item => {
            const relPath = String(item.path || item.name || '').trim();
            return {
                ...item,
                image_name: item.name,
                image_path: relPath || item.name,
                // item.url 可能为空，fallback 到缩略图接口（不带 size 参数 = 原图）
                image_url: toAbsUrl(item.url) || (relPath
                    ? buildStandardThumbnailUrl(datasetId, relPath)
                    : ''),
                thumbnail_url: relPath
                    ? buildStandardThumbnailUrl(datasetId, relPath, { size: 320 })
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

export async function fetchStandardDatasetAnnotations(datasetId, imagePath) {
    if (!datasetId) throw new Error('缺少 datasetId');
    if (!imagePath) throw new Error('缺少 imagePath');
    const params = new URLSearchParams();
    params.set('image_path', String(imagePath));

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

export async function fetchStandardDatasetStatistics(datasetId) {
    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/statistics`;
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

export async function fetchStandardDatasetFiles(datasetId, { page = 1, pageSize = 100 } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));

    const url = `${PREFIX}/${encodeURIComponent(datasetId)}/files?${params.toString()}`;
    return getJson(url);
}

// ── Augmentation (Standard datasets) ──────────────────────────────────────

export async function previewStandardAugmentation(datasetId, payload) {
    const res = await fetch(`${PREFIX}/${encodeURIComponent(datasetId)}/augmentations/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

export async function createStandardAugmentationJob(datasetId, payload) {
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/augmentations`, payload);
}

export async function fetchStandardAugmentationJob(datasetId, jobId) {
    return getJson(`${PREFIX}/${encodeURIComponent(datasetId)}/augmentations/${encodeURIComponent(jobId)}`);
}

export async function cancelStandardAugmentationJob(datasetId, jobId) {
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/augmentations/${encodeURIComponent(jobId)}/cancel`, {});
}

export async function publishStandardAugmentationJob(datasetId, jobId, payload) {
    return postJson(`${PREFIX}/${encodeURIComponent(datasetId)}/augmentations/${encodeURIComponent(jobId)}/publish`, payload);
}

function buildStandardAugmentationWsUrl(datasetId, jobId, query = {}) {
    const dsId = encodeURIComponent(String(datasetId || '').trim());
    const jId = encodeURIComponent(String(jobId || '').trim());
    const qs = new URLSearchParams();
    Object.keys(query || {}).forEach((k) => {
        const v = query[k];
        if (v === null || v === undefined) return;
        const s = String(v).trim();
        if (!s) return;
        qs.set(k, s);
    });
    const base = String(WS_BASE || API_BASE || '').replace(/\/+$/, '');
    const tail = qs.toString();
    return `${base}/api/v3/standard-datasets/${dsId}/augmentations/${jId}/stream${tail ? `?${tail}` : ''}`;
}

export function openStandardAugmentationStream(datasetId, jobId, handlers = {}, options = {}) {
    const onSnapshot = typeof handlers.onSnapshot === 'function' ? handlers.onSnapshot : () => {};
    const onProgress = typeof handlers.onProgress === 'function' ? handlers.onProgress : () => {};
    const onItem = typeof handlers.onItem === 'function' ? handlers.onItem : () => {};
    const onDone = typeof handlers.onDone === 'function' ? handlers.onDone : () => {};
    const onError = typeof handlers.onError === 'function' ? handlers.onError : () => {};

    let fromSeq = options.fromSeq ?? null;
    let fromResultId = options.fromResultId ?? null;

    return createReconnectingWs(
        () => buildStandardAugmentationWsUrl(datasetId, jobId, { from_seq: fromSeq, from_result_id: fromResultId }),
        {
            onOpen: handlers.onOpen,
            onClose: handlers.onClose,
            onError,
            onReconnect: handlers.onReconnect,
            onMessage: (payload, helpers) => {
                const type = String(payload?.type || '');
                const data = payload?.data || {};
                if (type === 'snapshot') {
                    if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
                    if (Number.isFinite(Number(data.last_result_id))) fromResultId = Number(data.last_result_id);
                    onSnapshot(data);
                } else if (type === 'progress') {
                    if (Number.isFinite(Number(data.seq))) fromSeq = Number(data.seq);
                    if (Number.isFinite(Number(data.last_result_id))) fromResultId = Number(data.last_result_id);
                    onProgress(data);
                } else if (type === 'item') {
                    if (Number.isFinite(Number(data.result_id))) {
                        const rid = Number(data.result_id);
                        if (fromResultId === null || rid > fromResultId) fromResultId = rid;
                    }
                    onItem(data);
                } else if (type === 'done') {
                    onDone(data);
                    helpers.close();
                } else if (type === 'error') {
                    onError(data?.message || 'stream error');
                }
            },
        },
        options
    );
}
