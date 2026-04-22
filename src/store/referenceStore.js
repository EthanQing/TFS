import Vue from 'vue';

import { fetchStandardDatasets } from '@/api/standardDatasets';
import { fetchProjects } from '@/api/projects';
import { FetchArchitectureDetail } from '@/api/models';

function toErrorMessage(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;
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
    datasets: '',
    projects: '',
    architectures: '',
  },
});

function hydrateProjectsWithDatasets() {
  if (!Array.isArray(referenceStore.projects) || !Array.isArray(referenceStore.datasets)) return;
  const dsMap = new Map(referenceStore.datasets.map((d) => [Number(d.dataset_id), d]));
  referenceStore.projects = referenceStore.projects.map((p) => {
    const key = Number(p.standard_dataset_id ?? p.dataset_id);
    const ds = dsMap.get(key);
    if (!ds) return p;
    return {
      ...p,
      dataset: {
        dataset_id: ds.dataset_id,
        dataset_name: ds.dataset_name,
        dataset_type: ds.dataset_type,
      },
      standard_dataset_id: ds.dataset_id,
      dataset_id: ds.dataset_id,
    };
  });
}

export async function loadDatasets({ force = false } = {}) {
  if (referenceStore.loading.datasets) return;
  if (referenceStore.loaded.datasets && !force) return;
  referenceStore.loading.datasets = true;
  referenceStore.error.datasets = '';
  try {
    const list = await fetchStandardDatasets({ page: 1, pageSize: 500 });
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
  referenceStore.error.architectures = '';
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
  referenceStore.error.projects = '';
  try {
    referenceStore.projects = await fetchProjects(1, 500);
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
  Promise.allSettled([loadDatasets(), loadProjects(), loadArchitectures()]).catch(() => {});
}
