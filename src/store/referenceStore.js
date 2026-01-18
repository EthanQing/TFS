import Vue from "vue";

import { API_BASE } from "@/utils/request";
import { fetchDatasets } from "@/api/datasets";
import { FetchArchitectureDetail } from "@/api/models";

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

function toErrorMessage(e) {
  if (!e) return "unknown error";
  if (typeof e === "string") return e;
  return e.message || String(e);
}

export const referenceStore = Vue.observable({
  datasets: [],
  projects: [],
  architectures: [],

  loading: {
    datasets: false,
    projects: false,
    architectures: false,
  },
  loaded: {
    datasets: false,
    projects: false,
    architectures: false,
  },
  error: {
    datasets: "",
    projects: "",
    architectures: "",
  },
});

function hydrateProjectsWithDatasets() {
  if (!Array.isArray(referenceStore.projects) || !Array.isArray(referenceStore.datasets)) return;
  const dsMap = new Map(referenceStore.datasets.map((d) => [d.dataset_id, d]));
  referenceStore.projects = referenceStore.projects.map((p) => {
    const ds = dsMap.get(p.dataset_id);
    if (!ds) return p;
    return {
      ...p,
      dataset: {
        dataset_id: ds.dataset_id,
        dataset_name: ds.dataset_name,
        dataset_type: ds.dataset_type,
      },
    };
  });
}

export async function loadDatasets({ force = false } = {}) {
  if (referenceStore.loading.datasets) return;
  if (referenceStore.loaded.datasets && !force) return;

  referenceStore.loading.datasets = true;
  referenceStore.error.datasets = "";
  try {
    const list = await fetchDatasets(1, 500);
    referenceStore.datasets = Array.isArray(list) ? list : [];
    referenceStore.loaded.datasets = true;
  } catch (e) {
    referenceStore.datasets = [];
    referenceStore.error.datasets = toErrorMessage(e);
  } finally {
    referenceStore.loading.datasets = false;
  }

  hydrateProjectsWithDatasets();
}

export async function loadArchitectures({ force = false } = {}) {
  if (referenceStore.loading.architectures) return;
  if (referenceStore.loaded.architectures && !force) return;

  referenceStore.loading.architectures = true;
  referenceStore.error.architectures = "";
  try {
    const list = await FetchArchitectureDetail();
    referenceStore.architectures = Array.isArray(list) ? list : [];
    referenceStore.loaded.architectures = true;
  } catch (e) {
    referenceStore.architectures = [];
    referenceStore.error.architectures = toErrorMessage(e);
  } finally {
    referenceStore.loading.architectures = false;
  }
}

export async function loadProjects({ force = false } = {}) {
  if (referenceStore.loading.projects) return;
  if (referenceStore.loaded.projects && !force) return;

  referenceStore.loading.projects = true;
  referenceStore.error.projects = "";
  try {
    // Use raw fetch here to avoid coupling to legacy front-end API shapes.
    const response = await fetch(`${API_BASE}/api/v2/projects?page=1&page_size=500`);
    const data = await safeJson(response);
    if (!response.ok) {
      const msg = (data && (data.detail || data.message)) || `请求失败: ${response.status}`;
      throw new Error(msg);
    }
    const items = pickPageItems(data);
    referenceStore.projects = items.map((p) => ({
      ...p,
      project_name: p.project_name || p.name,
      project_id: p.project_id || p.id,
      dataset: p.dataset || null,
    }));
    referenceStore.loaded.projects = true;
  } catch (e) {
    referenceStore.projects = [];
    referenceStore.error.projects = toErrorMessage(e);
  } finally {
    referenceStore.loading.projects = false;
  }

  hydrateProjectsWithDatasets();
}

export function preloadReferenceData() {
  // Fire-and-forget: components can still call load*() if they need strict readiness.
  Promise.allSettled([loadDatasets(), loadProjects(), loadArchitectures()]).catch(() => {});
}

