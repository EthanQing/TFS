<template>
  <div class="dataset-detail-page page-container">
    <header class="detail-hero">
      <div class="hero-left">
        <button class="back-link" type="button" @click="goBack">
          <i class="el-icon-arrow-left"></i> 返回数据集列表
        </button>
        <div class="hero-content">
          <div class="hero-kicker">数据集概览</div>
          <h1 class="hero-title">{{ datasetName || '未命名数据集' }}</h1>
          <div class="hero-meta">
            <span class="meta-pill info">{{ datasetTypeLabel }}</span>
            <span class="meta-pill warning">原始数据集</span>
            <span v-if="activeVersion" class="meta-pill success">当前版本 v{{ activeVersion.version }}</span>
            <span class="meta-id">ID: {{ datasetId || '-' }}</span>
          </div>
        </div>
      </div>
      <div class="hero-right">
        <div class="stat-card">
          <div class="stat-label">图片数</div>
          <div class="stat-value">{{ formatNumber(totalImages) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">类别数</div>
          <div class="stat-value">{{ formatNumber(classCount) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">大小</div>
          <div class="stat-value">{{ datasetSizeText }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">版本数</div>
          <div class="stat-value">{{ formatNumber(versions.length) }}</div>
        </div>
      </div>
    </header>

    <section class="detail-body glass-panel">
      <div v-if="loading" class="loading-state">
        <i class="el-icon-loading"></i>
        <span>正在加载原始数据集详情...</span>
      </div>

      <template v-else>
        <div class="illegal-section">
          <div class="illegal-actions">
            <el-button @click="refreshAll">刷新</el-button>
            <el-button type="primary" plain @click="uploadDialogVisible = true">首次上传 ZIP</el-button>
            <el-button type="primary" @click="appendDialogVisible = true">追加上传新版本</el-button>
            <el-button type="success" plain @click="openMountedImport('upload')">从挂载目录导入</el-button>
            <el-button type="success" @click="openMountedImport('append')">从挂载目录追加版本</el-button>
          </div>

          <template v-if="!isEmpty">
            <div class="preset-toolbar">
              <div class="preset-toolbar-left">
                <el-select v-model="presetApplyMode" size="small" class="preset-mode-select">
                  <el-option v-for="opt in presetApplyOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
                <el-button size="small" :loading="mappingPresetsLoading" @click="applyPresetToCurrentMapping">
                  应用预设到当前映射
                </el-button>
                <el-button size="small" type="primary" plain @click="openPresetDialog">
                  预设映射表管理
                </el-button>
              </div>
              <div class="preset-toolbar-right">
                <span>检测: {{ presetDetectionCount }}</span>
                <span>分类: {{ presetClassificationCount }}</span>
                <span>更新时间: {{ presetUpdatedAtText }}</span>
              </div>
            </div>

            <div v-if="mappingPanelLabels.length" class="mapping-panel-wrap legacy-mapping-wrap">
              <LabelMappingPanel ref="labelMappingPanel" :labels="mappingPanelLabels"
                :saved-mapping="savedLabelMappingObject" :loading="loadingMappings"
                :saving="savingMappings" :converting="publishing" @save="handlePanelSave"
                @save-and-convert="handleSaveAndConvert" />
            </div>
            <div v-else class="panel-empty">
              <i class="el-icon-document-remove"></i>
              <span>当前版本尚未识别到可映射的原始标签，请先上传并确认数据内容。</span>
            </div>

            <div v-if="publishJobVisible" class="publish-progress-panel" :class="`status-${publishJobStatus}`">
              <div class="publish-progress-head">
                <div class="publish-progress-title-wrap">
                  <div class="publish-progress-title">转换进度</div>
                  <div class="publish-progress-sub">
                    <span>{{ publishPhaseLabel(publishJobPhase, publishJobStatus) }}</span>
                    <span v-if="publishJobId">任务 {{ shortPublishJobId }}</span>
                  </div>
                </div>
                <el-tag size="small" :type="publishStatusTagType">{{ publishStatusLabel(publishJobStatus) }}</el-tag>
              </div>
              <el-progress
                :percentage="publishJobPercent"
                :status="publishProgressBarStatus"
                :stroke-width="12"
              />
              <div class="publish-progress-meta">
                <span v-if="publishJobProcessedText">{{ publishJobProcessedText }}</span>
                <span v-if="publishJobUpdatedAtText">更新于 {{ publishJobUpdatedAtText }}</span>
              </div>
              <div v-if="publishJobError" class="publish-progress-error">
                {{ publishJobError }}
              </div>
              <div v-if="publishJobLogs.length" class="publish-progress-logs">
                <div
                  v-for="(item, index) in publishJobLogs"
                  :key="`${index}-${item}`"
                  class="publish-progress-log"
                >
                  {{ item }}
                </div>
              </div>
            </div>
          </template>
        </div>

        <div v-if="isEmpty" class="empty-state">
          <div class="empty-content">
            <div class="empty-title">当前原始数据集还是空的</div>
            <div class="empty-desc">
              请先上传原始 ZIP 数据。上传后即可继续使用旧版标签映射界面配置映射，并转换为新的标准数据集。
            </div>
            <div class="empty-tips">
              <span class="tip-item"><i class="el-icon-check"></i> 原始数据集会保留原始数据</span>
              <span class="tip-item"><i class="el-icon-check"></i> 每次上传都会形成独立版本</span>
              <span class="tip-item"><i class="el-icon-check"></i> 可反复转换多个标准数据集</span>
            </div>
          </div>
          <div class="empty-action">
            <UploadZip :dataset-id="datasetId" dataset-kind="illegal" mode="upload" :external-file.sync="uploadFile"
              :external-uploading.sync="uploading" :external-progress.sync="uploadProgress"
              @upload-success="handleUploadSuccess" @upload-fail="handleUploadFail"
              @upload-cancel="handleUploadCancel" />
          </div>
        </div>

        <div v-else class="illegal-layout">
          <div class="main-column">
            <section class="section-card">
              <div class="section-head">
                <div>
                  <div class="section-title">数据内容</div>
                  <div class="section-sub">保留当前原始数据集预览、文件与事件记录</div>
                </div>
                <el-select v-model="previewClassId" size="small" clearable placeholder="全部类别" @change="loadPreview">
                  <el-option v-for="item in previewCategories" :key="item.class_id"
                    :label="`${item.name} (${item.count})`" :value="item.class_id" />
                </el-select>
              </div>

              <el-tabs v-model="activeTab">
                <el-tab-pane label="样本预览" name="preview">
                  <div v-loading="loadingPreview" style="max-height: 400px; overflow-y: auto;">
                    <div v-if="!previewItems.length" class="panel-empty">当前版本暂无可预览的图片。</div>
                    <div v-else class="image-grid">
                      <div v-for="item in previewItems" :key="item.id" class="image-card">
                        <el-image :src="item.thumbnail_url || item.image_url" :preview-src-list="previewUrls"
                          fit="cover" class="preview-image" />
                        <div class="image-meta">
                          <div class="image-name">{{ item.image_name }}</div>
                          <div class="image-desc">{{ item.objects_count }} 个标注对象</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </el-tab-pane>
                <el-tab-pane label="文件列表" name="files">
                  <el-table :data="files" size="small" border empty-text="暂无文件"
                    style="max-height: 400px; overflow-y: auto;">
                    <el-table-column prop="path" label="路径" min-width="360" show-overflow-tooltip />
                    <el-table-column label="大小" width="140">
                      <template slot-scope="scope">{{ formatBytes(scope.row.size_bytes) }}</template>
                    </el-table-column>
                    <el-table-column label="修改时间" width="180">
                      <template slot-scope="scope">{{ formatTime(scope.row.mtime) }}</template>
                    </el-table-column>
                    <el-table-column label="下载" width="100" align="center">
                      <template slot-scope="scope">
                        <el-link v-if="scope.row.url" :href="scope.row.url" target="_blank" type="primary">打开</el-link>
                        <span v-else>-</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-tab-pane>
                <el-tab-pane label="事件记录" name="events">
                  <el-table :data="events" size="small" border empty-text="暂无事件"
                    style="max-height: 400px; overflow-y: auto;">
                    <el-table-column prop="event_type" label="事件类型" width="180" />
                    <el-table-column prop="message" label="消息" min-width="280" show-overflow-tooltip />
                    <el-table-column label="时间" width="180">
                      <template slot-scope="scope">{{ formatDate(scope.row.created_at) }}</template>
                    </el-table-column>
                  </el-table>
                </el-tab-pane>
              </el-tabs>
            </section>
          </div>

          <aside class="side-column">
            <section class="section-card">
              <div class="section-head">
                <div class="section-title">版本列表</div>
              </div>
              <el-select class="version-select" v-model="selectedVersionId" size="small" placeholder="请选择要激活的版本"
                @change="activateVersion">
                <el-option v-for="item in versions" :key="item.version_id"
                  :label="`v${item.version} (${item.message || '无说明'})`" :value="item.version_id" />
              </el-select>
            </section>

            <section class="section-card">
              <div class="section-head">
                <div class="section-title">基础信息</div>
              </div>
              <div class="info-list">
                <div class="info-item"><span>ID</span><strong>{{ datasetId }}</strong></div>
                <div class="info-item"><span>当前工作目录</span><strong>{{ dataset && dataset.storage_path ?
                  dataset.storage_path : '-'
                    }}</strong></div>
                <div class="info-item"><span>创建时间</span><strong>{{ formatDate(dataset && dataset.created_at) }}</strong>
                </div>
                <div class="info-item"><span>更新时间</span><strong>{{ formatDate(dataset && dataset.updated_at) }}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </template>
    </section>

    <el-dialog title="非法标签映射预设管理" :visible.sync="showPresetDialog" width="980px" :append-to-body="true"
      class="preset-dialog">
      <div class="preset-dialog-toolbar">
        <div class="preset-dialog-stats">
          <span>检测映射 {{ presetDetectionCount }} 条</span>
          <span>分类映射 {{ presetClassificationCount }} 条</span>
          <span>更新时间 {{ presetUpdatedAtText }}</span>
        </div>
        <div class="preset-dialog-actions">
          <input ref="presetFileInput" type="file" accept=".xlsx,.xls" style="display: none;"
            @change="handlePresetFileChange" />
          <el-button size="small" @click="triggerPresetFileUpload">导入 XLSX</el-button>
          <el-button size="small" @click="addDetectionPresetRow">新增检测行</el-button>
          <el-button size="small" @click="addClassificationPresetRow">新增分类行</el-button>
        </div>
      </div>

      <el-tabs>
        <el-tab-pane :label="`检测映射 (${presetDetectionCount})`">
          <el-table :data="presetData.detection" border height="280" size="mini">
            <el-table-column label="原始标签路径" min-width="280">
              <template slot-scope="scope">
                <el-input v-model="scope.row.source_label" size="mini" placeholder="例如：A%B%C" />
              </template>
            </el-table-column>
            <el-table-column label="映射标签" min-width="160">
              <template slot-scope="scope">
                <el-input v-model="scope.row.target_label" size="mini" placeholder="例如：轿车"
                  :disabled="scope.row.status === 'delete'" />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template slot-scope="scope">
                <el-select v-model="scope.row.status" size="mini">
                  <el-option label="保留" value="keep" />
                  <el-option label="删除" value="delete" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template slot-scope="scope">
                <el-button type="text" size="mini" @click="removeDetectionPresetRow(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`分类映射 (${presetClassificationCount})`">
          <el-table :data="presetData.classification" border height="280" size="mini">
            <el-table-column label="分类组" min-width="140">
              <template slot-scope="scope">
                <el-input v-model="scope.row.category" size="mini" placeholder="例如：小型车辆" />
              </template>
            </el-table-column>
            <el-table-column label="原始标签路径" min-width="240">
              <template slot-scope="scope">
                <el-input v-model="scope.row.source_label" size="mini" placeholder="例如：A%B%C" />
              </template>
            </el-table-column>
            <el-table-column label="映射标签(可选)" min-width="140">
              <template slot-scope="scope">
                <el-input v-model="scope.row.target_label" size="mini" placeholder="默认同分类组"
                  :disabled="scope.row.status === 'delete'" />
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template slot-scope="scope">
                <el-select v-model="scope.row.status" size="mini">
                  <el-option label="保留" value="keep" />
                  <el-option label="删除" value="delete" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template slot-scope="scope">
                <el-button type="text" size="mini" @click="removeClassificationPresetRow(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <div slot="footer" class="dialog-footer">
        <el-button :disabled="mappingPresetsSaving" @click="showPresetDialog = false">关闭</el-button>
        <el-button type="primary" :loading="mappingPresetsSaving" @click="savePresetDialogData">保存预设</el-button>
      </div>
    </el-dialog>

    <el-dialog title="首次上传 ZIP" :visible.sync="uploadDialogVisible" width="680px" append-to-body>
      <UploadZip :dataset-id="datasetId" dataset-kind="illegal" mode="upload" :external-file.sync="uploadFile"
        :external-uploading.sync="uploading" :external-progress.sync="uploadProgress"
        @upload-success="handleUploadSuccess" @upload-fail="handleUploadFail"
        @upload-cancel="handleUploadCancel" />
    </el-dialog>

    <el-dialog title="追加上传新版本" :visible.sync="appendDialogVisible" width="680px" append-to-body>
      <UploadZip :dataset-id="datasetId" dataset-kind="illegal" mode="append" :external-file.sync="appendFile"
        :external-uploading.sync="appending" :external-progress.sync="appendProgress"
        @upload-success="handleAppendSuccess" @upload-fail="handleUploadFail"
        @upload-cancel="handleUploadCancel" />
    </el-dialog>
    <MountedImportDialog
      :visible.sync="mountedImportVisible"
      :dataset-id="datasetId"
      dataset-kind="illegal"
      :mode="mountedImportMode"
      @imported="handleMountedImportSuccess"
    />
  </div>
</template>

<script>
import UploadZip from '@/components/Upload/index.vue';
import LabelMappingPanel from '@/components/LabelMappingPanel.vue';
import MountedImportDialog from '@/views/Datasets/components/MountedImportDialog.vue';
import {
  fetchIllegalDatasetDetail,
  fetchIllegalDatasetFiles,
  fetchIllegalDatasetView,
  fetchIllegalDatasetRawLabels,
  fetchIllegalDatasetLabelMappings,
  updateIllegalDatasetLabelMappings,
  activateIllegalDatasetVersion,
  createIllegalDatasetPublishJob,
  fetchIllegalDatasetPublishJob,
} from '@/api/illegalDatasets';

export default {
  name: 'IllegalDatasetDetail',
  components: { UploadZip, LabelMappingPanel, MountedImportDialog },
  data() {
    return {
      datasetId: this.$route.query.id || '',
      loading: false,
      loadingMappings: false,
      loadingPreview: false,
      savingMappings: false,
      publishing: false,
      activeTab: 'preview',
      detail: null,
      files: [],
      preview: { categories: [], items: [], meta: {} },
      previewClassId: null,
      rawLabels: [],
      mappingRows: [],
      mappingPresetsLoading: false,
      mappingPresetsSaving: false,
      showPresetDialog: false,
      presetApplyMode: 'detection',
      presetData: {
        detection: [],
        classification: [],
        updated_at: null,
      },
      publishForm: {
        version_id: null,
        slice_size: 1280,
        slice_overlap: 0.2,
        slice_padding: 64,
        slice_min_area_ratio: 0.3,
        slice_min_visibility: 0.15,
        slice_min_pixel_size: 5,
        slice_negative_ratio: 0.1,
        slice_empty_positive_action: 'discard',
      },
      uploadDialogVisible: false,
      appendDialogVisible: false,
      uploadFile: null,
      uploading: false,
      uploadProgress: 0,
      appendFile: null,
      appending: false,
      appendProgress: 0,
      mountedImportVisible: false,
      mountedImportMode: 'upload',
      selectedVersionId: null, // 用于版本选择器
      publishJobId: '',
      publishJobPhase: '',
      publishJobProgress: 0,
      publishJobStatus: '',
      publishJobProcessed: 0,
      publishJobTotal: 0,
      publishJobLogs: [],
      publishJobError: '',
      publishJobUpdatedAt: '',
      publishJobPollToken: 0,
    };
  },
  computed: {
    dataset() {
      return this.detail && this.detail.dataset ? this.detail.dataset : null;
    },
    statistics() {
      return this.detail && this.detail.statistics ? this.detail.statistics : null;
    },
    activeVersion() {
      return this.detail && this.detail.active_version ? this.detail.active_version : null;
    },
    versions() {
      return Array.isArray(this.detail && this.detail.versions) ? this.detail.versions : [];
    },
    versionMap() {
      return Object.fromEntries(this.versions.map(item => [item.version_id, item]));
    },
    events() {
      return Array.isArray(this.detail && this.detail.events) ? this.detail.events : [];
    },
    activeVersionId() {
      return this.activeVersion && this.activeVersion.version_id ? Number(this.activeVersion.version_id) : null;
    },
    datasetName() {
      return (this.dataset && (this.dataset.name || this.dataset.dataset_name)) || '原始数据集';
    },
    datasetTypeLabel() {
      return this.typeLabel(this.dataset && this.dataset.dataset_type);
    },
    datasetTypeValue() {
      return String(this.dataset && this.dataset.dataset_type || '').trim().toLowerCase();
    },
    isDetectionDataset() {
      return this.datasetTypeValue === 'detection';
    },
    totalImages() {
      return Number(this.statistics && this.statistics.total_images) || 0;
    },
    classCount() {
      const previewCount = Array.isArray(this.preview && this.preview.categories) ? this.preview.categories.length : 0;
      if (previewCount > 0) return previewCount;
      return this.publishTargetLabels.length;
    },
    datasetSizeText() {
      const mb = Number(this.statistics && this.statistics.total_size_mb);
      if (Number.isFinite(mb) && mb > 0) return `${mb.toFixed(2)} MB`;
      return '0 MB';
    },
    isEmpty() {
      return !this.activeVersion || this.totalImages <= 0;
    },
    previewItems() {
      return Array.isArray(this.preview && this.preview.items) ? this.preview.items : [];
    },
    previewCategories() {
      return Array.isArray(this.preview && this.preview.categories) ? this.preview.categories : [];
    },
    previewUrls() {
      return this.previewItems.map((item) => item.image_url).filter(Boolean);
    },
    mappingPanelLabels() {
      const values = new Set();
      (Array.isArray(this.rawLabels) ? this.rawLabels : []).forEach((label) => {
        const value = String(label || '').trim();
        if (value) values.add(value);
      });
      (Array.isArray(this.mappingRows) ? this.mappingRows : []).forEach((row) => {
        const value = String(row && row.raw_label || '').trim();
        if (value) values.add(value);
      });
      return Array.from(values).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    },
    publishTargetLabels() {
      const values = (Array.isArray(this.mappingRows) ? this.mappingRows : [])
        .filter((row) => {
          const status = this.normalizeMappingStatus(row && row.status, row && row.mapped_label);
          return status !== 'delete';
        })
        .map((row) => String(row && row.mapped_label || '').trim())
        .filter((value) => value && value !== '__DISCARD__');
      return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    },
    savedLabelMappingObject() {
      return this.buildMappingObjectFromRows(this.mappingRows);
    },
    presetApplyOptions() {
      return [
        { value: 'detection', label: '检测映射预设' },
        { value: 'classification', label: '分类映射预设' },
      ];
    },
    presetDetectionCount() {
      return Array.isArray(this.presetData && this.presetData.detection) ? this.presetData.detection.length : 0;
    },
    presetClassificationCount() {
      return Array.isArray(this.presetData && this.presetData.classification) ? this.presetData.classification.length : 0;
    },
    presetUpdatedAtText() {
      const raw = this.presetData && this.presetData.updated_at;
      if (!raw) return '未保存';
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return String(raw);
      return date.toLocaleString();
    },
    publishJobVisible() {
      return Boolean(this.publishJobId || this.publishJobStatus || this.publishing);
    },
    publishJobPercent() {
      const value = Number(this.publishJobProgress);
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.min(100, Math.round(value)));
    },
    publishStatusTagType() {
      const status = String(this.publishJobStatus || '').toLowerCase();
      if (status === 'completed') return 'success';
      if (status === 'failed') return 'danger';
      if (status === 'cancelled') return 'info';
      return 'warning';
    },
    publishProgressBarStatus() {
      const status = String(this.publishJobStatus || '').toLowerCase();
      if (status === 'completed') return 'success';
      if (status === 'failed') return 'exception';
      return undefined;
    },
    shortPublishJobId() {
      const raw = String(this.publishJobId || '');
      if (raw.length <= 12) return raw;
      return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
    },
    publishJobProcessedText() {
      const total = Number(this.publishJobTotal) || 0;
      const processed = Number(this.publishJobProcessed) || 0;
      if (total > 0) return `已处理 ${processed}/${total} 个样本`;
      if (processed > 0) return `已处理 ${processed} 个样本`;
      return '';
    },
    publishJobUpdatedAtText() {
      if (!this.publishJobUpdatedAt) return '';
      const date = new Date(this.publishJobUpdatedAt);
      if (Number.isNaN(date.getTime())) return String(this.publishJobUpdatedAt);
      return date.toLocaleTimeString();
    },
  },
  watch: {
    '$route.query.id'(nextId) {
      if (!nextId || String(nextId) === String(this.datasetId)) return;
      this.datasetId = nextId;
      this.previewClassId = null;
      this.loadAll();
    },
    // 监听 activeVersionId 变化，同步到 selectedVersionId
    activeVersionId: {
      handler(newVal) {
        if (this.selectedVersionId !== newVal) {
          this.selectedVersionId = newVal;
        }
      },
      immediate: true,
    },
  },
  mounted() {
    this.loadIllegalLabelPresets({ silent: true });
    this.loadAll();
  },
  beforeDestroy() {
    this.stopPublishJobPolling();
  },
  methods: {
    goBack() {
      this.$router.push('/datasets');
    },
    typeLabel(value) {
      const map = { detection: '目标检测', segmentation: '图像分割', classification: '图像分类' };
      return map[String(value || '')] || value || '-';
    },
    versionStatusLabel(status) {
      const map = { created: '已创建', finalized: '已完成', active: '激活中', archived: '已归档', ready: '就绪' };
      return map[String(status || '').toLowerCase()] || String(status || '-') || '-';
    },
    formatNumber(value) {
      return (Number(value) || 0).toLocaleString();
    },
    formatBytes(value) {
      const size = Number(value) || 0;
      if (size <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let n = size;
      let idx = 0;
      while (n >= 1024 && idx < units.length - 1) {
        n /= 1024;
        idx += 1;
      }
      return `${n.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
    },
    formatDate(value) {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleString();
    },
    formatTime(value) {
      if (!value) return '-';
      const date = new Date(Number(value) * 1000);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleString();
    },
    sleep(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    },
    stopPublishJobPolling() {
      this.publishJobPollToken += 1;
    },
    publishStatusLabel(status) {
      const key = String(status || '').trim().toLowerCase();
      const map = {
        queued: '排队中',
        running: '进行中',
        completed: '已完成',
        failed: '失败',
        cancelled: '已取消',
      };
      return map[key] || '等待中';
    },
    updatePublishJobState(job) {
      const payload = job && typeof job === 'object' ? job : {};
      this.publishJobId = String(payload.job_id || this.publishJobId || '');
      this.publishJobStatus = String(payload.status || this.publishJobStatus || '');
      this.publishJobPhase = String(payload.phase || payload.status || this.publishJobPhase || '');
      this.publishJobProgress = Number(payload.progress) || 0;
      this.publishJobProcessed = Number(payload.processed) || 0;
      this.publishJobTotal = Number(payload.total) || 0;
      this.publishJobError = String(payload.error_message || '');
      this.publishJobUpdatedAt = String(payload.updated_at || '');
      const logs = Array.isArray(payload.logs) ? payload.logs : [];
      this.publishJobLogs = logs.map((item) => String(item || '').trim()).filter(Boolean).slice(-6);
    },
    resetPublishJobState({ keepLast = false } = {}) {
      this.publishJobPollToken += 1;
      if (keepLast) return;
      this.publishJobId = '';
      this.publishJobPhase = '';
      this.publishJobProgress = 0;
      this.publishJobStatus = '';
      this.publishJobProcessed = 0;
      this.publishJobTotal = 0;
      this.publishJobLogs = [];
      this.publishJobError = '';
      this.publishJobUpdatedAt = '';
    },
    publishPhaseLabel(phase, status = '') {
      const key = String(phase || status || '').trim().toLowerCase();
      const map = {
        queued: '任务排队中',
        preparing: '准备转换参数',
        materializing: '整理原始数据',
        converting: '执行数据转换',
        publishing: '生成标准数据集',
        done: '转换完成',
        failed: '转换失败',
        cancelled: '转换已取消',
      };
      return map[key] || '执行中';
    },
    normalizePublishNoticeItems(value) {
      const rawList = Array.isArray(value)
        ? value
        : (typeof value === 'string' ? value.split(/\r?\n/) : []);
      const seen = new Set();
      const out = [];
      rawList.forEach((item) => {
        let text = '';
        if (item && typeof item === 'object') {
          const path = String(item.path || item.file || item.name || '').trim();
          const reason = String(item.reason || item.message || item.detail || '').trim();
          text = path && reason ? `${path}: ${reason}` : (path || reason || JSON.stringify(item));
        } else {
          text = String(item || '').trim();
        }
        if (!text || seen.has(text)) return;
        seen.add(text);
        out.push(text);
      });
      return out;
    },
    collectPublishResultNotice(result) {
      const payload = result && typeof result === 'object' ? result : {};
      const publishConfig = payload.publish_config && typeof payload.publish_config === 'object'
        ? payload.publish_config
        : {};
      const conversionResult = payload.conversion_result && typeof payload.conversion_result === 'object'
        ? payload.conversion_result
        : (publishConfig.conversion_result && typeof publishConfig.conversion_result === 'object'
          ? publishConfig.conversion_result
          : {});
      const warnings = this.normalizePublishNoticeItems([
        ...this.normalizePublishNoticeItems(conversionResult.warnings),
        ...this.normalizePublishNoticeItems(payload.warnings),
        ...this.normalizePublishNoticeItems(publishConfig.warnings),
      ]);
      const skippedDetails = this.normalizePublishNoticeItems([
        ...this.normalizePublishNoticeItems(conversionResult.skipped_details),
        ...this.normalizePublishNoticeItems(payload.skipped_details),
        ...this.normalizePublishNoticeItems(publishConfig.skipped_details),
      ]);
      const skippedCount = Number(conversionResult.pairs_skipped ?? conversionResult.skipped ?? skippedDetails.length) || skippedDetails.length;
      if (!warnings.length && !skippedDetails.length && skippedCount <= 0) return null;
      return {
        warnings,
        skippedDetails,
        skippedCount,
        processed: Number(conversionResult.pairs_processed) || 0,
        total: Number(conversionResult.pairs_total) || 0,
      };
    },
    showPublishResultNotice(result) {
      const notice = this.collectPublishResultNotice(result);
      if (!notice) return;

      const h = this.$createElement;
      const warningLimit = 5;
      const skippedLimit = 8;
      const summary = [];
      if (notice.total > 0) summary.push(`已处理 ${notice.processed}/${notice.total} 个成对样本`);
      if (notice.skippedCount > 0) summary.push(`跳过 ${notice.skippedCount} 项未成对或异常数据`);
      if (notice.warnings.length > 0) summary.push(`${notice.warnings.length} 条转换提醒`);

      const children = [
        h('div', { style: { marginBottom: '6px' } }, `${summary.join('，') || '转换过程中有数据被跳过'}；标准数据集已正常生成。`),
      ];
      if (notice.warnings.length) {
        children.push(h('div', { style: { fontWeight: 600, marginTop: '6px' } }, '告警'));
        children.push(h(
          'ul',
          { style: { margin: '2px 0 0 18px', padding: 0 } },
          notice.warnings.slice(0, warningLimit).map((item) => h('li', item))
        ));
      }
      if (notice.skippedDetails.length) {
        children.push(h('div', { style: { fontWeight: 600, marginTop: '6px' } }, '跳过明细'));
        children.push(h(
          'ul',
          { style: { margin: '2px 0 0 18px', padding: 0 } },
          notice.skippedDetails.slice(0, skippedLimit).map((item) => h('li', item))
        ));
      }
      const hiddenCount = Math.max(0, notice.warnings.length - warningLimit)
        + Math.max(0, notice.skippedDetails.length - skippedLimit);
      if (hiddenCount > 0) {
        children.push(h('div', { style: { color: '#909399', marginTop: '6px' } }, `还有 ${hiddenCount} 条明细未展示。`));
      }

      this.$notify({
        title: '转换完成，存在兼容提醒',
        type: 'warning',
        message: h('div', { style: { lineHeight: '1.55' } }, children),
        duration: 16000,
      });
    },
    async waitForPublishJob(jobId) {
      const token = Date.now();
      this.publishJobPollToken = token;
      while (this.publishJobPollToken === token) {
        const job = await fetchIllegalDatasetPublishJob(this.datasetId, jobId);
        this.updatePublishJobState(job);

        const status = String(job && job.status || '').trim().toLowerCase();
        if (status === 'completed') {
          return job;
        }
        if (status === 'failed') {
          throw new Error(job && job.error_message ? job.error_message : '服务端处理失败');
        }
        if (status === 'cancelled') {
          throw new Error('转换任务已取消');
        }

        await this.sleep(2000);
      }
      throw new Error('转换轮询已取消');
    },
    getPresetStorageKey() {
      return 'illegal_label_mapping_presets_v3';
    },
    getLeafLabel(label) {
      const parts = String(label || '').split('%').map((item) => item.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : String(label || '').trim();
    },
    // ── Status-aware mapping helpers ──────────────────────────────────────
    normalizeMappingStatus(status, mappedLabel) {
      const val = String(status || '').trim().toLowerCase();
      if (val === 'keep') return 'keep';
      if (val === 'delete') return 'delete';
      // Legacy compatibility
      if (['discard', 'drop', 'remove', '删除', '丢弃', '忽略'].includes(val)) return 'delete';
      // Legacy __DISCARD__ in mapped_label
      if (String(mappedLabel || '').trim() === '__DISCARD__') return 'delete';
      return 'keep';
    },
    normalizeMappingValue(value) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const status = this.normalizeMappingStatus(value.status, value.mapped_label);
        return {
          mapped_label: status === 'delete' ? '' : String(value.mapped_label || '').trim(),
          status: status,
        };
      }
      const str = String(value || '').trim();
      if (str === '__DISCARD__' || str === '') {
        return { mapped_label: '', status: 'delete' };
      }
      return { mapped_label: str, status: 'keep' };
    },
    mappingEntryToPayload(rawLabel, value) {
      const normalized = this.normalizeMappingValue(value);
      return {
        raw_label: String(rawLabel || '').trim(),
        mapped_label: normalized.mapped_label,
        status: normalized.status,
      };
    },
    normalizePresetDetectionRows(rows) {
      const list = Array.isArray(rows) ? rows : [];
      const out = [];
      const dedup = new Map();
      list.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const source = String(item.source_label || item.source || '').trim();
        if (!source) return;
        const target = String(item.target_label || item.target || '').trim() || this.getLeafLabel(source);
        const status = this.normalizeMappingStatus(item.status, target);
        dedup.set(source, { target_label: target, status: status });
      });
      dedup.forEach((val, source) => {
        out.push({ source_label: source, target_label: val.target_label, status: val.status });
      });
      return out;
    },
    normalizePresetClassificationRows(rows) {
      const list = Array.isArray(rows) ? rows : [];
      const out = [];
      const dedup = new Map();
      list.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const category = String(item.category || item.group || '').trim();
        const source = String(item.source_label || item.source || '').trim();
        if (!category || !source) return;
        const target = String(item.target_label || item.target || '').trim() || category;
        const status = this.normalizeMappingStatus(item.status, target);
        dedup.set(`${category}::${source}`, { category, source_label: source, target_label: target, status: status });
      });
      dedup.forEach((row) => out.push(row));
      return out;
    },
    normalizePresetPayload(payload) {
      const data = payload && typeof payload === 'object' ? payload : {};
      return {
        detection: this.normalizePresetDetectionRows(data.detection),
        classification: this.normalizePresetClassificationRows(data.classification),
        updated_at: data.updated_at ? String(data.updated_at) : null,
      };
    },
    loadIllegalLabelPresets({ silent = false } = {}) {
      this.mappingPresetsLoading = true;
      try {
        const raw = window.localStorage.getItem(this.getPresetStorageKey());
        const parsed = raw ? JSON.parse(raw) : {};
        this.presetData = this.normalizePresetPayload(parsed);
        return this.presetData;
      } catch (error) {
        this.presetData = this.normalizePresetPayload({});
        if (!silent) {
          this.$message.warning(`预设映射加载失败: ${error && error.message ? error.message : error}`);
        }
        return this.presetData;
      } finally {
        this.mappingPresetsLoading = false;
      }
    },
    openPresetDialog() {
      this.showPresetDialog = true;
      if (!this.presetDetectionCount && !this.presetClassificationCount) {
        this.loadIllegalLabelPresets({ silent: true });
      }
    },
    addDetectionPresetRow() {
      this.presetData.detection.push({ source_label: '', target_label: '', status: 'keep' });
    },
    removeDetectionPresetRow(index) {
      this.presetData.detection.splice(index, 1);
    },
    addClassificationPresetRow() {
      this.presetData.classification.push({ category: '', source_label: '', target_label: '', status: 'keep' });
    },
    removeClassificationPresetRow(index) {
      this.presetData.classification.splice(index, 1);
    },
    triggerPresetFileUpload() {
      if (this.$refs.presetFileInput) {
        this.$refs.presetFileInput.value = '';
        this.$refs.presetFileInput.click();
      }
    },
    async handlePresetFileChange(event) {
      const file = event && event.target && event.target.files ? event.target.files[0] : null;
      if (!file) return;
      try {
        const parsed = await this.parsePresetWorkbook(file);
        const hasDetection = parsed.detection && parsed.detection.length > 0;
        const hasClassification = parsed.classification && parsed.classification.length > 0;
        if (!hasDetection && !hasClassification) {
          this.$message.warning('未从 XLSX 中识别到检测/分类映射数据');
          return;
        }
        if (hasDetection) this.presetData.detection = parsed.detection;
        if (hasClassification) this.presetData.classification = parsed.classification;
        this.$message.success('XLSX 导入成功，请检查后保存');
      } catch (error) {
        this.$message.error(`XLSX 导入失败: ${error && error.message ? error.message : error}`);
      } finally {
        if (event && event.target) event.target.value = '';
      }
    },
    async parsePresetWorkbook(file) {
      const xlsxModule = await import('xlsx');
      const XLSX = xlsxModule.default || xlsxModule;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheets = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
      if (!sheets.length) throw new Error('工作簿为空');

      const findSheetName = (keywords) => sheets.find((name) => {
        const normalized = String(name || '').toLowerCase();
        return keywords.some((item) => normalized.includes(String(item).toLowerCase()));
      });

      const detectionSheetName = findSheetName(['检测', 'detection', 'det']) || sheets[0] || null;
      const classificationSheetName = findSheetName(['分类', 'classification', 'class']) || sheets[1] || null;

      const readSheetRows = (sheetName) => {
        if (!sheetName) return [];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return [];
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
        return Array.isArray(matrix) ? matrix : [];
      };

      return {
        detection: this.normalizePresetDetectionRows(this.parseDetectionPresetSheet(readSheetRows(detectionSheetName))),
        classification: this.normalizePresetClassificationRows(this.parseClassificationPresetSheet(readSheetRows(classificationSheetName))),
      };
    },
    parseDetectionPresetSheet(matrix) {
      const rows = Array.isArray(matrix) ? matrix : [];
      if (!rows.length) return [];
      const normalizedHeader = (rows[0] || []).map((item) => String(item || '').trim().toLowerCase());
      const sourceHeaderTokens = ['source', 'source_label', '原始标签', '源标签', '标签路径'];
      const targetHeaderTokens = ['target', 'target_label', '映射标签', '目标标签', '分类'];
      const statusHeaderTokens = ['status', '状态', '操作'];
      const findHeaderIndex = (tokens) => normalizedHeader.findIndex((header) => tokens.some((token) => header.includes(token)));
      const sourceIdx = findHeaderIndex(sourceHeaderTokens);
      const targetIdx = findHeaderIndex(targetHeaderTokens);
      const statusIdx = findHeaderIndex(statusHeaderTokens);
      const hasHeader = sourceIdx >= 0 || targetIdx >= 0;
      const srcCol = sourceIdx >= 0 ? sourceIdx : 0;
      const tgtCol = targetIdx >= 0 ? targetIdx : (rows[0].length > 1 ? 1 : -1);
      const startIndex = hasHeader ? 1 : 0;
      const out = [];
      for (let i = startIndex; i < rows.length; i += 1) {
        const row = Array.isArray(rows[i]) ? rows[i] : [];
        const source = String(row[srcCol] || '').trim();
        if (!source) continue;
        const targetRaw = tgtCol >= 0 ? row[tgtCol] : '';
        const target = String(targetRaw || '').trim() || this.getLeafLabel(source);
        const status = statusIdx >= 0 ? String(row[statusIdx] || '').trim() : '';
        out.push({ source_label: source, target_label: target, status: status });
      }
      return out;
    },
    parseClassificationPresetSheet(matrix) {
      const rows = Array.isArray(matrix) ? matrix : [];
      if (!rows.length) return [];

      const normalizedHeader = (rows[0] || []).map((item) => String(item || '').trim().toLowerCase());
      const categoryHeaderTokens = ['category', 'group', '分类', '类别'];
      const sourceHeaderTokens = ['source', 'source_label', '原始标签', '源标签', '标签路径'];
      const targetHeaderTokens = ['target', 'target_label', '映射标签', '目标标签'];
      const statusHeaderTokens = ['status', '状态', '操作'];
      const findHeaderIndex = (tokens) => normalizedHeader.findIndex((header) => tokens.some((token) => header.includes(token)));

      const categoryIdx = findHeaderIndex(categoryHeaderTokens);
      const sourceIdx = findHeaderIndex(sourceHeaderTokens);
      const targetIdx = findHeaderIndex(targetHeaderTokens);
      const statusIdx = findHeaderIndex(statusHeaderTokens);

      const out = [];
      if (sourceIdx >= 0 && categoryIdx >= 0) {
        for (let i = 1; i < rows.length; i += 1) {
          const row = Array.isArray(rows[i]) ? rows[i] : [];
          const category = String(row[categoryIdx] || '').trim();
          const source = String(row[sourceIdx] || '').trim();
          if (!category || !source) continue;
          const target = targetIdx >= 0 ? String(row[targetIdx] || '').trim() : '';
          const status = statusIdx >= 0 ? String(row[statusIdx] || '').trim() : '';
          out.push({ category, source_label: source, target_label: target || category, status: status });
        }
        return out;
      }

      const categoryColumns = (rows[0] || []).map((cell) => String(cell || '').trim());
      const validColumns = categoryColumns
        .map((name, idx) => ({ name, idx }))
        .filter((item) => !!item.name);
      if (!validColumns.length) return out;

      for (let r = 1; r < rows.length; r += 1) {
        const row = Array.isArray(rows[r]) ? rows[r] : [];
        validColumns.forEach((column) => {
          const source = String(row[column.idx] || '').trim();
          if (!source) return;
          out.push({ category: column.name, source_label: source, target_label: column.name, status: '' });
        });
      }
      return out;
    },
    buildPresetMapping(mode) {
      const key = mode === 'classification' ? 'classification' : 'detection';
      if (key === 'detection') {
        const rows = this.normalizePresetDetectionRows(this.presetData.detection);
        return rows.reduce((acc, row) => {
          acc[row.source_label] = {
            mapped_label: row.status === 'delete' ? '' : (row.target_label || this.getLeafLabel(row.source_label)),
            status: row.status || 'keep',
          };
          return acc;
        }, {});
      }
      const rows = this.normalizePresetClassificationRows(this.presetData.classification);
      return rows.reduce((acc, row) => {
        if (!row.source_label) return acc;
        const target = String(row.target_label || '').trim() || String(row.category || '').trim();
        acc[row.source_label] = {
          mapped_label: row.status === 'delete' ? '' : target,
          status: row.status || 'keep',
        };
        return acc;
      }, {});
    },
    async applyPresetToCurrentMapping() {
      if (!this.presetDetectionCount && !this.presetClassificationCount) {
        this.loadIllegalLabelPresets({ silent: true });
      }
      const mapping = this.buildPresetMapping(this.presetApplyMode);
      if (!mapping || Object.keys(mapping).length === 0) {
        this.$message.warning('当前预设为空，请先编辑并保存预设映射');
        return;
      }
      this.$nextTick(() => {
        const panel = this.$refs.labelMappingPanel;
        if (!panel || typeof panel.applyExternalMapping !== 'function') {
          this.$message.warning('当前映射面板未就绪，请稍后重试');
          return;
        }
        const result = panel.applyExternalMapping(mapping);
        const matched = Number(result && result.matched) || 0;
        const total = Number(result && result.total) || 0;
        this.$message.success(`已应用预设映射，匹配 ${matched}/${total} 条标签`);
      });
    },
    async savePresetDialogData() {
      this.mappingPresetsSaving = true;
      try {
        const payload = {
          detection: this.normalizePresetDetectionRows(this.presetData.detection),
          classification: this.normalizePresetClassificationRows(this.presetData.classification),
          updated_at: new Date().toISOString(),
        };
        window.localStorage.setItem(this.getPresetStorageKey(), JSON.stringify(payload));
        this.presetData = this.normalizePresetPayload(payload);
        this.$message.success('预设映射保存成功');
        this.showPresetDialog = false;
      } catch (error) {
        this.$message.error(`保存预设失败: ${error && error.message ? error.message : error}`);
      } finally {
        this.mappingPresetsSaving = false;
      }
    },
    normalizeMappings(rawLabels, savedItems) {
      const savedMap = new Map();
      (Array.isArray(savedItems) ? savedItems : []).forEach((item) => {
        const raw = String(item && item.raw_label || '').trim();
        if (!raw) return;
        const mapped = String(item && item.mapped_label || '').trim();
        const status = this.normalizeMappingStatus(item && item.status, mapped);
        savedMap.set(raw, {
          mapped_label: status === 'delete' ? '' : mapped,
          status: status,
        });
      });
      const keys = new Set();
      (Array.isArray(rawLabels) ? rawLabels : []).forEach((label) => {
        const raw = String(label || '').trim();
        if (raw) keys.add(raw);
      });
      savedMap.forEach((_value, key) => keys.add(key));
      return Array.from(keys)
        .sort((a, b) => a.localeCompare(b, 'zh-CN'))
        .map((raw) => {
          const saved = savedMap.get(raw);
          if (saved) {
            return {
              raw_label: raw,
              mapped_label: saved.mapped_label,
              status: saved.status,
            };
          }
          return {
            raw_label: raw,
            mapped_label: raw,
            status: 'keep',
          };
        });
    },
    buildMappingObjectFromRows(rows) {
      return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
        const raw = String(row && row.raw_label || '').trim();
        if (!raw) return acc;
        const mapped = String(row && row.mapped_label || '').trim();
        const status = this.normalizeMappingStatus(row && row.status, mapped);
        acc[raw] = {
          mapped_label: status === 'delete' ? '' : mapped,
          status: status,
        };
        return acc;
      }, {});
    },
    applySliceParamsToPublishForm(sliceParams) {
      if (!sliceParams || typeof sliceParams !== 'object') return;
      this.publishForm.slice_size = Number(sliceParams.slice_size) || this.publishForm.slice_size;
      this.publishForm.slice_overlap = Number(sliceParams.overlap) || 0;
      this.publishForm.slice_padding = Number(sliceParams.padding) || 0;
      this.publishForm.slice_min_area_ratio = Number(sliceParams.min_area_ratio) || 0;
      this.publishForm.slice_min_visibility = Number(sliceParams.min_visibility) || 0;
      this.publishForm.slice_min_pixel_size = Number(sliceParams.min_pixel_size) || 1;
      this.publishForm.slice_negative_ratio = Number(sliceParams.negative_ratio) || 0;
      this.publishForm.slice_empty_positive_action = String(sliceParams.empty_positive_action || 'discard');
    },
    buildPublishConfig() {
      return {
        frontend: 'tfs-v3',
        output_format: 'yolo',
        conversion: {
          slice: {
            enabled: true,
            slice_size: Number(this.publishForm.slice_size) || 1280,
            overlap: Number(this.publishForm.slice_overlap) || 0,
            padding: Number(this.publishForm.slice_padding) || 0,
            min_area_ratio: Number(this.publishForm.slice_min_area_ratio) || 0,
            min_visibility: Number(this.publishForm.slice_min_visibility) || 0,
            min_pixel_size: Number(this.publishForm.slice_min_pixel_size) || 1,
            negative_ratio: Number(this.publishForm.slice_negative_ratio) || 0,
            empty_positive_action: String(this.publishForm.slice_empty_positive_action || 'discard'),
          },
        },
      };
    },
    getPanelMappingObject() {
      const panel = this.$refs.labelMappingPanel;
      if (panel && typeof panel.buildMapping === 'function') {
        return panel.buildMapping();
      }
      return this.buildMappingObjectFromRows(this.mappingRows);
    },
    getPanelSliceParams() {
      const panel = this.$refs.labelMappingPanel;
      if (panel && typeof panel.buildSliceParams === 'function') {
        return panel.buildSliceParams();
      }
      return {
        slice_size: this.publishForm.slice_size,
        overlap: this.publishForm.slice_overlap,
        padding: this.publishForm.slice_padding,
        min_area_ratio: this.publishForm.slice_min_area_ratio,
        min_visibility: this.publishForm.slice_min_visibility,
        min_pixel_size: this.publishForm.slice_min_pixel_size,
        negative_ratio: this.publishForm.slice_negative_ratio,
        empty_positive_action: this.publishForm.slice_empty_positive_action,
      };
    },
    buildDefaultStandardDatasetName() {
      const base = String(this.datasetName || `illegal-${this.datasetId}` || 'illegal-dataset').trim() || 'illegal-dataset';
      const versionText = this.activeVersion && this.activeVersion.version ? `v${this.activeVersion.version}` : 'v0';
      const now = new Date();
      const pad = (value, size = 2) => String(value).padStart(size, '0');
      const stamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
      ].join('') + '-' + [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
        pad(now.getMilliseconds(), 3),
      ].join('');
      return `${base}-standard-${versionText}-${stamp}`;
    },
    syncPanelFromSavedMappings() {
      this.$nextTick(() => {
        const panel = this.$refs.labelMappingPanel;
        if (!panel || typeof panel.applyExternalMapping !== 'function') return;
        const mapping = this.buildMappingObjectFromRows(this.mappingRows);
        if (Object.keys(mapping).length) {
          panel.applyExternalMapping(mapping);
        }
      });
    },
    async refreshAll() {
      await this.loadAll();
    },
    async loadAll() {
      if (!this.datasetId) {
        this.$message.error('未找到原始数据集 ID');
        return;
      }
      this.loading = true;
      try {
        const detail = await fetchIllegalDatasetDetail(this.datasetId, { versionsLimit: 50, eventsLimit: 50 });
        this.detail = detail;
        this.presetApplyMode = this.datasetTypeValue === 'classification' ? 'classification' : 'detection';

        const [rawPayload, mappingPayload, filePage] = await Promise.all([
          fetchIllegalDatasetRawLabels(this.datasetId).catch(() => ({ labels: [] })),
          fetchIllegalDatasetLabelMappings(this.datasetId).catch(() => ({ items: [] })),
          fetchIllegalDatasetFiles(this.datasetId, { page: 1, pageSize: 100, versionId: this.activeVersionId }).catch(() => ({ items: [] })),
        ]);

        this.rawLabels = Array.isArray(rawPayload && rawPayload.labels) ? rawPayload.labels : [];
        const mappingItems = Array.isArray(mappingPayload && mappingPayload.items) ? mappingPayload.items : [];
        this.mappingRows = this.normalizeMappings(this.rawLabels, mappingItems);
        this.files = Array.isArray(filePage && filePage.items) ? filePage.items : [];

        this.publishForm.version_id = this.activeVersionId || null;

        await this.loadPreview();
        this.syncPanelFromSavedMappings();
      } catch (error) {
        console.error(error);
        this.$message.error(`加载原始数据集失败：${error.message || error}`);
      } finally {
        this.loading = false;
      }
    },
    async loadPreview() {
      if (!this.datasetId || !this.activeVersionId) {
        this.preview = { categories: [], items: [], meta: {} };
        return;
      }
      this.loadingPreview = true;
      try {
        this.preview = await fetchIllegalDatasetView(this.datasetId, {
          versionId: this.activeVersionId,
          classId: this.previewClassId,
          page: 1,
          pageSize: 24,
        });
      } catch (error) {
        console.error(error);
        this.preview = { categories: [], items: [], meta: {} };
      } finally {
        this.loadingPreview = false;
      }
    },
    async handleLabelMappingSave(mapping, { silent = false } = {}) {
      this.savingMappings = true;
      try {
        const items = Object.keys(mapping || {}).map((rawLabel) => {
          return this.mappingEntryToPayload(rawLabel, mapping[rawLabel]);
        }).filter((row) => {
          if (!row.raw_label) return false;
          if (row.status === 'delete') return true;
          return row.mapped_label !== '';
        });
        await updateIllegalDatasetLabelMappings(this.datasetId, items);
        this.mappingRows = this.normalizeMappings(this.rawLabels, items);
        if (!silent) this.$message.success('映射保存成功');
        this.syncPanelFromSavedMappings();
        return true;
      } catch (error) {
        console.error(error);
        this.$message.error(`保存映射失败：${error.message || error}`);
        return false;
      } finally {
        this.savingMappings = false;
      }
    },
    async handlePanelSave(mapping) {
      await this.handleLabelMappingSave(mapping);
    },
    async handleSaveAndConvert(mapping, sliceParams) {
      this.applySliceParamsToPublishForm(sliceParams);
      await this.publishToStandard({ mappingOverride: mapping, sliceParams, skipSaveMappings: false });
    },
    async activateVersion(versionId) {
      if (!versionId || versionId === this.activeVersionId) {
        return;
      }
      const row = this.versionMap[versionId];
      if (!row || !row.version_id) return;
      try {
        await activateIllegalDatasetVersion(this.datasetId, row.version_id);
        this.$message.success(`已切换到版本 v${row.version}`);
        this.publishForm.version_id = row.version_id;
        await this.loadAll();
      } catch (error) {
        console.error(error);
        this.$message.error(`激活版本失败：${error.message || error}`);
      }
    },
    async publishToStandard({ mappingOverride = null, sliceParams = null, skipSaveMappings = false } = {}) {
      const effectiveSliceParams = sliceParams || this.getPanelSliceParams();
      this.applySliceParamsToPublishForm(effectiveSliceParams);
      const effectiveMapping = mappingOverride || this.getPanelMappingObject();
      const name = this.buildDefaultStandardDatasetName();

      if (!skipSaveMappings) {
        const ok = await this.handleLabelMappingSave(effectiveMapping, { silent: true });
        if (!ok) return;
      }

      this.publishing = true;
      this.resetPublishJobState();
      try {
        const job = await createIllegalDatasetPublishJob(this.datasetId, {
          name,
          version_id: this.publishForm.version_id || this.activeVersionId || undefined,
          label_filters: [],
          label_mapping_overrides: effectiveMapping,
          publish_config: this.buildPublishConfig(),
        });
        const jobId = String(job && job.job_id || '').trim();
        if (!jobId) {
          throw new Error('服务端未返回转换任务 ID');
        }
        this.updatePublishJobState({ ...job, job_id: jobId });
        this.$message.info(`转换任务已提交：${this.publishPhaseLabel(this.publishJobPhase, job.status)}`);

        const finalJob = await this.waitForPublishJob(jobId);
        const result = finalJob && finalJob.result ? finalJob.result : null;
        const standardDatasetId = result && result.standard_dataset_id;
        if (!standardDatasetId) {
          throw new Error('转换任务已完成，但未返回标准数据集 ID');
        }
        this.$message.success(`标准数据集已转换完成：#${standardDatasetId}`);
        this.showPublishResultNotice(result);
        if (standardDatasetId) {
          this.$confirm('标准数据集已生成，是否立即前往详情页查看？', '转换成功', {
            type: 'success',
            confirmButtonText: '前往查看',
            cancelButtonText: '留在当前页',
          }).then(() => {
            this.$router.push({ path: '/standard-dataset-detail', query: { id: standardDatasetId } });
          }).catch(() => { });
        }
        await this.loadAll();
      } catch (error) {
        if (String(error && error.message || '') !== '转换轮询已取消') {
          console.error(error);
          this.$message.error(`转换失败：${error.message || error}`);
        }
      } finally {
        this.resetPublishJobState({ keepLast: true });
        this.publishing = false;
      }
    },
    handleUploadSuccess() {
      this.uploadDialogVisible = false;
      this.uploadFile = null;
      this.uploading = false;
      this.uploadProgress = 0;
      this.$message.success('ZIP 上传完成，已生成新的原始数据集内容');
      this.loadAll();
    },
    handleAppendSuccess() {
      this.appendDialogVisible = false;
      this.appendFile = null;
      this.appending = false;
      this.appendProgress = 0;
      this.$message.success('追加上传成功，已生成新版本');
      this.loadAll();
    },
    openMountedImport(mode) {
      this.mountedImportMode = mode || 'upload';
      this.mountedImportVisible = true;
    },
    handleMountedImportSuccess() {
      this.mountedImportVisible = false;
      this.loadAll();
    },
    handleUploadFail(error) {
      const title = error && error.title ? error.title : '上传失败';
      const detail = error && error.detail ? error.detail : (error && error.message ? error.message : error || '未知错误');
      this.$message.error(detail ? `${title}：${detail}` : title);
    },
    handleUploadCancel(error) {
      const title = error && error.title ? error.title : '已取消上传';
      this.$message.info(title);
    },
  },
};
</script>

<style scoped>
.dataset-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.import-actions {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.glass-panel,
.detail-hero,
.section-card {
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.detail-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 30px;
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.back-link {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.hero-kicker {
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
}

.hero-title {
  margin: 0;
  font-size: 32px;
  line-height: 1.2;
  color: #111827;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.meta-pill,
.meta-id {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
}

.meta-pill.warning {
  background: #fff7ed;
  color: #c2410c;
}

.meta-pill.info {
  background: #eff6ff;
  color: #1d4ed8;
}

.meta-pill.success {
  background: #ecfdf3;
  color: #027a48;
}

.meta-id {
  background: #f8fafc;
  color: #475569;
}

.hero-desc {
  margin: 14px 0 0;
  color: #4b5563;
  line-height: 1.8;
  max-width: 760px;
}

.hero-right {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 14px;
  min-width: 480px;
}

.stat-card {
  border-radius: 18px;
  padding: 18px 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #edf2f7;
}

.stat-label {
  color: #64748b;
  font-size: 13px;
}

.stat-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.detail-body {
  padding: 22px;
}

.loading-state,
.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  color: #64748b;
}

.panel-empty {
  flex-direction: column;
  padding: 30px 16px;
  text-align: center;
}

.panel-empty i {
  font-size: 28px;
}

.illegal-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.illegal-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 18px;
}

.warning-theme {
  border-color: rgba(245, 158, 11, 0.35);
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.98) 0%, rgba(255, 251, 235, 0.98) 100%);
}

.illegal-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(245, 158, 11, 0.16);
  color: #d97706;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex: 0 0 auto;
}

.illegal-content {
  flex: 1;
  min-width: 0;
}

.illegal-title {
  font-size: 18px;
  font-weight: 700;
  color: #92400e;
}

.illegal-desc {
  margin-top: 4px;
  line-height: 1.7;
  color: #9a3412;
}

.illegal-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.1);
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
}

.badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.16);
}

.illegal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.preset-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.8);
}

.preset-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #64748b;
}

.preset-mode-select {
  width: 150px;
}

.illegal-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 20px;
}

.main-column,
.side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card {
  padding: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.section-sub {
  color: #64748b;
  font-size: 13px;
  margin-top: 4px;
}

.mapping-panel-wrap {
  min-height: 420px;
}

.legacy-mapping-wrap {
  margin-bottom: 4px;
}

.publish-progress-panel {
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 12px;
  background: #f8fafc;
}

.publish-progress-panel.status-running,
.publish-progress-panel.status-queued {
  border-color: rgba(37, 99, 235, 0.24);
  background: #eff6ff;
}

.publish-progress-panel.status-completed {
  border-color: rgba(22, 163, 74, 0.24);
  background: #f0fdf4;
}

.publish-progress-panel.status-failed {
  border-color: rgba(220, 38, 38, 0.24);
  background: #fef2f2;
}

.publish-progress-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.publish-progress-title-wrap {
  min-width: 0;
}

.publish-progress-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.publish-progress-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.publish-progress-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.publish-progress-error {
  margin-top: 10px;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.publish-progress-logs {
  display: grid;
  gap: 4px;
  margin-top: 10px;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
}

.publish-progress-log {
  padding-left: 10px;
  border-left: 2px solid rgba(148, 163, 184, 0.55);
}

.publish-tip {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fdf6ec;
  color: #8a5a00;
  line-height: 1.6;
}

.split-row {
  display: grid;
  grid-template-columns: repeat(6, auto);
  gap: 8px;
  align-items: center;
}

.publish-split-summary {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
}

.publish-split-summary.invalid {
  color: #f56c6c;
}

.full-width {
  width: 100%;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.image-card {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.preview-image {
  width: 100%;
  height: 150px;
  display: block;
  background: #f5f7fa;
}

.image-meta {
  padding: 10px 12px;
}

.image-name {
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}

.image-desc {
  margin-top: 4px;
  color: #909399;
  font-size: 12px;
}

.info-list {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-item span {
  color: #909399;
  font-size: 12px;
}

.info-item strong {
  color: #303133;
  word-break: break-all;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
}

.empty-content {
  max-width: 680px;
}

.empty-title {
  font-size: 26px;
  font-weight: 700;
  color: #111827;
}

.empty-desc {
  margin-top: 14px;
  color: #4b5563;
  line-height: 1.8;
}

.empty-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.tip-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 999px;
}

.preset-dialog-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.preset-dialog-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #64748b;
  flex-wrap: wrap;
}

.preset-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 1280px) {
  .detail-hero {
    flex-direction: column;
  }

  .hero-right {
    min-width: 0;
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  .illegal-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .detail-hero {
    padding: 20px;
  }

  .detail-body,
  .section-card {
    padding: 16px;
  }

  .hero-right {
    grid-template-columns: 1fr;
  }

  .illegal-banner,
  .empty-state {
    flex-direction: column;
    align-items: flex-start;
  }

  .illegal-actions {
    justify-content: flex-start;
  }

  .split-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.version-select {
  width: 100%;
}
</style>
