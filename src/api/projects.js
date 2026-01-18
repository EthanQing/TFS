import { API_BASE } from '@/utils/request';

// fetchProjects 项目接口
export async function fetchProjects() {
    try {
        const response = await fetch(`${API_BASE}/api/v2/projects`);
        const projects = await response.json();
        return projects;
    } catch (error) {
        console.error('获取项目失败:', error);
    }
}

// createProject 创建项目接口
export async function createProject(projectData) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/projects`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(projectData)
        });

        const result = await response.json();

        if (response.ok) {
            return result;
        } else {
            throw new Error(result.detail || '创建项目失败');
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
        const projects = await response.json();
        return projects;
    } catch (error) {
        console.error('获取项目失败:', error);
        throw error;
    }
}

// FetchProjectModelsSize 获取项目模型大小接口
export async function FetchProjectModelsSize(projectId) {
    try {
        const response = await fetch(`${API_BASE}/api/v2/projects/${projectId}/model-size`);
        const size = await response.json();
        return size;
    } catch (error) {
        console.error('获取项目模型大小失败:', error);
        throw error;
    }
}
