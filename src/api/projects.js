import { API_BASE } from '@/utils/request';
import { safeJson, getJson, postJson, deleteJson, patchJson } from './apiUtils';

function pickPageItems(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
}

function mapProjectOut(p) {
    if (!p || typeof p !== 'object') return p;

    // V3 uses standard_dataset_id
    let dataset = p.dataset;
    const sid = p.standard_dataset_id || p.dataset_id;
    if (!dataset && (sid || p.dataset_name)) {
        dataset = {
            dataset_id: sid,
            dataset_name: p.dataset_name || (sid ? `Dataset #${sid}` : null)
        };
    }

    return {
        ...p,
        project_id: p.project_id || p.id,
        project_name: p.project_name || p.name,
        name: p.name || p.project_name,
        dataset: dataset,
        dataset_id: sid,
        standard_dataset_id: sid,
        dataset_name: p.dataset_name || (dataset && dataset.dataset_name),
    };
}

// fetchProjects 项目接口
export async function fetchProjects(page = 1, pageSize = 500) {
    try {
        const url = `${API_BASE}/api/v3/projects?page=${encodeURIComponent(page)}&page_size=${encodeURIComponent(pageSize)}`;
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
        const payload = {
            name: projectData?.name || projectData?.project_name || projectData?.projectName,
            description: projectData?.description,
            standard_dataset_id: Number(projectData?.dataset_id ?? projectData?.standard_dataset_id ?? projectData?.dataset),
            task_type: projectData?.task_type || 'detection',
            created_by: projectData?.created_by || projectData?.user || '',
            tags: projectData?.tags,
        };

        const response = await fetch(`${API_BASE}/api/v3/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const response = await fetch(`${API_BASE}/api/v3/projects/${projectId}`);
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

// deleteProject 删除项目接口
export async function deleteProject(projectId, { force = false } = {}) {
    try {
        const id = Number(projectId);
        if (!Number.isFinite(id)) throw new Error('无效的 projectId');

        const response = await fetch(`${API_BASE}/api/v3/projects/${id}?force=${force ? '1' : '0'}`, {
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
        const response = await fetch(`${API_BASE}/api/v3/projects/${projectId}/model-size`);
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

// FetchProjectsModelsSize 批量获取项目模型大小
export async function FetchProjectsModelsSize(projectIds = []) {
    try {
        const ids = Array.isArray(projectIds) ? projectIds.map(x => Number(x)).filter(x => Number.isFinite(x)) : [];
        if (!ids.length) return [];
        const q = ids.join(',');
        const response = await fetch(`${API_BASE}/api/v3/projects/model-sizes?project_ids=${encodeURIComponent(q)}`);
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

export async function fetchProjectCompareBaseline(projectId, frameworkKey) {
    try {
        const pid = Number(projectId);
        const fw = String(frameworkKey || '').trim();
        if (!Number.isFinite(pid)) throw new Error('无效的 projectId');
        if (!fw) throw new Error('framework_key is required');

        const url = `${API_BASE}/api/v3/projects/${encodeURIComponent(pid)}/compare-baseline?framework_key=${encodeURIComponent(fw)}`;
        const response = await fetch(url);
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            const err = new Error(msg);
            err.status = response.status;
            err.data = data;
            throw err;
        }
        return data;
    } catch (error) {
        console.error('获取对比基准失败:', error);
        throw error;
    }
}

export async function setProjectCompareBaseline(projectId, payload = {}) {
    try {
        const pid = Number(projectId);
        if (!Number.isFinite(pid)) throw new Error('无效的 projectId');

        const body = {
            framework_key: String(payload.framework_key || '').trim(),
            baseline_run_id: String(payload.baseline_run_id || '').trim(),
        };
        if (!body.framework_key) throw new Error('framework_key is required');
        if (!body.baseline_run_id) throw new Error('baseline_run_id is required');

        const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(pid)}/compare-baseline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            const err = new Error(msg);
            err.status = response.status;
            err.data = data;
            throw err;
        }
        return data;
    } catch (error) {
        console.error('设置对比基准失败:', error);
        throw error;
    }
}

export async function clearProjectCompareBaseline(projectId, frameworkKey) {
    try {
        const pid = Number(projectId);
        const fw = String(frameworkKey || '').trim();
        if (!Number.isFinite(pid)) throw new Error('无效的 projectId');
        if (!fw) throw new Error('framework_key is required');

        const response = await fetch(`${API_BASE}/api/v3/projects/${encodeURIComponent(pid)}/compare-baseline?framework_key=${encodeURIComponent(fw)}`, {
            method: 'DELETE',
        });
        const data = await safeJson(response);
        if (!response.ok) {
            const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
            const err = new Error(msg);
            err.status = response.status;
            err.data = data;
            throw err;
        }
        return data;
    } catch (error) {
        console.error('清除对比基准失败:', error);
        throw error;
    }
}
