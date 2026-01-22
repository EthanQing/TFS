import { API_BASE } from '@/utils/request';

async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}

function pickPageItems(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
}

function mapProjectOut(p) {
    if (!p || typeof p !== 'object') return p;

    // Preserve dataset info from various possible API response formats
    let dataset = p.dataset;
    if (!dataset && (p.dataset_id || p.dataset_name)) {
        dataset = {
            dataset_id: p.dataset_id,
            dataset_name: p.dataset_name || (p.dataset_id ? `Dataset #${p.dataset_id}` : null)
        };
    }

    return {
        ...p,
        project_id: p.project_id || p.id,
        project_name: p.project_name || p.name,
        // Keep backend fields too for later API calls.
        name: p.name || p.project_name,
        // Ensure dataset info is available
        dataset: dataset,
        dataset_name: p.dataset_name || (dataset && dataset.dataset_name),
    };
}

// fetchProjects 项目接口（v2 返回 Page{items, meta}）
export async function fetchProjects(page = 1, pageSize = 500) {
    try {
        const url = `${API_BASE}/api/v2/projects?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
        const response = await fetch(url);
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `Request failed: ${response.status}`;
            throw new Error(msg);
        }
        return pickPageItems(data).map(mapProjectOut);
    } catch (error) {
        console.error('获取项目失败:', error);
        throw error;
    }
}

// createProject 创建项目接口
export async function createProject(projectData) {
    try {
        // 兼容旧前端字段：project_name -> name；并补齐 v2 必填 task_type
        const payload = {
            name: projectData?.name || projectData?.project_name || projectData?.projectName,
            description: projectData?.description,
            dataset_id: projectData?.dataset_id ?? projectData?.dataset,
            task_type: projectData?.task_type || 'detection',
            created_by: projectData?.created_by || projectData?.user || '',
            tags: projectData?.tags,
        };

        const response = await fetch(`${API_BASE}/api/v2/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await safeJson(response);

        if (response.ok) {
            return mapProjectOut(result);
        } else {
            throw new Error((result && result.detail) || '创建项目失败');
        }
    } catch (error) {
        console.error('创建项目错误:', error);
        throw error;
    }
}

// FetchProjectsDetail 获取项目详细信息接口
export async function FetchProjectsDetail(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/projects/${projectId}`);
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            throw new Error(msg);
        }
        return mapProjectOut(data);
    } catch (error) {
        console.error('获取项目失败:', error);
        throw error;
    }
}

// deleteProject 删除项目接口（v2: DELETE /projects/{id}）
export async function deleteProject(projectId, { force = false } = {}) {
    try {
        const id = Number(projectId);
        if (!Number.isFinite(id)) throw new Error('无效的 projectId');

        const response = await fetch(`${API_BASE}/api/v2/projects/${id}?force=${force ? '1' : '0'}`, {
            method: 'DELETE',
        });
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `Request failed: ${response.status}`;
            const err = new Error(msg);
            err.status = response.status;
            err.data = data;
            throw err;
        }
        return data;
    } catch (error) {
        console.error('删除项目失败:', error);
        throw error;
    }
}

// FetchProjectModelsSize 获取项目模型大小接口
export async function FetchProjectModelsSize(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/projects/${projectId}/model-size`);
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            throw new Error(msg);
        }
        return data;
    } catch (error) {
        console.error('获取项目模型大小失败:', error);
        throw error;
    }
}

// FetchProjectsModelsSize 批量获取项目模型大小（更高性能，避免逐个请求）
export async function FetchProjectsModelsSize(projectIds = []) {
    try {
        const ids = Array.isArray(projectIds) ? projectIds.map(x => Number(x)).filter(x => Number.isFinite(x)) : [];
        if (!ids.length) return [];
        const q = ids.join(',');
        const response = await fetch(`${API_BASE}/api/v2/projects/model-sizes?project_ids=${encodeURIComponent(q)}`);
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            throw new Error(msg);
        }
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('批量获取项目模型大小失败:', error);
        throw error;
    }
}
