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
              标准数据集: {{ projectInfo.dataset.dataset_name }}
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
        <div class="toolbar-right">
          <div class="search-shell">
            <i class="el-icon-search"></i>
            <el-input v-model="searchQuery" placeholder="搜索训练任务" class="search-input" clearable></el-input>
          </div>
          <el-button
            v-if="!isBatchMode"
            size="mini"
            class="batch-entry-btn"
            :disabled="filteredModels.length === 0"
            @click="enterBatchMode"
          >
            <i class="el-icon-finished"></i>
            批量操作
          </el-button>
          <div v-else class="batch-tool">
            <div class="batch-tool__info">
              <span class="batch-tool__badge">
                <i class="el-icon-finished"></i>
                批量操作中
              </span>
              <span class="batch-tool__count">
                已选 {{ selectedJobIds.length }} 个
              </span>
              <span class="batch-tool__hint">
                点击卡片或勾选框可快速选择任务
              </span>
            </div>
            <div class="batch-tool__actions">
              <el-button size="mini" @click="toggleSelectAll">
                {{ isAllSelected ? '取消全选' : '全选当前列表' }}
              </el-button>
              <el-button
                type="danger"
                size="mini"
                :disabled="selectedJobIds.length === 0"
                :loading="batchDeleting"
                @click="batchDeleteConfirm"
              >
                删除所选
              </el-button>
              <el-button size="mini" @click="exitBatchMode">
                退出批量操作
              </el-button>
            </div>
          </div>
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
            :class="['job-card', { 'batch-mode': isBatchMode, selected: isJobSelected(model.job_id) }]"
            @click="handleJobCardClick(model)"
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
                  <span class="value status-text" :class="statusClass(model.status)">{{ model.status || 'unknown'
                  }}</span>
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
            <div class="job-actions" :class="{ 'batch-mode': isBatchMode }" @click.stop>
              <div v-if="isBatchMode" class="job-batch-check">
                <el-checkbox
                  :value="isJobSelected(model.job_id)"
                  @change="updateJobSelection(model.job_id, $event)"
                ></el-checkbox>
                <span class="job-batch-check__text">
                  {{ isJobSelected(model.job_id) ? '已选中' : '选择' }}
                </span>
              </div>
              <div class="job-action-group">
                <el-button v-if="model.status === 'pending'" type="success" size="mini"
                  :loading="startingJobs && startingJobs[model.job_id]" class="action-btn"
                  @click.stop="startJob(model.job_id)">开始</el-button>
                <el-button v-else-if="model.status === 'queued'" type="warning" size="mini"
                  :loading="stoppingJobs && stoppingJobs[model.job_id]" class="action-btn"
                  @click.stop="stopJob(model.job_id)">取消排队</el-button>
                <el-button v-else-if="model.status === 'running'" type="danger" size="mini"
                  :loading="stoppingJobs && stoppingJobs[model.job_id]" class="action-btn"
                  @click.stop="stopJob(model.job_id)">停止</el-button>
                <el-button v-else-if="['cancelled'].includes((model.status || '').toLowerCase())" type="primary"
                  size="mini" :loading="startingJobs && startingJobs[model.job_id]" class="action-btn"
                  @click.stop="resumeJob(model.job_id)">继续</el-button>
                <el-dropdown trigger="click" @command="handlePDCommand($event, model.job_id)">
                  <span class="more-btn">
                    <i class="el-icon-more"></i>
                  </span>
                  <el-dropdown-menu slot="dropdown">
                    <!-- <el-dropdown-item v-if="model.status === 'completed'" command="setbaseline">设为基准</el-dropdown-item> -->
                    <el-dropdown-item command="delete" icon="el-icon-delete" class="danger-text">删除</el-dropdown-item>
                    <el-dropdown-item command="export" icon="el-icon-download" :disabled="isPaddleModel(model)">
                      导出<span v-if="isPaddleModel(model)">（Paddle 暂不支持）</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Create Dialog -->
    <el-dialog :title="`创建 ${createFrameworkMeta.label} 训练任务`" :visible.sync="dialogVisible" :width="dialogWidth" :close-on-click-modal="true"
      append-to-body custom-class="glass-dialog">
      <div class="create-framework-selector">
        <span class="create-framework-selector__label">训练框架</span>
        <el-radio-group v-model="createFramework" size="small">
          <el-radio-button
            v-for="item in createFrameworkTabs"
            :key="item.key"
            :label="item.key"
          >
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <ModelsStep2
        :key="createEngine"
        :project="projectInfo"
        :engine="createEngine"
        :framework-label="createFrameworkMeta.label"
        @task-added="onTaskAdded"
        @close="dialogVisible = false"
      />
    </el-dialog>

    <!-- Export Dialog -->
    <el-dialog title="导出模型" :visible.sync="exportDialogVisible" width="480px" append-to-body
      custom-class="glass-dialog">
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
              <el-input-number v-model="exportForm.opset" :min="9" :max="20" :disabled="exporting"
                controls-position="right" style="width: 100%" />
            </el-form-item>
            <el-form-item label="Dynamic Shape">
              <el-switch v-model="exportForm.dynamic" :disabled="exporting" />
            </el-form-item>
            <el-form-item label="Image Size (imgsz)">
              <el-input-number v-model="exportForm.imgsz" :min="32" :max="4096" :step="32" :disabled="exporting"
                controls-position="right" style="width: 100%" />
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
  CancelTrainingJob,
  ResumeTrainingJob
} from '@/api/training';
import { API_BASE } from '@/utils/request';
import ModelsStep2 from '@/views/Models/CreateModel/Step2.vue';
import { referenceStore, loadDatasets } from '@/store/referenceStore';
import { resolveFramework } from '@/utils/trainingFramework';

const CREATE_FRAMEWORK_TABS = [
  { key: 'pytorch', label: 'PyTorch (YOLO)', engine: 'ultralytics-yolo' },
  { key: 'paddle', label: 'Paddle', engine: 'paddle-det' },
];

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
      stoppingJobs: {},
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
      createFramework: 'pytorch',
      createFrameworkTabs: CREATE_FRAMEWORK_TABS,
      isBatchMode: false,
      selectedJobIds: [],          // 存放被勾选的 job_id 数组
      batchDeleting: false,        // 批量删除时的 loading 状态
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
      // First check if we have actual model data with sizes
      if (Array.isArray(this.projectModels) && this.projectModels.length > 0) {
        const sum = this.projectModels.reduce((acc, m) => {
          const size = parseFloat(m.model_size_mb) || 0;
          return acc + size;
        }, 0);
        if (sum > 0) {
          return sum.toFixed(1) + 'MB';
        }
      }
      // Fallback to projectInfo
      if (this.projectInfo && this.projectInfo.total_size_mb) {
        const size = parseFloat(this.projectInfo.total_size_mb);
        if (!isNaN(size) && size > 0) {
          return size.toFixed(1) + 'MB';
        }
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
    },
    filteredJobIds() {
      return this.filteredModels.map(model => model.job_id);
    },
    selectedVisibleCount() {
      const visible = new Set(this.filteredJobIds);
      return this.selectedJobIds.filter(id => visible.has(id)).length;
    },
    isAllSelected() {
      return this.filteredModels.length > 0 &&
        this.selectedVisibleCount === this.filteredModels.length;
    },
    createFrameworkMeta() {
      return this.createFrameworkTabs.find(item => item.key === this.createFramework) || this.createFrameworkTabs[0];
    },
    createEngine() {
      return this.createFrameworkMeta.engine;
    },
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
    enterBatchMode() {
      this.isBatchMode = true;
    },
    exitBatchMode() {
      this.isBatchMode = false;
      this.selectedJobIds = [];
    },
    handleJobCardClick(model) {
      if (this.isBatchMode) {
        this.toggleJobSelection(model.job_id);
        return;
      }
      this.goProjectsCharts(model);
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
    async stopJob(jobId) {
      this.$set(this.stoppingJobs, jobId, true);
      try {
        await this.$confirm('确定要停止/取消此任务吗？', '确认', { type: 'warning' });
        const updated = await CancelTrainingJob(jobId);
        const idx = this.projectModels.findIndex(m => m.job_id === jobId);
        if (idx >= 0 && updated?.status) this.$set(this.projectModels[idx], 'status', updated.status);
        this.$message.success('已发送停止请求。');
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          this.$message.error('操作失败: ' + (e.message || e));
        }
      } finally {
        this.$set(this.stoppingJobs, jobId, false);
      }
    },
    async resumeJob(jobId) {
      if (!jobId) return;
      this.$set(this.startingJobs, jobId, true);
      try {
        await this.$confirm('确定要继续之前的训练吗？这将从上次保存的检查点继续训练。', '确认继续', { type: 'info' });
        const updated = await ResumeTrainingJob(jobId);
        const idx = this.projectModels.findIndex(m => m.job_id === jobId);
        if (idx >= 0 && updated?.status) this.$set(this.projectModels[idx], 'status', updated.status);
        this.$message.success('已恢复训练任务，状态更新为 Queued。');
      } catch (e) {
        if (e !== 'cancel' && e !== 'close') {
          this.$message.error('恢复训练失败: ' + (e.message || e));
        }
      } finally {
        this.$set(this.startingJobs, jobId, false);
      }
    },
    handlePDCommand(command, jobId) {
      if (command === 'delete') this.deletePDJob(jobId);
      if (command === 'export') this.openExportDialog(jobId);
      if (command === 'setbaseline') this.$message.info('设为基准功能待实现');
    },
    findProjectModel(jobId) {
      return (this.projectModels || []).find(model => String(model.job_id) === String(jobId)) || null;
    },
    modelFrameworkKey(model) {
      if (model?.framework_key) return model.framework_key;
      return resolveFramework(model?.engine || model?.architecture?.engine || '').frameworkKey;
    },
    isPaddleModel(model) {
      return this.modelFrameworkKey(model) === 'paddle';
    },
    openExportDialog(jobId) {
      const model = this.findProjectModel(jobId);
      if (this.isPaddleModel(model)) {
        this.$message.warning('Paddle 模型导出暂不支持。');
        return;
      }
      this.exportTargetJobId = jobId;
      this.exportForm = { ...this.exportForm, format: 'pt', weights: 'best' };
      this.exportDialogVisible = true;
    },
    async confirmExport() {
      const jobId = this.exportTargetJobId;
      if (!jobId) return;
      if (this.isPaddleModel(this.findProjectModel(jobId))) {
        this.$message.warning('Paddle 模型导出暂不支持。');
        return;
      }
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
        await DeleteTrainingJob(jobId, { force: false });
        this.$message.success('删除成功。');
        const pid = this.projectInfo?.project_id || this.$route.query.projectId;
        if (pid) this.loadProjectDetails(pid);
      } catch (e) {
        if (e === 'cancel' || e === 'close') return;
        if (this.isDeleteConflict(e)) {
          try {
            await this.$confirm('该训练任务有关联模型版本/部署，是否强制链式删除？', '确认强制删除', { type: 'warning', confirmButtonText: '强制删除', cancelButtonText: '取消' });
            await DeleteTrainingJob(jobId, { force: true });
            this.$message.success('删除成功。');
            const pid = this.projectInfo?.project_id || this.$route.query.projectId;
            if (pid) this.loadProjectDetails(pid);
          } catch (forceError) {
            if (forceError !== 'cancel' && forceError !== 'close') {
              this.$message.error('删除失败: ' + (forceError.message || forceError));
            }
          }
          return;
        }
        this.$message.error('删除失败: ' + (e.message || e));
      }
    },
    isJobSelected(jobId) {
      return this.selectedJobIds.includes(jobId);
    },
    updateJobSelection(jobId, checked) {
      if (checked) {
        if (!this.isJobSelected(jobId)) {
          this.selectedJobIds = [...this.selectedJobIds, jobId];
        }
        return;
      }
      this.selectedJobIds = this.selectedJobIds.filter(id => id !== jobId);
    },
    toggleJobSelection(jobId) {
      this.updateJobSelection(jobId, !this.isJobSelected(jobId));
    },
    //批量删除
    async batchDeleteConfirm() {
      if (this.selectedJobIds.length === 0) return;

      try {
        await this.$confirm(
          `确定要删除选中的 ${this.selectedJobIds.length} 个训练任务吗？此操作不可恢复。`,
          '批量删除确认',
          {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
      } catch {
        return; // 用户取消
      }

      this.batchDeleting = true;

      try {
        for (const jobId of this.selectedJobIds) {
          try {
            await DeleteTrainingJob(jobId, { force: false });
          } catch (err) {
            // 可以记录失败的，但不中断其他删除
            console.warn(`删除任务 ${jobId} 失败`, err);
            // 可选：收集失败的任务 id，最后提示
          }
        }

        this.$message.success(`已完成批量删除操作`);

        // 退出批量模式并刷新列表
        this.exitBatchMode();
        const pid = this.projectInfo?.project_id || this.$route.query.projectId;
        if (pid) await this.loadProjectDetails(pid);

      } catch (e) {
        this.$message.error('批量删除过程中发生错误');
        console.error(e);
      } finally {
        this.batchDeleting = false;
      }
    },
    // 切换全选状态
    toggleSelectAll() {
      const visible = new Set(this.filteredJobIds);
      if (this.isAllSelected) {
        this.selectedJobIds = this.selectedJobIds.filter(id => !visible.has(id));
      } else {
        this.selectedJobIds = Array.from(new Set([...this.selectedJobIds, ...this.filteredJobIds]));
      }
    },
    isDeleteConflict(error) {
      if (error && error.status === 409) return true;
      const msg = String((error && error.message) || '').toLowerCase();
      return msg.includes('cannot delete') || msg.includes('still reference');
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
        } catch (_) {
          return null;
        }
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
          } catch (e) {
            console.warn('Failed to parse currentProject from localStorage:', e);
          }
        }
      }
    },
    async loadProjectDetails(projectId) {
      if (!projectId) return;
      this.loading = true;
      try {
        const detail = await FetchProjectsDetail(projectId);
        this.projectInfo = detail;

        // Enhance dataset info - use multiple fallback sources
        try {
          // First, preserve any dataset info that might already be in the API response
          if (!this.projectInfo.dataset && this.projectInfo.dataset_name) {
            this.projectInfo.dataset = { dataset_name: this.projectInfo.dataset_name };
          }

          // Try to enhance with full dataset info from referenceStore
          await loadDatasets();
          const standardDatasetId = this.projectInfo.standard_dataset_id ?? this.projectInfo.dataset_id;
          const ds = referenceStore.datasets.find(d => d.dataset_id === standardDatasetId);
          if (ds) {
            this.projectInfo.dataset = {
              dataset_id: ds.dataset_id,
              dataset_name: ds.dataset_name
            };
          }
        } catch (e) {
          console.warn('Failed to enhance dataset info:', e);
          const standardDatasetId = this.projectInfo.standard_dataset_id ?? this.projectInfo.dataset_id;
          if (standardDatasetId && !this.projectInfo.dataset) {
            this.projectInfo.dataset = {
              dataset_id: standardDatasetId,
              dataset_name: `Standard Dataset #${standardDatasetId}`
            };
          }
        }

        if (Array.isArray(detail.training_jobs)) {
          this.projectModels = detail.training_jobs;
        } else {
          // Fallback
          const all = await fetchTrainingJobs();
          this.projectModels = all.filter(j => j.project_id == projectId);
        }
        const visibleJobIds = new Set(this.projectModels.map((job) => job.job_id));
        this.selectedJobIds = this.selectedJobIds.filter((id) => visibleJobIds.has(id));
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
      if (!dateStr) return '-';
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

.back-link:hover {
  background: #f3f4f6;
  color: var(--text-main);
}

.pd-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

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

.pd-stat-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.pd-stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-primary);
  margin-top: 0.25rem;
}

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

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.batch-entry-btn {
  flex-shrink: 0;
  border-radius: var(--radius-full) !important;
  padding: 8px 16px;
  font-weight: 600;
  color: #2b3a67;
  border-color: rgba(79, 99, 199, 0.24);
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.08), rgba(79, 99, 199, 0.03));
}

.batch-entry-btn:hover,
.batch-entry-btn:focus {
  color: #1f2d5c;
  border-color: rgba(79, 99, 199, 0.4);
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.14), rgba(79, 99, 199, 0.06));
}

.batch-tool {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  padding: 0.65rem 0.9rem;
  border-radius: 18px;
  border: 1px solid rgba(79, 99, 199, 0.16);
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.08), rgba(79, 99, 199, 0.02));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  flex-wrap: wrap;
}

.batch-tool__info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.batch-tool__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.8rem;
  border-radius: var(--radius-full);
  background: rgba(79, 99, 199, 0.12);
  color: #2b3a67;
  font-weight: 700;
}

.batch-tool__count {
  color: var(--text-main);
  font-weight: 700;
}

.batch-tool__hint {
  color: var(--text-secondary);
}

.batch-tool__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 1rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-full);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.search-input ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  padding: 0;
  height: auto;
}

.pd-summary {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

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

.state i {
  font-size: 2rem;
  opacity: 0.5;
}

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

.job-card.batch-mode {
  cursor: pointer;
}

.job-card.selected {
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.12), rgba(79, 99, 199, 0.04));
  border-color: rgba(79, 99, 199, 0.35);
  box-shadow: 0 14px 28px rgba(79, 99, 199, 0.14);
}

.job-card:hover {
  transform: translateY(-4px);
  background: #fff;
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-light);
}

.job-card.selected:hover {
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.16), rgba(79, 99, 199, 0.07));
}

.job-batch-check {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(79, 99, 199, 0.18);
  color: #2b3a67;
  font-size: 0.75rem;
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.job-batch-check__text {
  white-space: nowrap;
}

.job-status-indicator {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
}

.job-status-indicator.status-success {
  background: #10b981;
}

.job-status-indicator.status-running {
  background: #3b82f6;
}

.job-status-indicator.status-warning {
  background: #f59e0b;
}

.job-status-indicator.status-error {
  background: #ef4444;
}

.job-status-indicator.status-pending {
  background: #cbd5e1;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.job-title {
  font-weight: 700;
  color: var(--text-main);
  font-size: 1rem;
}

.job-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.job-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.meta-item .label {
  color: var(--text-secondary);
  font-size: 0.7rem;
}

.meta-item .value {
  color: var(--text-main);
  font-weight: 500;
}

.status-text.status-success {
  color: #059669;
}

.status-text.status-running {
  color: #2563eb;
}

.status-text.status-error {
  color: #dc2626;
}

.job-actions {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 0.75rem;
}

.job-actions.batch-mode {
  justify-content: flex-end;
}

.job-action-group {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.more-btn {
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.more-btn:hover {
  color: var(--text-main);
}

.danger-text {
  color: #ef4444;
}

.action-btn {
  font-weight: 600;
}

.create-framework-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 4px 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.create-framework-selector__label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 768px) {
  .pd-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .toolbar-right {
    gap: 0.75rem;
  }

  .batch-tool {
    width: 100%;
  }

  .batch-tool__info,
  .batch-tool__actions {
    width: 100%;
  }

  .job-grid {
    grid-template-columns: 1fr;
  }
}
</style>
