import { API_BASE } from '@/utils/request';

async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}

function xhrUploadJson(url, formData, { onProgress = null, onUploadDone = null } = {}) {
    const xhr = new XMLHttpRequest();

    const promise = new Promise((resolve, reject) => {
        xhr.open('POST', url, true);
        xhr.responseType = 'text';

        if (xhr.upload) {
            xhr.upload.onprogress = (evt) => {
                if (typeof onProgress !== 'function') return;
                const loaded = Number(evt && evt.loaded) || 0;
                const total = Number(evt && evt.total) || 0;
                const percent = evt && evt.lengthComputable && total > 0 ? Math.round((loaded / total) * 100) : null;
                onProgress({ loaded, total, percent });
            };
            xhr.upload.onload = () => {
                if (typeof onUploadDone === 'function') onUploadDone();
            };
        }

        xhr.onload = () => {
            const status = Number(xhr.status) || 0;
            let data = null;
            try {
                data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
            } catch (_) {
                data = null;
            }

            if (status >= 200 && status < 300) {
                resolve(data);
                return;
            }
            reject(new Error(pickErrorMessage(data, { status })));
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.send(formData);
    });

    return {
        promise,
        cancel: () => {
            try { xhr.abort(); } catch (_) { /* ignore */ }
        },
    };
}

function pickErrorMessage(data, res) {
    if (data) {
        const msg = data.detail || data.message;
        if (typeof msg === 'string' && msg.trim()) return msg;
        if (msg && typeof msg === 'object') return JSON.stringify(msg);
    }
    return `请求失败: ${res.status}`;
}

async function safeText(res) {
    try {
        return await res.text();
    } catch (_) {
        return null;
    }
}

function normalizeFileArray(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.filter(Boolean);
    if (typeof File !== 'undefined' && input instanceof File) return [input];
    if (typeof FileList !== 'undefined' && input instanceof FileList) return Array.from(input).filter(Boolean);
    if (typeof input.length === 'number') return Array.from(input).filter(Boolean);
    return [input];
}

function toAbsUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url}`;
}

function encodePathSegments(p) {
    const s = String(p || '').replace(/\\/g, '/');
    return s.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

function normalizeDatasetToken(storagePathOrName) {
    let token = String(storagePathOrName || '').trim().replace(/\\/g, '/');
    const marker = '/static/datasets/';
    const idx = token.indexOf(marker);
    if (idx !== -1) token = token.slice(idx + marker.length);
    token = token.replace(/^\/+/, '').replace(/\/+$/, '');
    return token;
}

function formatMb(mb) {
    const n = Number(mb);
    if (!Number.isFinite(n)) return '0MB';
    return `${n.toFixed(2)}MB`;
}

function basename(p) {
    const s = String(p || '').replace(/\\/g, '/');
    const parts = s.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : s;
}

function parentDirName(p) {
    const s = String(p || '').replace(/\\/g, '/');
    const parts = s.split('/').filter(Boolean);
    if (parts.length <= 1) return 'root';
    return parts[parts.length - 2] || 'root';
}

function unquote(s) {
    const v = String(s ?? '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
    }
    return v;
}

function parseYamlNames(yamlText) {
    const text = String(yamlText || '');
    if (!text.trim()) return null;

    // Drop full-line comments and empty lines; keep indentation for parsing.
    const rawLines = text.replace(/\r/g, '').split('\n');
    const lines = rawLines
        .map(l => (typeof l === 'string' ? l : ''))
        .filter(l => l.trim() !== '' && !l.trim().startsWith('#'));

    const idx = lines.findIndex(l => /^\s*names\s*:/.test(l));
    if (idx === -1) return null;

    const line = lines[idx];
    const afterColon = line.split(':').slice(1).join(':').trim();

    // Case 1) inline list: names: [a, b, c]
    if (afterColon.includes('[')) {
        let buf = afterColon;
        for (let i = idx + 1; i < lines.length && !buf.includes(']'); i += 1) {
            buf += ' ' + lines[i].trim();
        }
        const start = buf.indexOf('[');
        const end = buf.indexOf(']', start + 1);
        if (start !== -1 && end !== -1) {
            const inner = buf.slice(start + 1, end);
            const out = [];
            let cur = '';
            let quote = null;
            for (let i = 0; i < inner.length; i += 1) {
                const ch = inner[i];
                if (quote) {
                    if (ch === quote) quote = null;
                    cur += ch;
                    continue;
                }
                if (ch === '"' || ch === "'") {
                    quote = ch;
                    cur += ch;
                    continue;
                }
                if (ch === ',') {
                    const v = unquote(cur.trim());
                    if (v) out.push(v);
                    cur = '';
                    continue;
                }
                cur += ch;
            }
            const v = unquote(cur.trim());
            if (v) out.push(v);
            return out.length ? out : null;
        }
    }

    // Case 2) block list / mapping:
    // names:
    // - class_0
    // - class_1
    // or
    // names:
    //   0: person
    //   1: bicycle
    const out = [];
    const map = new Map();

    for (let i = idx + 1; i < lines.length; i += 1) {
        const t = lines[i].trim();
        if (!t) continue;
        // Stop when we reach the next top-level key.
        if (/^[A-Za-z_][\w-]*\s*:/.test(t) && !/^\d+\s*:/.test(t) && !t.startsWith('-')) {
            break;
        }

        if (t.startsWith('-')) {
            const v = unquote(t.replace(/^-+\s*/, '').split('#')[0].trim());
            if (v) out.push(v);
            continue;
        }

        const m = t.match(/^(\d+)\s*:\s*(.+)$/);
        if (m) {
            const k = parseInt(m[1], 10);
            const v = unquote(String(m[2]).split('#')[0].trim());
            if (Number.isFinite(k) && v) map.set(k, v);
        }
    }

    if (out.length) return out;
    if (map.size) {
        const max = Math.max(...Array.from(map.keys()));
        const arr = Array.from({ length: max + 1 }, () => '');
        map.forEach((v, k) => {
            arr[k] = v;
        });
        // Ensure no holes (fallback placeholder).
        return arr.map((v, i) => (v ? v : `class_${i}`));
    }

    return null;
}



function datasetRelKey(relPath, marker) {
    const p = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!p) return '';

    const seg = `/${marker}/`;
    let sub = '';
    const idx = p.indexOf(seg);
    if (idx !== -1) sub = p.slice(idx + seg.length);
    else if (p.startsWith(`${marker}/`)) sub = p.slice(`${marker}/`.length);
    else sub = p;

    return sub.replace(/\.[^/.]+$/, '');
}

// fetchDatasets 数据集列表
export async function fetchDatasets(page = 1, pageSize = 50) {
    try {
        const url = `${API_BASE}/api/v2/datasets?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
        const response = await fetch(url);
        const data = await safeJson(response);
        console.log('Datasets raw data:', data);
        if (!response.ok) throw new Error(pickErrorMessage(data, response));

        const list = (data && Array.isArray(data.items) && data.items) || [];
        return list.map(item => ({
            ...item,
            dataset_name: item.dataset_name || item.name,
            dataset_type: item.dataset_type || item.type,
            dataset_id: item.dataset_id || item.id,
            // Map embedded statistics from new API response
            num_images: item.statistics?.num_images || 0,
            num_classes: item.statistics?.num_classes || 0,
            dataset_size_mb: item.statistics?.size_mb ? `${item.statistics.size_mb.toFixed(2)}MB` : '0MB',
        }));
    } catch (error) {
        console.error('获取数据集失败:', error);
        return [];
    }
}


// createDataset ???????????????????
export async function createDataset({ name, dataset_type, description = null, storage_path = null } = {}) {
    try {
        const payload = {
            name: name,
            dataset_type: dataset_type,
            storage_path: storage_path || name,
            description: description || undefined,
        };

        const response = await fetch(`${API_BASE}/api/v2/datasets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await safeJson(response);
        if (!response.ok) {
            throw new Error(pickErrorMessage(result, response));
        }
        return result;
    } catch (error) {
        console.error('???????:', error);
        throw error;
    }
}

// uploadDatasetToExisting ??ZIP??????
export function uploadDatasetToExisting(
    datasetId,
    file,
    {
        message = null,
        created_by = null,
        split_enabled = false,
        split_train_ratio = null,
        split_val_ratio = null,
        split_test_ratio = null,
        split_seed = null,
        split_shuffle = null,
        split_overwrite = null,
        onProgress = null,
        onUploadDone = null,
    } = {}
) {
    try {
        if (!datasetId) throw new Error('?? datasetId');
        const formData = new FormData();
        formData.append('file', file);
        if (message) formData.append('message', message);
        if (created_by) formData.append('created_by', created_by);
        if (split_enabled) {
            formData.append('split_enabled', 'true');
            if (split_train_ratio !== null && split_train_ratio !== undefined) {
                formData.append('split_train_ratio', String(split_train_ratio));
            }
            if (split_val_ratio !== null && split_val_ratio !== undefined) {
                formData.append('split_val_ratio', String(split_val_ratio));
            }
            if (split_test_ratio !== null && split_test_ratio !== undefined) {
                formData.append('split_test_ratio', String(split_test_ratio));
            }
            if (split_seed !== null && split_seed !== undefined) {
                formData.append('split_seed', String(split_seed));
            }
            if (split_shuffle !== null && split_shuffle !== undefined) {
                formData.append('split_shuffle', split_shuffle ? 'true' : 'false');
            }
            if (split_overwrite !== null && split_overwrite !== undefined) {
                formData.append('split_overwrite', split_overwrite ? 'true' : 'false');
            }
        }

        return xhrUploadJson(
            `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/upload`,
            formData,
            { onProgress, onUploadDone }
        );
    } catch (error) {
        console.error('???????:', error);
        return { promise: Promise.reject(error), cancel: () => { } };
    }
}

// appendDatasetArchive 向已有数据集追加ZIP内容（支持非空数据集）
export function appendDatasetArchive(
    datasetId,
    file,
    { message = null, created_by = null, onProgress = null, onUploadDone = null } = {}
) {
    try {
        if (!datasetId) throw new Error('缺少 datasetId');
        const formData = new FormData();
        formData.append('file', file);
        if (message) formData.append('message', message);
        if (created_by) formData.append('created_by', created_by);

        return xhrUploadJson(
            `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/append`,
            formData,
            { onProgress, onUploadDone }
        );
    } catch (error) {
        console.error('追加上传失败:', error);
        return { promise: Promise.reject(error), cancel: () => { } };
    }
}

// uploadDataset 上传ZIP并创建数据集
export function uploadDataset(
    file,
    datasetName,
    datasetType,
    description = null,
    {
        split_enabled = false,
        split_train_ratio = null,
        split_val_ratio = null,
        split_test_ratio = null,
        split_seed = null,
        split_shuffle = null,
        split_overwrite = null,
        onProgress = null,
        onUploadDone = null,
    } = {}
) {
    try {
        let cancelled = false;
        let cancelImpl = () => { cancelled = true; };

        const promise = (async () => {
            // Backend flow: 1) create dataset -> 2) upload to /datasets/{id}/upload
            const ds = await createDataset({ name: datasetName, dataset_type: datasetType, description: description || undefined });
            const datasetId = ds && (ds.dataset_id || ds.id);
            if (!datasetId) throw new Error('创建数据集失败');
            if (cancelled) throw new Error('Upload cancelled');

            const req = uploadDatasetToExisting(datasetId, file, {
                message: description || null,
                created_by: null,
                split_enabled,
                split_train_ratio,
                split_val_ratio,
                split_test_ratio,
                split_seed,
                split_shuffle,
                split_overwrite,
                onProgress,
                onUploadDone,
            });
            cancelImpl = req.cancel;
            const uploaded = await req.promise;
            return { dataset: uploaded };
        })();

        return {
            promise,
            cancel: () => {
                cancelled = true;
                try { cancelImpl(); } catch (_) { /* ignore */ }
            },
        };
    } catch (error) {
        console.error('上传错误:', error);
        return { promise: Promise.reject(error), cancel: () => { } };
    }
}

// deleteDataset 删除数据集接口
export async function deleteDataset(datasetId, { deleteFiles = false, force = false } = {}) {
    try {
        const url = `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}?delete_files=${deleteFiles ? '1' : '0'}&force=${force ? '1' : '0'}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await safeJson(response);

        if (!response.ok) {
            const err = new Error(pickErrorMessage(result, response));
            err.status = response.status;
            err.data = result;
            throw err;
        }
        return true;
    } catch (error) {
        console.error('删除错误:', error);
        throw error;
    }
}

// uploadDatasetImages 向已有数据集添加图片
export function uploadDatasetImages(datasetId, files, {
    relativeDir = 'images',
    labels = [],
    labelsRelativeDir = null,
    requireLabels = true,
    message = null,
    createdBy = null,
    createVersion = true,
    createSnapshot = false,
    activate = true,
    onProgress = null,
    onUploadDone = null,
} = {}) {
    try {
        if (!datasetId) throw new Error('缺少 datasetId');
        const imageFiles = normalizeFileArray(files);
        const labelFiles = normalizeFileArray(labels);
        if (!imageFiles.length) throw new Error('请选择要上传的图片');

        const formData = new FormData();
        imageFiles.forEach(f => formData.append('files', f));
        formData.append('relative_dir', relativeDir);
        formData.append('require_labels', String(requireLabels));
        formData.append('create_version', String(createVersion));
        formData.append('create_snapshot', String(createSnapshot));
        formData.append('activate', String(activate));

        // Only append labels if there are any - backend expects list format
        if (labelFiles.length > 0) {
            labelFiles.forEach(l => formData.append('labels', l));
            if (labelsRelativeDir) formData.append('labels_relative_dir', labelsRelativeDir);
        }

        if (message) formData.append('message', message);
        if (createdBy) formData.append('created_by', createdBy);

        return xhrUploadJson(
            `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/uploads/images`,
            formData,
            { onProgress, onUploadDone }
        );
    } catch (error) {
        console.error('上传图片失败:', error);
        return { promise: Promise.reject(error), cancel: () => { } };
    }
}


// FetchDatasetStatistics 获取数据集统计信息接口（后端返回：total_images/total_size_mb...）
export async function FetchDatasetStatistics(datasetId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/statistics`);
        const stats = await safeJson(response);
        if (!response.ok) throw new Error(pickErrorMessage(stats, response));

        // 兼容字段（旧 UI：num_images / dataset_size_mb / num_classes）
        const totalImages = Number(stats?.total_images ?? 0) || 0;
        const totalSizeMb = Number(stats?.total_size_mb ?? 0) || 0;
        return {
            ...stats,
            num_images: totalImages,
            dataset_size_mb: formatMb(totalSizeMb),
            num_classes: 0,
        };
    } catch (error) {
        console.error('获取数据集统计信息失败:', error);
        throw error;
    }
}

// FetchDatasetFiles 获取数据集文件列表
export async function FetchDatasetFiles(
    datasetId,
    {
        page = 1,
        pageSize = 50,
        versionId = null,
        kind = 'image',
        prefix = null,
        q = null,
        includeMissing = false,
    } = {}
) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    params.set('kind', kind);
    if (versionId !== null && versionId !== undefined && versionId !== '') params.set('version_id', String(versionId));
    if (prefix) params.set('prefix', String(prefix));
    if (q) params.set('q', String(q));
    if (includeMissing) params.set('include_missing', '1');

    const url = `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/files?${params.toString()}`;
    const response = await fetch(url);
    const data = await safeJson(response);
    if (!response.ok) throw new Error(pickErrorMessage(data, response));
    return data || { items: [], meta: { page, page_size: pageSize, total: 0 } };
}

// FetchDatasetPreviewImage 获取数据集预览图（取第一张图片）
export async function FetchDatasetPreviewImage(datasetId) {
    try {
        const data = await FetchDatasetFiles(datasetId, { page: 1, pageSize: 1, kind: 'image' });
        const first = (data && Array.isArray(data.items) && data.items[0]) || null;
        if (!first || !first.url) return '';
        return encodeURI(toAbsUrl(first.url));
    } catch (e) {
        return '';
    }
}

// FetchDatasetClassNames 从静态 data.yaml 读取类别列表（YOLO 数据集）
// export async function FetchDatasetClassNames(storagePathOrName) {
//     return await fetchDatasetYamlNames(storagePathOrName);
// }

// FetchDatasetDetail 获取数据集详细信息接口（组合：/detail + /files，适配旧 UI 需要的 images/classes 字段）
export async function FetchDatasetDetail(datasetId, { filesLimit = 500, versionId = null } = {}) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/detail`);
        // console.log('Fetching dataset detail from:', `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/detail`);
        const detail = await safeJson(response);
        // print the names data type
        // console.log('names data type:', typeof detail?.active_version?.meta?.yolo?.names);
        if (!response.ok) throw new Error(pickErrorMessage(detail, response));

        const ds = detail?.dataset || {};
        const stats = detail?.statistics || null;

        // 拉一批图片用于详情页展示（最多 500，后端限制 page_size<=500）
        const pageSize = Math.max(1, Math.min(Number(filesLimit) || 200, 500));
        let filesPage = null;
        try {
            filesPage = await FetchDatasetFiles(datasetId, { page: 1, pageSize, kind: 'image', versionId });
        } catch (_) {
            filesPage = { items: [], meta: { page: 1, page_size: pageSize, total: 0 } };
        }

        const fileItems = (filesPage && Array.isArray(filesPage.items) && filesPage.items) || [];

        const images = fileItems.map(f => {
            const relPath = String(f?.path || '').replace(/\\/g, '/');
            const url = encodeURI(toAbsUrl(f?.url));
            const thumbPath = `/api/v2/thumbnails/${encodeURIComponent(datasetId)}/${encodePathSegments(relPath)}`;
            const thumbnailUrl = toAbsUrl(versionId ? `${thumbPath}?version_id=${encodeURIComponent(versionId)}` : thumbPath);
            return {
                // 详情页会用 image_name 做去重/展示；用相对路径更稳定（避免同名文件被错误去重）
                image_name: relPath || basename(f?.path),
                image_url: url,
                thumbnail_url: thumbnailUrl,
                image_path: relPath,
                objects_count: 0,
                classes_in_image: [],
            };
        });

        // const datasetToken = ds?.storage_path || ds?.name || '';
        // const yamlNames = await fetchDatasetYamlNames(datasetToken, false);
        // console.log('datasetToken:', datasetToken);
        // const yamlNames = null; // TODO: implement fetchDatasetYamlNames
        // 优先走 YOLO 数据集（data.yaml + labels/*.txt），返回真实类别列表，并支持按类别筛选图片。
        // let classes = [];
        let classes = detail?.active_version?.meta?.yolo?.names || [];
        // the classes type is object but we need array
        if (classes && typeof classes === 'object' && !Array.isArray(classes)) {
            classes = Object.values(classes);
        }

        const totalImages = Number(stats?.total_images ?? images.length) || images.length;
        const totalSizeMb = Number(stats?.total_size_mb ?? 0) || 0;

        return {
            ...detail,
            // 兼容旧字段
            dataset_name: ds?.name,
            dataset_type: ds?.dataset_type,
            num_classes: detail?.active_version?.meta?.yolo?.nc,
            total_images: totalImages,
            dataset_size_mb: formatMb(totalSizeMb),
            classes,
            images,
        };
    } catch (error) {
        console.error('获取数据集详细信息失败:', error);
        throw error;
    }
}

// FetchDatasetView 获取数据集视图接口（类别统计 + 分页图片列表 + 按类别筛选）
export async function FetchDatasetView(datasetId, { versionId = null, classId = null, page = 1, pageSize = 50 } = {}) {
    const params = new URLSearchParams();
    if (versionId !== null && versionId !== undefined && versionId !== '') {
        params.set('version_id', String(versionId));
    }
    if (classId !== null && classId !== undefined && classId !== '') {
        params.set('class_id', String(classId));
    }
    params.set('page', String(page || 1));
    params.set('page_size', String(pageSize || 50));

    const url = `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/view?${params.toString()}`;
    const response = await fetch(url);
    const data = await safeJson(response);
    if (!response.ok) throw new Error(pickErrorMessage(data, response));

    return {
        dataset_id: data.dataset_id,
        version_id: data.version_id,
        categories: data.categories || [],
        items: (data.items || []).map(item => ({
            ...item,
            image_name: item.name,
            image_url: toAbsUrl(item.url),
            thumbnail_url: toAbsUrl(item.thumbnail_url),
            objects_count: item.classes?.length || 0,
            classes_in_image: item.classes || [],
        })),
        meta: data.meta || { page: 1, page_size: 50, total_items: 0, total_pages: 0 },
    };
}

// FetchDatasetType 获取数据集类型接口（旧接口，后端 v2 暂无该路由；保留以避免直接报错）
export async function FetchDatasetType(jobId) {
    try {
        const id = String(jobId || '').trim();
        if (!id) return { dataset_type: 'detection' };

        // v2：通过 training-run -> project -> task_type 推断数据集类型，避免请求不存在的 /statistics/dataset-type
        const runRes = await fetch(`${API_BASE}/api/v2/training-runs/${encodeURIComponent(id)}`);
        const runData = await safeJson(runRes);
        if (!runRes.ok) throw new Error(pickErrorMessage(runData, runRes));

        const projectId = runData && (runData.project_id || runData.projectId);
        if (!projectId) return { dataset_type: 'detection' };

        const projRes = await fetch(`${API_BASE}/api/v2/projects/${encodeURIComponent(projectId)}`);
        const projData = await safeJson(projRes);
        if (!projRes.ok) throw new Error(pickErrorMessage(projData, projRes));

        const taskType = projData && (projData.task_type || projData.taskType);
        return { dataset_type: taskType || 'detection' };
    } catch (error) {
        console.error('获取数据集类型失败:', error);
        // 默认 detection，避免影响推理/预览页面
        return { dataset_type: 'detection' };
    }
}

// fetchDatasetVersions 获取数据集版本列表
export async function fetchDatasetVersions(datasetId, { page = 1, pageSize = 50 } = {}) {
    try {
        const url = `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/versions?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
        const response = await fetch(url);
        const data = await safeJson(response);
        if (!response.ok) throw new Error(pickErrorMessage(data, response));
        return data || { items: [], meta: { page, page_size: pageSize, total: 0 } };
    } catch (error) {
        console.error('获取数据集版本失败:', error);
        throw error;
    }
}

// fetchDatasetSplitSummary 获取数据集划分统计
export async function fetchDatasetSplitSummary(datasetId, { versionId = null } = {}) {
    if (!datasetId) throw new Error('缺少 datasetId');
    const qs = new URLSearchParams();
    qs.set('page', '1');
    qs.set('page_size', '1');
    if (versionId !== null && versionId !== undefined && versionId !== '') {
        qs.set('version_id', String(versionId));
    }

    const url = `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/split?${qs.toString()}`;
    const response = await fetch(url);
    const data = await safeJson(response);
    if (!response.ok) throw new Error(pickErrorMessage(data, response));
    return data && data.summary ? data.summary : data;
}

// splitDataset 手动划分数据集
export async function splitDataset(
    datasetId,
    {
        version_id = null,
        train_ratio = 0.9,
        val_ratio = null,
        test_ratio = null,
        seed = null,
        shuffle = true,
        overwrite = true,
    } = {}
) {
    if (!datasetId) throw new Error('缺少 datasetId');
    const payload = {
        train_ratio,
        shuffle: !!shuffle,
        overwrite: !!overwrite,
    };
    if (version_id !== null && version_id !== undefined && version_id !== '') {
        payload.version_id = Number(version_id);
    }
    if (val_ratio !== null && val_ratio !== undefined) payload.val_ratio = val_ratio;
    if (test_ratio !== null && test_ratio !== undefined) payload.test_ratio = test_ratio;
    if (seed !== null && seed !== undefined) payload.seed = Number(seed);

    const res = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

export async function fetchIllegalDatasetLabels(datasetId) {
    if (!datasetId) throw new Error('缺少 datasetId');
    const res = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/illegal-labels`, {
        method: 'GET',
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

export async function updateIllegalDatasetLabels(datasetId, labelMapping) {
    if (!datasetId) throw new Error('缺少 datasetId');
    const res = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/illegal-labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_mapping: labelMapping }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}


// convertIllegalDataset ?????????
export async function convertIllegalDataset(
    datasetId,
    {
        labelStrategy = 'leaf',
        labelLevel = null,
        labelSeparator = '%',
        labelMapping = null,
        split_enabled = false,
        split_train_ratio = null,
        split_val_ratio = null,
        split_test_ratio = null,
        split_seed = null,
        split_shuffle = null,
        split_overwrite = null,
    } = {}
) {
    if (!datasetId) throw new Error('?? datasetId');
    const payload = {
        label_strategy: labelStrategy,
        label_separator: labelSeparator,
    };
    if (labelStrategy === 'level') {
        payload.label_level = Number(labelLevel) || 1;
    }
    if (labelMapping && typeof labelMapping === 'object') {
        payload.label_mapping = labelMapping;
    }
    if (split_enabled) {
        payload.split_enabled = true;
        if (split_train_ratio !== null && split_train_ratio !== undefined) payload.split_train_ratio = split_train_ratio;
        if (split_val_ratio !== null && split_val_ratio !== undefined) payload.split_val_ratio = split_val_ratio;
        if (split_test_ratio !== null && split_test_ratio !== undefined) payload.split_test_ratio = split_test_ratio;
        if (split_seed !== null && split_seed !== undefined) payload.split_seed = split_seed;
        if (split_shuffle !== null && split_shuffle !== undefined) payload.split_shuffle = !!split_shuffle;
        if (split_overwrite !== null && split_overwrite !== undefined) payload.split_overwrite = !!split_overwrite;
    }

    const res = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

/**
 * Rename class labels in a converted YOLO dataset.
 * @param {number|string} datasetId
 * @param {Object<string,string>} renameMap - { oldName: newName }
 * @returns {Promise<{renamed: number, total_classes: number, class_names: string[]}>}
 */
export async function renameDatasetClasses(datasetId, renameMap) {
    if (!datasetId) throw new Error('缺少 datasetId');
    if (!renameMap || typeof renameMap !== 'object' || !Object.keys(renameMap).length) {
        throw new Error('renameMap 不能为空');
    }
    const res = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/classes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rename_map: renameMap }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}
