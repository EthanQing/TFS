import { API_BASE } from '@/utils/request';

async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
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

function toAbsUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url}`;
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

async function fetchDatasetYamlNames(storagePathOrName) {
    const ds = normalizeDatasetToken(storagePathOrName);
    if (!ds) return null;

    // Simple in-memory cache to avoid re-fetching the same yaml many times.
    if (!fetchDatasetYamlNames._cache) fetchDatasetYamlNames._cache = new Map();
    const cache = fetchDatasetYamlNames._cache;
    if (cache.has(ds)) return cache.get(ds);

    const candidates = ['data.yaml', 'data.yml', 'dataset.yaml', 'dataset.yml'];
    for (const fname of candidates) {
        const url = `${API_BASE}/static/datasets/${encodeURIComponent(ds)}/${encodeURIComponent(fname)}`;
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const txt = await safeText(res);
            const names = parseYamlNames(txt);
            if (names && names.length) {
                cache.set(ds, names);
                return names;
            }
        } catch (_) {
            // ignore and try next
        }
    }
    cache.set(ds, null);
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
        if (!response.ok) throw new Error(pickErrorMessage(data, response));

        const list = (data && Array.isArray(data.items) && data.items) || [];
        return list.map(item => ({
            ...item,
            dataset_name: item.dataset_name || item.name,
            dataset_type: item.dataset_type || item.type,
            dataset_id: item.dataset_id || item.id
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
export async function uploadDatasetToExisting(datasetId, file, { message = null, created_by = null } = {}) {
    try {
        if (!datasetId) throw new Error('?? datasetId');
        const formData = new FormData();
        formData.append('file', file);
        if (message) formData.append('message', message);
        if (created_by) formData.append('created_by', created_by);

        const response = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/upload`, {
            method: 'POST',
            body: formData
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

// uploadDataset 上传ZIP并创建数据集
export async function uploadDataset(file, datasetName, datasetType, description = null) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', datasetName);
        formData.append('dataset_type', datasetType);
        if (description) formData.append('description', description);

        const response = await fetch(`${API_BASE}/api/v2/datasets/upload`, {
            method: 'POST',
            body: formData
        });

        const result = await safeJson(response);

        if (!response.ok) {
            throw new Error(pickErrorMessage(result, response));
        }

        // 兼容前端旧调用：Upload 组件期望 { dataset: {...} }
        return { dataset: result };
    } catch (error) {
        console.error('上传错误:', error);
        throw error;
    }
}

// deleteDataset 删除数据集接口
export async function deleteDataset(datasetId, { deleteFiles = false, force = false } = {}) {
    try {
        const url = `${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}?delete_files=${deleteFiles ? '1' : '0'}&force=${force ? '1' : '0'}`;
        const response = await fetch(url, { method: 'DELETE' });
        const result = await safeJson(response);

        if (!response.ok) {
            throw new Error(pickErrorMessage(result, response));
        }
        return true;
    } catch (error) {
        console.error('删除错误:', error);
        throw error;
    }
}

// uploadDatasetImages 向已有数据集添加图片
export async function uploadDatasetImages(datasetId, files, {
    relativeDir = 'images',
    labels = [],
    labelsRelativeDir = null,
    requireLabels = true,
    message = null,
    createdBy = null,
    createVersion = true,
    createSnapshot = false,
    activate = true,
} = {}) {
    try {
        if (!datasetId) throw new Error('缺少 datasetId');
        if (!files || !files.length) throw new Error('请选择要上传的图片');

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('relative_dir', relativeDir);
        formData.append('require_labels', String(requireLabels));
        formData.append('create_version', String(createVersion));
        formData.append('create_snapshot', String(createSnapshot));
        formData.append('activate', String(activate));

        // Only append labels if there are any - backend expects list format
        if (labels && labels.length > 0) {
            labels.forEach(l => formData.append('labels', l));
            if (labelsRelativeDir) formData.append('labels_relative_dir', labelsRelativeDir);
        }

        if (message) formData.append('message', message);
        if (createdBy) formData.append('created_by', createdBy);

        const response = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/uploads/images`, {
            method: 'POST',
            body: formData
        });
        const result = await safeJson(response);
        if (!response.ok) {
            throw new Error(pickErrorMessage(result, response));
        }
        return result;
    } catch (error) {
        console.error('上传图片失败:', error);
        throw error;
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
export async function FetchDatasetClassNames(storagePathOrName) {
    return await fetchDatasetYamlNames(storagePathOrName);
}

// FetchDatasetDetail 获取数据集详细信息接口（组合：/detail + /files，适配旧 UI 需要的 images/classes 字段）
export async function FetchDatasetDetail(datasetId, { filesLimit = 500 } = {}) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/datasets/${encodeURIComponent(datasetId)}/detail`);
        const detail = await safeJson(response);
        if (!response.ok) throw new Error(pickErrorMessage(detail, response));

        const ds = detail?.dataset || {};
        const stats = detail?.statistics || null;

        // 拉一批图片用于详情页展示（最多 500，后端限制 page_size<=500）
        const pageSize = Math.max(1, Math.min(Number(filesLimit) || 200, 500));
        let filesPage = null;
        try {
            filesPage = await FetchDatasetFiles(datasetId, { page: 1, pageSize, kind: 'image' });
        } catch (_) {
            filesPage = { items: [], meta: { page: 1, page_size: pageSize, total: 0 } };
        }

        const fileItems = (filesPage && Array.isArray(filesPage.items) && filesPage.items) || [];

        const images = fileItems.map(f => {
            const relPath = String(f?.path || '').replace(/\\/g, '/');
            const url = encodeURI(toAbsUrl(f?.url));
            return {
                // 详情页会用 image_name 做去重/展示；用相对路径更稳定（避免同名文件被错误去重）
                image_name: relPath || basename(f?.path),
                image_url: url,
                image_path: relPath,
                objects_count: 0,
                classes_in_image: [],
            };
        });

        const datasetToken = ds?.storage_path || ds?.name || '';
        const yamlNames = await fetchDatasetYamlNames(datasetToken);

        // 优先走 YOLO 数据集（data.yaml + labels/*.txt），返回真实类别列表，并支持按类别筛选图片。
        let classes = [];
        if (yamlNames && yamlNames.length) {
            classes = yamlNames.map((name, i) => ({ class_id: i, class_name: String(name), image_count: 0 }));

            // 拉一批 label 文件并建立映射：imageKey -> labelItem
            let labelsPage = null;
            try {
                labelsPage = await FetchDatasetFiles(datasetId, { page: 1, pageSize, kind: 'label' });
            } catch (_) {
                labelsPage = { items: [], meta: { page: 1, page_size: pageSize, total: 0 } };
            }
            const labelItems = (labelsPage && Array.isArray(labelsPage.items) && labelsPage.items) || [];
            const labelByKey = new Map();
            const labelByPath = new Map();
            for (const it of labelItems) {
                const rel = String(it?.path || '').replace(/\\/g, '/');
                if (!rel) continue;
                labelByPath.set(rel, it);
                const key = datasetRelKey(rel, 'labels');
                if (key) labelByKey.set(key, it);
            }

            const counts = new Array(classes.length).fill(0);
            const queue = [...images];
            const worker = async () => {
                for (; ;) {
                    const img = queue.shift();
                    if (!img) return;
                    const rel = String(img.image_path || '').replace(/\\/g, '/');
                    if (!rel) continue;

                    const key = datasetRelKey(rel, 'images');
                    let labelItem = key ? labelByKey.get(key) : null;

                    // Fallback: try to guess label path by replacing /images/ -> /labels/ and ext -> .txt
                    if (!labelItem) {
                        const guessed = rel
                            .replace(/(^|\/)images\//, '$1labels/')
                            .replace(/\.[^/.]+$/, '.txt');
                        labelItem = labelByPath.get(guessed) || null;
                    }

                    if (!labelItem || !labelItem.url) continue;
                    try {
                        const labelUrl = encodeURI(toAbsUrl(labelItem.url));
                        const res = await fetch(labelUrl);
                        if (!res.ok) continue;
                        const txt = await safeText(res);
                        if (!txt) continue;

                        const set = new Set();
                        let objCount = 0;
                        for (const line of txt.split(/\r?\n/)) {
                            const t = line.trim();
                            if (!t) continue;
                            const parts = t.split(/\s+/);
                            if (!parts.length) continue;
                            const cid = parseInt(parts[0], 10);
                            if (!Number.isFinite(cid)) continue;
                            objCount += 1;
                            if (cid >= 0 && cid < classes.length) set.add(cid);
                        }

                        const ids = Array.from(set.values()).sort((a, b) => a - b);
                        img.objects_count = objCount;
                        img.classes_in_image = ids;
                        for (const cid of ids) counts[cid] += 1;
                    } catch (_) {
                        // ignore
                    }
                }
            };

            const concurrency = Math.min(8, Math.max(1, queue.length));
            await Promise.all(Array.from({ length: concurrency }, worker));

            classes = classes.map((c, i) => ({ ...c, image_count: counts[i] || 0 }));
        } else {
            // 没有 data.yaml 时（例如分类数据集/自定义结构），退回到“父目录分组”的近似分类，至少保证可筛选。
            const dirToId = new Map();
            const ensureDir = (dirName) => {
                const k = String(dirName || 'root');
                if (dirToId.has(k)) return dirToId.get(k);
                const id = classes.length + 1;
                dirToId.set(k, id);
                classes.push({ class_id: id, class_name: k, image_count: 0 });
                return id;
            };

            for (const img of images) {
                const dir = parentDirName(img.image_path);
                const classId = ensureDir(dir);
                img.classes_in_image = [classId];
            }

            for (const img of images) {
                const cid = Array.isArray(img.classes_in_image) ? img.classes_in_image[0] : null;
                if (cid === null || cid === undefined) continue;
                const c = classes.find(x => x.class_id === cid);
                if (c) c.image_count += 1;
            }
        }

        const totalImages = Number(stats?.total_images ?? images.length) || images.length;
        const totalSizeMb = Number(stats?.total_size_mb ?? 0) || 0;

        return {
            ...detail,
            // 兼容旧字段
            dataset_name: ds?.name,
            dataset_type: ds?.dataset_type,
            num_classes: yamlNames && yamlNames.length ? yamlNames.length : 0,
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
