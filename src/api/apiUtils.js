/**
 * Shared API utilities — extracted from the original datasets.js
 * so that illegalDatasets.js, standardDatasets.js, and others can import them.
 */
import { API_BASE, WS_BASE } from '@/utils/request';

export { API_BASE, WS_BASE };

// ── JSON helpers ──────────────────────────────────────────────────────────

export async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}

export async function safeText(res) {
    try {
        return await res.text();
    } catch (_) {
        return null;
    }
}

export function pickErrorMessage(data, res) {
    if (data) {
        const msg = data.detail || data.message;
        if (typeof msg === 'string' && msg.trim()) return msg;
        if (msg && typeof msg === 'object') return JSON.stringify(msg);
    }
    return `请求失败: ${res.status}`;
}

// ── Fetch wrappers ────────────────────────────────────────────────────────

export async function getJson(url) {
    const res = await fetch(url);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data;
}

export async function postJson(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data || {};
}

export async function patchJson(url, payload) {
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data || {};
}

export async function putJson(url, payload) {
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data || {};
}

export async function putForm(url, formData) {
    const res = await fetch(url, { method: 'PUT', body: formData });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(pickErrorMessage(data, res));
    return data || {};
}

export async function deleteJson(url) {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await safeJson(res);
    if (!res.ok) {
        const err = new Error(pickErrorMessage(data, res));
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}

// ── XHR upload (with progress / cancel) ───────────────────────────────────

export function xhrUploadJson(url, formData, { onProgress = null, onUploadDone = null } = {}) {
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

// ── Chunked upload helper ─────────────────────────────────────────────────

/**
 * 分片上传（支持断点续传、并行上传、取消）
 *
 * @param {string} baseUrl - 数据集 API 前缀，如 /api/v3/standard-datasets/123
 * @param {File} file - 要上传的文件
 * @param {Object} options
 * @param {number} [options.chunkSize] - 分片大小（字节），不传则使用后端默认值
 * @param {number} [options.maxRetries=5] - 每个分片最大重试次数
 * @param {number} [options.maxParallel=1] - 最大并行上传分片数
 * @param {Function} [options.onProgress] - ({ loaded, total, percent }) => void
 * @param {Function} [options.onUploadDone] - 所有分片上传完成回调
 * @param {Function} [options.onStageChange] - (stage, info) => void，上传会话阶段变化
 * @param {Function} [options.onTaskReady] - (taskId) => void，complete 返回 task_id 后回调
 * @param {Function} [options.onSessionCreated] - ({ sessionId, ...info }) => void，会话创建/恢复后回调
 * @param {Object} [options.extraCreateFields] - 创建会话时的额外字段 { message, created_by, mode }
 * @param {Object} [options.extraCompleteFields] - 完成上传时的额外字段 { message }
 * @param {AbortSignal} [options.signal] - 外部取消信号
 * @param {string} [options.resumeSessionId] - 断点续传：已有会话 ID，跳过已上传分片
 * @returns {{ promise: Promise, cancel: Function }}
 */
export function chunkedUpload(
    baseUrl,
    file,
    {
        chunkSize = null,
        maxRetries = 5,
        maxParallel = 1,
        onProgress = null,
        onUploadDone = null,
        onStageChange = null,
        onTaskReady = null,
        onSessionCreated = null,
        extraCreateFields = null,
        extraCompleteFields = null,
        signal = null,
        resumeSessionId = null,
    } = {}
) {
    let cancelled = false;
    let sessionId = null;
    const parallelLimit = Math.max(1, Number(maxParallel) || 1);
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const notifyStage = (stage, info) => {
        if (typeof onStageChange === 'function') {
            try { onStageChange(stage, info || {}); } catch (_) { /* ignore */ }
        }
    };

    const uploadOnePart = async (partNo, blob) => {
        let attempt = 0;
        let lastErr = null;
        while (attempt <= maxRetries) {
            if (cancelled) throw new Error('用户取消上传');
            if (signal && signal.aborted) throw new Error('用户取消上传');
            try {
                const form = new FormData();
                form.append('file', blob, `part-${partNo}.part`);
                await putForm(
                    `${baseUrl}/upload-sessions/${encodeURIComponent(sessionId)}/parts/${encodeURIComponent(partNo)}`,
                    form
                );
                return;
            } catch (e) {
                lastErr = e;
                attempt += 1;
                if (attempt > maxRetries) break;
                const delay = Math.min(15000, 1000 * Math.pow(2, attempt - 1));
                await wait(delay);
            }
        }
        throw lastErr || new Error(`分片 ${partNo} 上传失败`);
    };

    const promise = (async () => {
        if (!file) throw new Error('缺少上传文件');
        const total = Number(file.size || 0);
        if (total <= 0) throw new Error('文件大小无效');

        let uploadedPartsSet = new Set();
        let serverChunk;
        let totalParts;

        if (resumeSessionId) {
            // 断点续传：查询已有会话，跳过已上传分片
            notifyStage('resuming', { message: '正在恢复上传会话...' });
            const session = await getJson(
                `${baseUrl}/upload-sessions/${encodeURIComponent(resumeSessionId)}`
            );
            sessionId = resumeSessionId;
            serverChunk = Math.max(1, Number(session.chunk_size || chunkSize || 64 * 1024 * 1024));
            totalParts = Math.max(1, Number(session.total_parts || Math.ceil(total / serverChunk)));
            uploadedPartsSet = new Set(
                (Array.isArray(session.uploaded_parts) ? session.uploaded_parts : []).map(Number)
            );
            if (typeof onSessionCreated === 'function') {
                onSessionCreated({ sessionId, ...session });
            }
            // 如果所有分片已上传，直接跳到完成阶段
            if (uploadedPartsSet.size >= totalParts) {
                notifyStage('uploading', { message: '所有分片已上传，跳过...', totalParts });
                if (typeof onProgress === 'function') {
                    onProgress({ loaded: total, total, percent: 100 });
                }
            }
        } else {
            // 1. 创建上传会话
            notifyStage('creating', { message: '正在创建上传会话...' });
            const createPayload = {
                filename: file.name || 'dataset.zip',
                total_size: total,
            };
            if (chunkSize != null && chunkSize > 0) {
                createPayload.chunk_size = Number(chunkSize);
            }
            if (extraCreateFields && typeof extraCreateFields === 'object') {
                Object.keys(extraCreateFields).forEach((k) => {
                    const v = extraCreateFields[k];
                    if (v !== null && v !== undefined) createPayload[k] = v;
                });
            }

            const create = await postJson(`${baseUrl}/upload-sessions`, createPayload);
            sessionId = create.session_id;
            serverChunk = Math.max(1, Number(create.chunk_size || chunkSize || 64 * 1024 * 1024));
            totalParts = Math.max(1, Number(create.total_parts || Math.ceil(total / serverChunk)));
            if (typeof onSessionCreated === 'function') {
                onSessionCreated({ sessionId, ...create });
            }
        }

        // 2. 上传分片（跳过已上传的分片）
        notifyStage('uploading', { message: '正在上传分片...', totalParts });

        let uploadedBytes = 0;
        const uploadPartWithProgress = async (partNo) => {
            const start = (partNo - 1) * serverChunk;
            const end = Math.min(total, start + serverChunk);
            const blob = file.slice(start, end);
            await uploadOnePart(partNo, blob);

            uploadedBytes = Math.max(uploadedBytes, end);
            if (typeof onProgress === 'function') {
                const percent = total > 0 ? Math.round((uploadedBytes / total) * 100) : 0;
                onProgress({ loaded: uploadedBytes, total, percent: Math.max(0, Math.min(100, percent)) });
            }
        };

        // 并行或串行上传分片（跳过已上传）
        const pendingParts = [];
        for (let i = 0; i < totalParts; i += 1) {
            if (!uploadedPartsSet.has(i + 1)) {
                pendingParts.push(i + 1);
            }
        }

        if (parallelLimit > 1 && pendingParts.length > 1) {
            for (let i = 0; i < pendingParts.length; i += parallelLimit) {
                if (cancelled) throw new Error('用户取消上传');
                if (signal && signal.aborted) throw new Error('用户取消上传');
                const batch = pendingParts.slice(i, i + parallelLimit).map(uploadPartWithProgress);
                await Promise.all(batch);
            }
        } else {
            for (const partNo of pendingParts) {
                if (cancelled) throw new Error('用户取消上传');
                if (signal && signal.aborted) throw new Error('用户取消上传');
                await uploadPartWithProgress(partNo);
            }
        }

        // 3. 通知上传完成
        if (typeof onUploadDone === 'function') onUploadDone();

        // 4. 完成上传，触发后端合并
        notifyStage('completing', { message: '正在合并分片...' });
        const completePayload = {};
        if (extraCompleteFields && typeof extraCompleteFields === 'object') {
            Object.keys(extraCompleteFields).forEach((k) => {
                const v = extraCompleteFields[k];
                if (v !== null && v !== undefined) completePayload[k] = v;
            });
        }

        const done = await postJson(
            `${baseUrl}/upload-sessions/${encodeURIComponent(sessionId)}/complete`,
            completePayload
        );

        // 5. 通知 task_id
        const taskId = done && done.task_id ? done.task_id : null;
        if (taskId && typeof onTaskReady === 'function') {
            onTaskReady(taskId);
        }

        return done;
    })();

    return {
        promise,
        cancel: () => {
            cancelled = true;
            if (sessionId) {
                fetch(`${baseUrl}/upload-sessions/${encodeURIComponent(sessionId)}`, {
                    method: 'DELETE',
                }).catch(() => { });
            }
        },
    };
}

// ── Upload task polling ───────────────────────────────────────────────────

/**
 * 轮询上传任务状态，直到任务结束或取消。
 *
 * @param {string} taskId - complete 返回的 task_id
 * @param {Object} options
 * @param {Function} [options.onStageChange] - (stage, info) => void，info 包含 status/stage/progress/error_message
 * @param {number} [options.interval=2000] - 轮询间隔（ms）
 * @param {AbortSignal} [options.signal] - 外部取消信号
 * @returns {Promise<Object>} 最终任务信息
 */
export async function pollUploadTask(taskId, {
    onStageChange = null,
    interval = 2000,
    signal = null,
} = {}) {
    if (!taskId) throw new Error('缺少 task_id');
    const delay = Math.max(1000, Number(interval) || 2000);
    const taskUrl = `${API_BASE}/api/v3/dataset-upload-tasks/${encodeURIComponent(taskId)}`;
    const terminalStates = ['done', 'failed', 'cancelled'];

    let lastStage = '';

    const wait = (ms) => new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        }
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (signal && signal.aborted) {
            throw new Error('轮询已取消');
        }

        const res = await fetch(taskUrl);
        const data = await safeJson(res);
        if (!res.ok) {
            throw new Error(pickErrorMessage(data, res));
        }

        const stage = String(data && data.stage || data && data.status || '');
        const status = String(data && data.status || '');
        const progress = Number(data && data.progress) || 0;
        const errorMessage = String(data && data.error_message || '').trim();

        // 通知阶段变化
        if (stage && stage !== lastStage && typeof onStageChange === 'function') {
            lastStage = stage;
            onStageChange(stage, {
                status,
                stage,
                progress,
                errorMessage: errorMessage || null,
            });
        }

        // 终态检查
        if (terminalStates.includes(status.toLowerCase())) {
            if (status.toLowerCase() === 'failed') {
                throw new Error(errorMessage || '服务端处理失败');
            }
            return data;
        }

        await wait(delay);
    }
}

// ── Upload session persistence (localStorage) ────────────────────────────

const SESSION_STORE_KEY = 'tfs_upload_sessions';

function readSessionStore() {
    try {
        const raw = window.localStorage.getItem(SESSION_STORE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

function writeSessionStore(store) {
    try {
        window.localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(store));
    } catch (_) { /* ignore quota errors */ }
}

/**
 * 保存上传会话信息到 localStorage，用于页面刷新后恢复。
 */
export function saveUploadSession(sessionId, meta) {
    const store = readSessionStore();
    store[sessionId] = {
        ...(store[sessionId] || {}),
        ...meta,
        savedAt: new Date().toISOString(),
    };
    writeSessionStore(store);
}

/**
 * 从 localStorage 读取上传会话信息。
 */
export function loadUploadSession(sessionId) {
    const store = readSessionStore();
    return store[sessionId] || null;
}

/**
 * 清除指定的上传会话信息。
 */
export function clearUploadSession(sessionId) {
    const store = readSessionStore();
    delete store[sessionId];
    writeSessionStore(store);
}

/**
 * 查找与当前文件和数据集匹配的可恢复会话。
 * 返回 { sessionId, sessionInfo } 或 null。
 */
export function findResumableSession({ datasetId, datasetKind, fileName, fileSize }) {
    const store = readSessionStore();
    const candidates = [];
    Object.keys(store).forEach((sid) => {
        const info = store[sid];
        if (!info) return;
        const sameDataset = String(info.datasetId) === String(datasetId)
            && String(info.datasetKind) === String(datasetKind);
        const sameFile = String(info.fileName) === String(fileName)
            && Number(info.fileSize) === Number(fileSize);
        if (sameDataset && sameFile) {
            candidates.push({ sessionId: sid, info });
        }
    });
    if (!candidates.length) return null;
    // 返回最近的一个
    candidates.sort((a, b) => new Date(b.info.savedAt) - new Date(a.info.savedAt));
    return candidates[0];
}

// ── Task state persistence (localStorage) ─────────────────────────────────

const TASK_STORE_KEY = 'tfs_upload_tasks';

function readTaskStore() {
    try {
        const raw = window.localStorage.getItem(TASK_STORE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

function writeTaskStore(store) {
    try {
        window.localStorage.setItem(TASK_STORE_KEY, JSON.stringify(store));
    } catch (_) { /* ignore quota errors */ }
}

function makeTaskKey(datasetId, datasetKind) {
    return `${String(datasetKind).trim().toLowerCase()}:${String(datasetId)}`;
}

/**
 * 保存任务信息到 localStorage，用于页面刷新后恢复任务轮询。
 * 当 complete 返回 task_id 后调用。
 */
export function saveUploadTask(datasetId, datasetKind, taskId, meta = {}) {
    if (!datasetId || !datasetKind || !taskId) return;
    const store = readTaskStore();
    const key = makeTaskKey(datasetId, datasetKind);
    store[key] = {
        taskId,
        datasetId: String(datasetId),
        datasetKind: String(datasetKind).trim().toLowerCase(),
        ...meta,
        savedAt: new Date().toISOString(),
    };
    writeTaskStore(store);
}

/**
 * 读取指定数据集的任务信息，用于页面刷新后恢复轮询。
 */
export function loadUploadTask(datasetId, datasetKind) {
    const store = readTaskStore();
    const key = makeTaskKey(datasetId, datasetKind);
    return store[key] || null;
}

/**
 * 清除指定数据集的任务信息。
 */
export function clearUploadTask(datasetId, datasetKind) {
    const store = readTaskStore();
    const key = makeTaskKey(datasetId, datasetKind);
    delete store[key];
    writeTaskStore(store);
}

// ── URL / path helpers ────────────────────────────────────────────────────

export function toAbsUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${API_BASE}${url}`;
}

export function encodePathSegments(p) {
    const s = String(p || '').replace(/\\/g, '/');
    return s.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

export function normalizeFileArray(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.filter(Boolean);
    if (typeof File !== 'undefined' && input instanceof File) return [input];
    if (typeof FileList !== 'undefined' && input instanceof FileList) return Array.from(input).filter(Boolean);
    if (typeof input.length === 'number') return Array.from(input).filter(Boolean);
    return [input];
}

export function formatMb(mb) {
    const n = Number(mb);
    if (!Number.isFinite(n)) return '0MB';
    return `${n.toFixed(2)}MB`;
}

export function basename(p) {
    const s = String(p || '').replace(/\\/g, '/');
    const parts = s.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : s;
}

// ── WebSocket reconnect helper ────────────────────────────────────────────

/**
 * Generic reconnecting WebSocket wrapper.
 * @param {Function} urlBuilder - () => ws url string
 * @param {Object} messageHandlers - { onSnapshot, onProgress, onDone, onError, ... }
 * @param {Object} options - { minDelayMs, maxDelayMs, reconnectFactor, jitterMs }
 * @param {Function} onMessage - (payload, helpers) => void — called for every parsed message
 */
export function createReconnectingWs(urlBuilder, { onOpen, onClose, onError, onReconnect, onMessage } = {}, options = {}) {
    const _onOpen = typeof onOpen === 'function' ? onOpen : () => {};
    const _onClose = typeof onClose === 'function' ? onClose : () => {};
    const _onError = typeof onError === 'function' ? onError : () => {};
    const _onReconnect = typeof onReconnect === 'function' ? onReconnect : () => {};
    const _onMessage = typeof onMessage === 'function' ? onMessage : () => {};

    const minDelayMs = Math.max(300, Number(options.minDelayMs ?? 1000) || 1000);
    const maxDelayMs = Math.max(minDelayMs, Number(options.maxDelayMs ?? 30000) || 30000);
    const reconnectFactor = Math.max(1.1, Number(options.reconnectFactor ?? 1.8) || 1.8);
    const jitterMs = Math.max(0, Number(options.jitterMs ?? 300) || 0);

    let ws = null;
    let closedManually = false;
    let reconnectAttempt = 0;
    let reconnectTimer = null;

    const clearReconnectTimer = () => {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    };

    const scheduleReconnect = () => {
        if (closedManually) return;
        reconnectAttempt += 1;
        const baseDelay = Math.min(maxDelayMs, Math.round(minDelayMs * Math.pow(reconnectFactor, reconnectAttempt - 1)));
        const delay = baseDelay + (jitterMs ? Math.floor(Math.random() * jitterMs) : 0);
        _onReconnect({ attempt: reconnectAttempt, delayMs: delay });
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
    };

    const connect = () => {
        if (closedManually) return;
        clearReconnectTimer();
        const url = urlBuilder();
        try {
            ws = new WebSocket(url);
        } catch (e) {
            _onError(e);
            scheduleReconnect();
            return;
        }
        ws.onopen = () => { reconnectAttempt = 0; _onOpen({ url }); };
        ws.onmessage = (evt) => {
            let payload = null;
            try { payload = JSON.parse(evt.data || '{}'); } catch (_) { return; }
            _onMessage(payload, { close: () => { closedManually = true; clearReconnectTimer(); try { if (ws) ws.close(); } catch (_) {} } });
        };
        ws.onerror = (err) => { _onError(err); };
        ws.onclose = (evt) => { _onClose(evt); if (!closedManually) scheduleReconnect(); };
    };

    connect();

    return {
        close() {
            closedManually = true;
            clearReconnectTimer();
            if (ws) { try { ws.close(); } catch (_) {} ws = null; }
        },
        reconnect() {
            if (closedManually) return;
            if (ws) { try { ws.close(); } catch (_) {} } else { scheduleReconnect(); }
        },
    };
}
