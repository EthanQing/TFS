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

export function chunkedUpload(
    baseUrl,
    file,
    {
        chunkSize = 64 * 1024 * 1024,
        maxRetries = 5,
        onProgress = null,
        onUploadDone = null,
        onServerProcessing = null,
    } = {}
) {
    let cancelled = false;
    let sessionId = null;
    const safeChunkSize = Math.max(1 * 1024 * 1024, Number(chunkSize) || 64 * 1024 * 1024);
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const uploadOnePart = async (partNo, blob) => {
        let attempt = 0;
        let lastErr = null;
        while (attempt <= maxRetries) {
            if (cancelled) throw new Error('Upload cancelled');
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
        throw lastErr || new Error('Part upload failed');
    };

    const promise = (async () => {
        if (!file) throw new Error('缺少上传文件');
        const total = Number(file.size || 0);
        if (total <= 0) throw new Error('文件大小无效');

        const create = await postJson(`${baseUrl}/upload-sessions`, {
            filename: file.name || 'dataset.zip',
            total_size: total,
            chunk_size: safeChunkSize,
        });
        sessionId = create.session_id;
        const serverChunk = Math.max(1, Number(create.chunk_size || safeChunkSize));
        const totalParts = Math.max(1, Number(create.total_parts || Math.ceil(total / serverChunk)));

        let uploadedBytes = 0;
        for (let i = 0; i < totalParts; i += 1) {
            if (cancelled) throw new Error('Upload cancelled');
            const start = i * serverChunk;
            const end = Math.min(total, start + serverChunk);
            const blob = file.slice(start, end);
            await uploadOnePart(i + 1, blob);

            uploadedBytes = end;
            if (typeof onProgress === 'function') {
                const percent = total > 0 ? Math.round((uploadedBytes / total) * 100) : 0;
                onProgress({ loaded: uploadedBytes, total, percent: Math.max(0, Math.min(100, percent)) });
            }
        }

        if (typeof onUploadDone === 'function') onUploadDone();
        if (typeof onServerProcessing === 'function') onServerProcessing();
        const done = await postJson(
            `${baseUrl}/upload-sessions/${encodeURIComponent(sessionId)}/complete`,
            {}
        );
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
