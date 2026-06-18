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

    <section class="pd-body glass-panel" @click="handleBatchBlankClick">
      <header class="pd-toolbar" @click.stop>
        <div class="toolbar-right">
          <div class="search-shell">
            <i class="el-icon-search"></i>
            <el-input v-model="searchQuery" placeholder="搜索训练任务" class="search-input" clearable></el-input>
          </div>
          <div class="batch-toolbar">
            <template v-if="isBatchMode">
              <button type="button" class="batch-icon-btn" :class="{ 'is-active': isAllSelected }"
                :disabled="filteredModels.length === 0 || batchDeleting" :title="isAllSelected ? '取消全选' : '全选'"
                @click="toggleSelectAll">
                <img :src="isAllSelected ? selectAllOnIcon : selectAllOffIcon" :alt="isAllSelected ? '取消全选' : '全选'"
                  class="batch-icon-btn__image">
              </button>
              <button type="button" class="batch-icon-btn batch-icon-btn--danger"
                :disabled="selectedJobIds.length === 0 || batchDeleting" title="删除所选" @click="batchDeleteConfirm">
                <i :class="batchDeleting ? 'el-icon-loading' : 'el-icon-delete'"></i>
              </button>
            </template>
            <button type="button" class="batch-icon-btn" :class="{ 'is-active': isBatchMode }"
              :disabled="(!isBatchMode && filteredModels.length === 0) || batchDeleting"
              :title="isBatchMode ? '退出批量操作' : '批量操作'" @click="toggleBatchMode">
              <img :src="multiselectIcon" :alt="isBatchMode ? '退出批量操作' : '批量操作'" class="batch-icon-btn__image">
            </button>
          </div>
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
          <div v-for="model in filteredModels" :key="model.job_id"
            :class="['job-card', { 'batch-mode': isBatchMode, selected: isJobSelected(model.job_id) }]"
            @click.stop="handleJobCardClick(model)">
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
              <div v-if="isBatchMode">
                <el-checkbox :value="isJobSelected(model.job_id)"
                  @change="updateJobSelection(model.job_id, $event)"></el-checkbox>
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
                    <el-dropdown-item command="export" :disabled="isPaddleModel(model)">
                      <span class="pd-menu-item">
                        <i class="el-icon-download"></i>
                        <span>导出<span v-if="isPaddleModel(model)">（Paddle 暂不支持）</span></span>
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="model.status === 'completed'" command="report">
                      <span class="pd-menu-item">
                        <i class="el-icon-document"></i>
                        <span>查看报告</span>
                      </span>
                    </el-dropdown-item>
                    <el-dropdown-item command="delete" class="danger-text">
                      <span class="pd-menu-item">
                        <i class="el-icon-delete"></i>
                        <span>删除</span>
                      </span>
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
    <el-dialog :title="`创建 ${createFrameworkMeta.label} 训练任务`" :visible.sync="dialogVisible" :width="dialogWidth"
      :close-on-click-modal="true" append-to-body custom-class="glass-dialog" :top="'5vh'">
      <div class="create-framework-selector">
        <!-- <span class="create-framework-selector__label">训练框架</span> -->
        <div class="create-framework-switch">
          <el-switch v-model="createFramework" :active-value="'paddle'" :inactive-value="'pytorch'"
            class="create-framework-switch__control" />
          <div class="create-framework-switch__labels" aria-hidden="true">
            <span class="create-framework-switch__label" :class="{ 'is-active': createFramework === 'pytorch' }">
              PyTorch (YOLO)
            </span>
            <span class="create-framework-switch__label" :class="{ 'is-active': createFramework === 'paddle' }">
              Paddle
            </span>
          </div>
        </div>
      </div>
      <ModelsStep2 :key="createEngine" :project="projectInfo" :engine="createEngine"
        :framework-label="createFrameworkMeta.label" @task-added="onTaskAdded" @close="dialogVisible = false" />
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
        <el-checkbox v-model="exportForm.include_report" :disabled="exporting" class="export-report-checkbox">
          连同训练报告一同导出
        </el-checkbox>
        <el-button @click="exportDialogVisible = false" :disabled="exporting">取消</el-button>
        <el-button type="primary" @click="confirmExport" :loading="exporting">导出</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { FetchProjectsDetail } from '@/api/projects';
import { fetchStandardDataset } from '@/api/standardDatasets';
import {
  fetchTrainingJobs,
  startTrainingJob,
  DeleteTrainingJob,
  FetchTrainingJobsStatus,
  ExportModel,
  CancelTrainingJob,
  ResumeTrainingJob,
  markTrainingRunReviewed
} from '@/api/training';
import { API_BASE } from '@/utils/request';
import ModelsStep2 from '@/views/Models/CreateModel/Step2.vue';
import { resolveFramework } from '@/utils/trainingFramework';
import { markProjectTrainingAlertsDirty } from '@/utils/projectTrainingAlerts';
import multiselectIcon from '@/assets/icon/Multiselect.svg';
import selectAllOffIcon from '@/assets/icon/Select All Off.svg';
import selectAllOnIcon from '@/assets/icon/Select All.svg';

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
        include_report: false,
      },
      multiselectIcon,
      selectAllOffIcon,
      selectAllOnIcon,
      createFramework: 'pytorch',
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
      return CREATE_FRAMEWORK_TABS.find(item => item.key === this.createFramework) || CREATE_FRAMEWORK_TABS[0];
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
      markProjectTrainingAlertsDirty('project-detail-back');
      this.$router.push({ path: '/projects' });
    },
    openCreateJob() {
      if (this._resizeHandler) this._resizeHandler();
      this.dialogVisible = true;
    },
    toggleBatchMode() {
      if (this.batchDeleting) return;
      if (this.isBatchMode) {
        this.exitBatchMode();
        return;
      }
      if (this.filteredModels.length === 0) return;
      this.isBatchMode = true;
    },
    exitBatchMode() {
      this.isBatchMode = false;
      this.selectedJobIds = [];
    },
    handleBatchBlankClick() {
      if (!this.isBatchMode || this.batchDeleting) return;
      this.exitBatchMode();
    },
    handleJobCardClick(model) {
      if (this.isBatchMode) {
        this.toggleJobSelection(model.job_id);
        return;
      }
      this.goProjectsCharts(model);
    },
    onTaskAdded() {
      markProjectTrainingAlertsDirty('training-task-added');
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
        markProjectTrainingAlertsDirty('training-task-started');
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
        markProjectTrainingAlertsDirty('training-task-stopped');
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
        markProjectTrainingAlertsDirty('training-task-resumed');
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
      if (command === 'report') this.openTrainingReport(jobId);
      if (command === 'delete') this.deletePDJob(jobId);
      if (command === 'export') this.openExportDialog(jobId);
      if (command === 'setbaseline') this.$message.info('设为基准功能待实现');
    },
    async markCompletedRunReviewed(jobId, source) {
      const model = this.findProjectModel(jobId);
      if (!model || String(model.status || '').toLowerCase() !== 'completed') return;
      try {
        await markTrainingRunReviewed(jobId, source);
        markProjectTrainingAlertsDirty('training-run-reviewed');
      } catch (e) {
        console.warn('Failed to mark training run reviewed:', e);
      }
    },
    async openTrainingReport(jobId) {
      if (!jobId) return;
      await this.markCompletedRunReviewed(jobId, 'training-report');
      markProjectTrainingAlertsDirty('open-training-report');
      this.$router.push({ path: '/training-report', query: { runId: jobId } });
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
      this.exportForm = { ...this.exportForm, format: 'pt', weights: 'best', include_report: false };
      this.exportDialogVisible = true;
    },
    exportFilename(res, fallbackJobId) {
      if (this.exportForm.include_report) {
        const returnedName = res?.artifact?.name || res?.output_filename || res?.filename;
        if (returnedName && String(returnedName).toLowerCase().endsWith('.zip')) return String(returnedName);
        const format = String(res?.format || this.exportForm.format || 'pt').toLowerCase();
        const weights = String(res?.weights || this.exportForm.weights || 'best').toLowerCase();
        return `${fallbackJobId || 'model'}_${weights}_${format}_with_report.zip`;
      }
      const artifactName = res?.artifact?.name || res?.output_filename || res?.filename;
      if (artifactName) return String(artifactName);
      const format = String(res?.format || this.exportForm.format || 'pt').toLowerCase();
      const weights = String(res?.weights || this.exportForm.weights || 'best').toLowerCase();
      return `${fallbackJobId || 'model'}_${weights}.${format}`;
    },
    filenameFromDisposition(disposition) {
      const text = String(disposition || '');
      const utf8Match = text.match(/filename\*=UTF-8''([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          return decodeURIComponent(utf8Match[1]);
        } catch (_) {
          return utf8Match[1];
        }
      }
      const asciiMatch = text.match(/filename="?([^";]+)"?/i);
      return asciiMatch && asciiMatch[1] ? asciiMatch[1] : '';
    },
    async downloadExportFile(rawUrl, filename) {
      const raw = String(rawUrl || '').trim();
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      const href = raw.startsWith('http') ? raw : `${API_BASE}${path}`;
      const response = await fetch(href);
      if (!response.ok) {
        throw new Error(`下载文件失败: HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (!blob || blob.size <= 0) {
        throw new Error('下载文件为空，请检查后端静态文件目录是否可访问');
      }
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = this.filenameFromDisposition(response.headers.get('Content-Disposition')) || filename || '';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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

        await this.downloadExportFile(raw, this.exportFilename(res, jobId));
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
        markProjectTrainingAlertsDirty('training-task-deleted');
        this.$message.success('删除成功。');
        const pid = this.projectInfo?.project_id || this.$route.query.projectId;
        if (pid) this.loadProjectDetails(pid);
      } catch (e) {
        if (e === 'cancel' || e === 'close') return;
        if (this.isDeleteConflict(e)) {
          try {
            await this.$confirm('该训练任务有关联模型版本/部署，是否强制链式删除？', '确认强制删除', { type: 'warning', confirmButtonText: '强制删除', cancelButtonText: '取消' });
            await DeleteTrainingJob(jobId, { force: true });
            markProjectTrainingAlertsDirty('training-task-force-deleted');
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
            markProjectTrainingAlertsDirty('training-task-batch-deleted');
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
      if (!this.isBatchMode || this.filteredJobIds.length === 0) return;
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
    async goProjectsCharts(model) {
      if (String(model?.status || '').toLowerCase() === 'completed') {
        await this.markCompletedRunReviewed(model.job_id, 'training-manager');
      }
      markProjectTrainingAlertsDirty('open-training-manager');
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
            if (s.status) {
              const previousStatus = String(job.status || '').toLowerCase();
              this.$set(job, 'status', s.status);
              const nextStatus = String(s.status || '').toLowerCase();
              if (nextStatus !== previousStatus && ['queued', 'running', 'completed'].includes(nextStatus)) {
                markProjectTrainingAlertsDirty(`project-detail-status-${nextStatus}`);
              }
            }
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

        // Enhance dataset info without loading the full standard dataset list.
        try {
          const standardDatasetId = this.projectInfo.standard_dataset_id ?? this.projectInfo.dataset_id;
          if (!this.projectInfo.dataset && this.projectInfo.dataset_name) {
            this.projectInfo.dataset = {
              dataset_id: standardDatasetId,
              dataset_name: this.projectInfo.dataset_name,
              dataset_type: this.projectInfo.dataset_type,
            };
          }

          if (standardDatasetId && (!this.projectInfo.dataset || !this.projectInfo.dataset.dataset_name)) {
            const ds = await fetchStandardDataset(standardDatasetId);
            this.projectInfo.dataset = {
              dataset_id: ds.standard_dataset_id ?? standardDatasetId,
              dataset_name: ds.name || ds.dataset_name || `Standard Dataset #${standardDatasetId}`,
              dataset_type: ds.dataset_type || this.projectInfo.dataset?.dataset_type,
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
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.batch-toolbar {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 36px;
}

.batch-icon-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(79, 99, 199, 0.18);
  border-radius: 12px;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
}

.batch-icon-btn:hover:not(:disabled),
.batch-icon-btn:focus-visible:not(:disabled) {
  border-color: rgba(79, 99, 199, 0.3);
  background: rgba(79, 99, 199, 0.06);
  box-shadow: 0 10px 22px rgba(79, 99, 199, 0.12);
  transform: translateY(-1px);
  outline: none;
}

.batch-icon-btn.is-active {
  border-color: rgba(79, 99, 199, 0.34);
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.18), rgba(79, 99, 199, 0.08));
  box-shadow: 0 10px 24px rgba(79, 99, 199, 0.16);
}

.batch-icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}

.batch-icon-btn__image {
  width: 18px;
  height: 18px;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.batch-icon-btn i {
  font-size: 18px;
}

.batch-icon-btn--danger {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.18);
}

.batch-icon-btn--danger:hover:not(:disabled),
.batch-icon-btn--danger:focus-visible:not(:disabled) {
  border-color: rgba(220, 38, 38, 0.3);
  background: rgba(220, 38, 38, 0.06);
  box-shadow: 0 10px 22px rgba(220, 38, 38, 0.12);
}

.search-shell {
  display: flex;
  flex: 0 0 320px;
  width: 320px;
  max-width: 100%;
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

.pd-menu-item {
  min-width: 92px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
}

.pd-menu-item i {
  width: 16px;
  text-align: center;
  font-size: 14px;
  flex: 0 0 16px;
}

.action-btn {
  font-weight: 600;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.export-report-checkbox {
  margin-right: auto;
}

.create-framework-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.create-framework-selector__label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.create-framework-switch {
  position: relative;
  width: 280px;
  max-width: 100%;
}

.create-framework-switch__labels {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  padding: 0 1px;
}

.create-framework-switch__label {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 8px;
  color: #6b7280;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition: color 0.2s ease;
  z-index: 1;
}

.create-framework-switch__label.is-active {
  color: #ffffff;
}

.create-framework-switch ::v-deep .el-switch {
  display: block;
  width: 100%;
  height: 40px;
}

.create-framework-switch ::v-deep .el-switch__core {
  width: 100% !important;
  height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 15px;
  background: #f3f4f6;
  box-sizing: border-box;
}

.create-framework-switch ::v-deep .el-switch__core::after {
  top: 1px;
  left: 1px;
  width: calc(50% - 2px);
  height: calc(100% - 2px);
  border-radius: 15px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
}

.create-framework-switch ::v-deep .el-switch.is-checked .el-switch__core {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.create-framework-switch ::v-deep .el-switch.is-checked .el-switch__core::after {
  left: calc(50% + 1px);
  margin-left: 0;
}

@media (max-width: 768px) {
  .pd-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .toolbar-right {
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .search-shell {
    width: 100%;
  }

  .batch-toolbar {
    min-width: 36px;
  }

  .job-grid {
    grid-template-columns: 1fr;
  }

  .create-framework-switch {
    width: 100%;
  }
}
</style>
