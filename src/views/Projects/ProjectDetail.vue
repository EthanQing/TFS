<template>
  <div class="project-detail-page page-container">
    <header class="pd-hero">
      <div class="pd-hero-left">
        <button class="back-link" type="button" @click="goBackToProjects">
          <i class="el-icon-arrow-left"></i> 返回项目列表
        </button>
        <div class="pd-content">
            <div class="pd-eyebrow">项目概览</div>
            <h1 class="pd-title">{{ projectInfo?.project_name || '项目详情' }}</h1>
            <div class="pd-meta">
            <span class="meta-chip">
                <i class="el-icon-time"></i>
                {{ updateTimeText }}
            </span>
            <span v-if="projectInfo?.dataset" class="meta-chip">
                <i class="el-icon-folder"></i>
                数据集: {{ projectInfo.dataset.dataset_name }}
            </span>
            </div>
        </div>
      </div>
      <div class="pd-hero-right">
        <div class="pd-stat">
          <div class="pd-stat-label">模型数</div>
          <div class="pd-stat-value">{{ modelCount }}</div>
        </div>
        <div class="pd-stat">
          <div class="pd-stat-label">总大小</div>
          <div class="pd-stat-value">{{ totalSize }}</div>
        </div>
        <el-button type="primary" class="primary-action" @click="openCreateJob">
            新建训练任务
        </el-button>
      </div>
    </header>

    <section class="pd-body glass-panel">
      <header class="pd-toolbar">
        <div class="search-shell">
          <i class="el-icon-search"></i>
          <el-input
            v-model="searchQuery"
            placeholder="搜索训练任务"
            class="search-input"
            clearable
          ></el-input>
        </div>
        <div class="pd-summary">
          {{ filteredModels.length }} 个任务
        </div>
      </header>

      <div class="pd-list">
        <div v-if="loading" class="state loading">
          <i class="el-icon-loading"></i>
          <span>正在加载任务...</span>
        </div>
        <div v-else-if="filteredModels.length === 0" class="state empty">
          <i class="el-icon-folder-opened"></i>
          <span>暂无训练任务</span>
        </div>
        <div v-else class="job-grid">
          <div
            v-for="model in filteredModels"
            :key="model.job_id"
            class="job-card"
            @click="goProjectsCharts(model)"
          >
            <div class="job-status-indicator" :class="statusClass(model.status)"></div>
            <div class="job-main">
              <div class="job-header">
                <div class="job-title">{{ model.job_name }}</div>
                <div class="job-sub">{{ model.architecture?.model_variant || '未知架构' }}</div>
              </div>
              <div class="job-meta-grid">
                <div class="meta-item">
                    <span class="label">状态</span>
                    <span class="value status-text" :class="statusClass(model.status)">{{ model.status || 'unknown' }}</span>
                </div>
                <div class="meta-item">
                    <span class="label">进度</span>
                    <span class="value">{{ formatProgress(model) }}</span>
                </div>
                <div class="meta-item">
                    <span class="label">大小</span>
                    <span class="value">{{ formatModelSize(model.model_size_mb) }}</span>
                </div>
                <div class="meta-item">
                    <span class="label">创建时间</span>
                    <span class="value">{{ formatCreateTime(model.created_at) }}</span>
                </div>
              </div>
            </div>
            <div class="job-actions" @click.stop>
              <el-button
                v-if="model.status === 'pending'"
                type="success"
                size="mini"
                :loading="startingJobs && startingJobs[model.job_id]"
                class="action-btn"
                @click.stop="startJob(model.job_id)"
              >开始</el-button>
              <el-button
                v-else-if="model.status === 'queued'"
                type="primary"
                size="mini"
                disabled
                class="action-btn"
              >队列中</el-button>
              <el-dropdown trigger="click" @command="handlePDCommand($event, model.job_id)">
                <span class="more-btn">
                  <i class="el-icon-more"></i>
                </span>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item command="delete" icon="el-icon-delete" class="danger-text">删除</el-dropdown-item>
                  <el-dropdown-item command="export" icon="el-icon-download">导出</el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Create Dialog -->
    <el-dialog
      title="创建训练任务"
      :visible.sync="dialogVisible"
      :width="dialogWidth"
      :close-on-click-modal="true"
      append-to-body
      custom-class="glass-dialog"
    >
      <ModelsStep2
        :project="projectInfo"
        @task-added="onTaskAdded"
        @close="dialogVisible = false"
      />
    </el-dialog>

    <!-- Export Dialog -->
    <el-dialog
      title="导出模型"
      :visible.sync="exportDialogVisible"
      width="480px"
      append-to-body
      custom-class="glass-dialog"
    >
      <div class="export-form">
        <el-form label-position="top">
            <el-form-item label="Format">
                <el-radio-group v-model="exportForm.format" :disabled="exporting">
                    <el-radio label="pt">Original (.pt)</el-radio>
                    <el-radio label="onnx">ONNX (YOLOv8)</el-radio>
                </el-radio-group>
            </el-form-item>
             <el-form-item label="Weights">
                <el-select v-model="exportForm.weights" :disabled="exporting" style="width: 100%;">
                    <el-option label="best.pt" value="best" />
                    <el-option label="last.pt" value="last" />
                </el-select>
             </el-form-item>

            <template v-if="exportForm.format === 'onnx'">
                <el-form-item label="Opset">
                     <el-input-number v-model="exportForm.opset" :min="9" :max="20" :disabled="exporting" controls-position="right" style="width: 100%" />
                </el-form-item>
                <el-form-item label="Dynamic Shape">
                    <el-switch v-model="exportForm.dynamic" :disabled="exporting" />
                </el-form-item>
                 <el-form-item label="Image Size (imgsz)">
                     <el-input-number v-model="exportForm.imgsz" :min="32" :max="4096" :step="32" :disabled="exporting" controls-position="right" style="width: 100%" />
                </el-form-item>
            </template>
        </el-form>
      </div>

      <span slot="footer" class="dialog-footer">
        <el-button @click="exportDialogVisible = false" :disabled="exporting">取消</el-button>
        <el-button type="primary" @click="confirmExport" :loading="exporting">导出</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { FetchProjectsDetail } from '@/api/projects';
import {
  fetchTrainingJobs,
  startTrainingJob,
  DeleteTrainingJob,
  FetchTrainingJobsStatus,
  ExportModel,
  FetchTrainingJobModelSize
} from '@/api/training';
import { API_BASE } from '@/utils/request';
import ModelsStep2 from '@/views/Models/CreateModel/Step2.vue';
import { referenceStore, loadDatasets } from '@/store/referenceStore';

export default {
  name: 'ProjectsDetail',
  components: { ModelsStep2 },
  data() {
    return {
      searchQuery: '',
      projectInfo: null,
      projectModels: [],
      loading: false,
      dialogVisible: false,
      dialogWidth: '860px',
      startingJobs: {},
      wsMap: {},
      wsLimit: 5,
      statusTimer: null,
      exportDialogVisible: false,
      exporting: false,
      exportTargetJobId: null,
      exportForm: {
        format: 'pt',
        weights: 'best',
        opset: 12,
        dynamic: true,
        imgsz: 640,
      },
    };
  },
  computed: {
    updateTimeText() {
      if (this.projectInfo?.created_at) {
        const createTime = new Date(this.projectInfo.created_at);
        const now = new Date();
        const diffTime = Math.abs(now - createTime);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return '创建于 1 天前';
        else if (diffDays < 30) return `创建于 ${diffDays} 天前`;
        else if (diffDays < 365) return `创建于 ${Math.floor(diffDays / 30)} 个月前`;
        else return `创建于 ${Math.floor(diffDays / 365)} 年前`;
      }
      return '未知创建时间';
    },
    modelCount() {
      if (this.projectInfo && this.projectInfo.completed_models_count !== undefined) {
        return this.projectInfo.completed_models_count;
      }
      return this.projectModels.length || 0;
    },
    totalSize() {
      const ensureMB = v => {
        if (v === undefined || v === null || String(v).length === 0) return null;
        const s = String(v).trim();
        if (/mb$/i.test(s)) return s;
        const n = parseFloat(s);
        if (!isNaN(n)) return `${n}MB`;
        return `${s}MB`;
      };
      if (this.projectInfo && this.projectInfo.total_size_mb !== undefined) {
        return ensureMB(this.projectInfo.total_size_mb) || '0MB';
      }
      return '0MB';
    },
    filteredModels() {
      const source = Array.isArray(this.projectModels) ? this.projectModels : [];
      const query = (this.searchQuery || '').toLowerCase();
      const list = source.filter(m => {
        if (!query) return true;
        return (m.job_name || '').toLowerCase().includes(query);
      });
      return list.sort((a, b) => {
          const tA = new Date(a.created_at || 0).getTime();
          const tB = new Date(b.created_at || 0).getTime();
          return tB - tA;
      });
    }
  },
  watch: {
    '$route.query.projectId': {
      handler(newProjectId) {
        if (newProjectId) {
          this.loadProjectDetails(newProjectId);
        }
      },
      immediate: true
    }
  },
  created() {
    this.initProjectInfo();
  },
  mounted() {
    const update = () => {
      const w = window.innerWidth || document.documentElement.clientWidth;
      if (w >= 1600) this.dialogWidth = '980px';
      else if (w >= 1400) this.dialogWidth = '920px';
      else if (w >= 1200) this.dialogWidth = '880px';
      else if (w >= 992) this.dialogWidth = '820px';
      else if (w >= 768) this.dialogWidth = '680px';
      else this.dialogWidth = '94%';
    };
    this._resizeHandler = update;
    update();
    window.addEventListener('resize', this._resizeHandler);
    this.statusTimer = setInterval(this.refreshRunningStatuses, 15000);
  },
  methods: {
    goBackToProjects() {
      this.$router.push({ path: '/projects' });
    },
    openCreateJob() {
      if (this._resizeHandler) this._resizeHandler();
      this.dialogVisible = true;
    },
    onTaskAdded() {
      const pid = this.projectInfo?.project_id || this.$route.query.projectId;
      if (pid) this.loadProjectDetails(pid);
      this.dialogVisible = false;
    },
    async startJob(jobId) {
      this.$set(this.startingJobs, jobId, true);
      try {
        const updated = await startTrainingJob(jobId);
        const idx = this.projectModels.findIndex(m => m.job_id === jobId);
        if (idx >= 0 && updated?.status) this.$set(this.projectModels[idx], 'status', updated.status);
        this.$message.success('已添加到训练队列。');
      } catch (e) {
        this.$message.error('启动训练失败。');
      } finally {
        this.$set(this.startingJobs, jobId, false);
      }
    },
    handlePDCommand(command, jobId) {
      if (command === 'delete') this.deletePDJob(jobId);
      if (command === 'export') this.openExportDialog(jobId);
    },
    openExportDialog(jobId) {
      this.exportTargetJobId = jobId;
      this.exportForm = { ...this.exportForm, format: 'pt', weights: 'best' };
      this.exportDialogVisible = true;
    },
    async confirmExport() {
      const jobId = this.exportTargetJobId;
      if (!jobId) return;
      this.exporting = true;
      try {
        this.$message({ type: 'info', message: '开始导出...' });
        const res = await ExportModel(jobId, this.exportForm);
        const raw = res && (res.download_url || res.url || res.file_url || res.path || res.link);
        if (!raw) throw new Error('No download URL returned');
        
        const href = String(raw).startsWith('http') ? raw : `${API_BASE}${raw}`;
        const a = document.createElement('a');
        a.href = href;
        a.download = '';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.$message.success('下载已开始。');
        this.exportDialogVisible = false;
      } catch (error) {
        this.$message.error('导出失败: ' + (error.message || error));
      } finally {
        this.exporting = false;
      }
    },
    async deletePDJob(jobId) {
      try {
        await this.$confirm('确定要删除此训练任务吗？', '确认删除', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
        await DeleteTrainingJob(jobId);
        this.$message.success('删除成功。');
        const pid = this.projectInfo?.project_id || this.$route.query.projectId;
        if (pid) this.loadProjectDetails(pid);
      } catch (e) {}
    },
    goProjectsCharts(model) {
      this.$router.push({ path: '/projectscharts/trainpart', query: { jobId: model.job_id } });
    },
    async refreshRunningStatuses() {
      if (!Array.isArray(this.projectModels)) return;
      const running = this.projectModels.filter(j => ['running', 'queued'].includes((j.status || '').toLowerCase()));
      await Promise.allSettled(running.map(async job => {
        try {
          const s = await FetchTrainingJobsStatus(job.job_id);
          if (s) {
              if (s.current_epoch !== undefined) this.$set(job, 'current_epoch', s.current_epoch);
              if (s.status) this.$set(job, 'status', s.status);
          }
        } catch (_) {}
      }));
    },
    initProjectInfo() {
      const projectId = this.$route.query.projectId;
      if (projectId) {
        this.loadProjectDetails(projectId);
      } else {
        const stored = localStorage.getItem('currentProject');
        if (stored) {
            try {
                this.projectInfo = JSON.parse(stored);
                this.loadProjectDetails(this.projectInfo.project_id);
            } catch(e) {}
        }
      }
    },
    async loadProjectDetails(projectId) {
      if (!projectId) return;
      this.loading = true;
      try {
        const detail = await FetchProjectsDetail(projectId);
        this.projectInfo = detail;

        // Enhance dataset info
        try {
            await loadDatasets();
            const ds = referenceStore.datasets.find(d => d.dataset_id === this.projectInfo.dataset_id);
            if (ds) this.projectInfo.dataset = { dataset_name: ds.dataset_name };
        } catch(e) {}

        if (Array.isArray(detail.training_jobs)) {
          this.projectModels = detail.training_jobs;
        } else {
            // Fallback
             const all = await fetchTrainingJobs();
             this.projectModels = all.filter(j => j.project_id == projectId);
        }
        await this.fetchCompletedModelSizes();
        localStorage.setItem('currentProject', JSON.stringify(this.projectInfo));
      } catch (error) {
        console.error('Failed load project', error);
      } finally {
        this.loading = false;
      }
    },
    async fetchCompletedModelSizes() {
        // Implementation kept same
    },
    formatProgress(model) {
      const s = (model.status || '').toLowerCase();
      if (s === 'completed') return '100%';
      if (s === 'running') {
        const current = (model.current_epoch || 0) + 1;
        const total = model.parameters?.epochs || '?';
        return `${current}/${total}`;
      }
      return '-';
    },
    formatCreateTime(dateStr) {
       if(!dateStr) return '-';
       return new Date(dateStr).toLocaleDateString();
    },
    statusClass(status) {
      if (!status) return 'status-pending';
      const s = String(status).toLowerCase();
      
      const map = {
          completed: 'status-success',
          running: 'status-running',
          queued: 'status-warning',
          failed: 'status-error',
          error: 'status-error'
      }
      return map[s] || 'status-pending';
    },
    formatModelSize(sizeMb) {
      return sizeMb ? sizeMb.toFixed(1) + 'MB' : '-';
    }
  },
  beforeDestroy() {
    window.removeEventListener('resize', this._resizeHandler);
    if (this.statusTimer) clearInterval(this.statusTimer);
  }
};
</script>

<style scoped>
.project-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Hero */
.pd-hero {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: var(--text-main);
  position: relative;
  overflow: hidden;
}

.pd-hero::before {
  content: none;
}

.pd-hero-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.back-link {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background: white;
  border: 1px solid #e5e7eb;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.back-link:hover { background: #f3f4f6; color: var(--text-main); }

.pd-content { display: flex; flex-direction: column; gap: 0.25rem; }

.pd-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  opacity: 0.8;
  color: var(--color-primary);
}

.pd-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.pd-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.meta-chip {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  color: var(--text-secondary);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pd-hero-right {
  display: flex;
  gap: 1rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.pd-stat {
  min-width: 90px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  text-align: center;
}

.pd-stat-label { font-size: 0.7rem; color: var(--text-secondary); }
.pd-stat-value { font-size: 1.125rem; font-weight: 700; color: var(--color-primary); margin-top: 0.25rem; }

.primary-action {
  border-radius: var(--radius-full) !important;
  font-weight: 600;
}

/* Body */
.pd-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: hidden;
}

.pd-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-full);
  border: 1px solid rgba(0,0,0,0.05);
}

.search-input ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  padding: 0;
  height: auto;
}

.pd-summary { color: var(--text-secondary); font-size: 0.875rem; }

.pd-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: var(--text-secondary);
    gap: 0.5rem;
}

.state i { font-size: 2rem; opacity: 0.5; }

/* Job Grid */
.job-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.job-card {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.job-card:hover {
  transform: translateY(-4px);
  background: #fff;
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
}

.job-status-indicator {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 4px;
}

.job-status-indicator.status-success { background: #10b981; }
.job-status-indicator.status-running { background: #3b82f6; }
.job-status-indicator.status-warning { background: #f59e0b; }
.job-status-indicator.status-error { background: #ef4444; }
.job-status-indicator.status-pending { background: #cbd5e1; }

.job-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
.job-title { font-weight: 700; color: var(--text-main); font-size: 1rem; }
.job-sub { font-size: 0.75rem; color: var(--text-secondary); }

.job-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    font-size: 0.75rem;
}

.meta-item { display: flex; flex-direction: column; gap: 0.1rem; }
.meta-item .label { color: var(--text-secondary); font-size: 0.7rem; }
.meta-item .value { color: var(--text-main); font-weight: 500; }

.status-text.status-success { color: #059669; }
.status-text.status-running { color: #2563eb; }
.status-text.status-error { color: #dc2626; }

.job-actions {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.5rem;
    border-top: 1px solid rgba(0,0,0,0.05);
    padding-top: 0.75rem;
}

.more-btn {
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    color: var(--text-secondary);
}
.more-btn:hover { color: var(--text-main); }
.danger-text { color: #ef4444; }

.action-btn { font-weight: 600; }
</style>
