<template>
  <el-dialog
    title="从挂载目录导入"
    :visible="visible"
    width="780px"
    top="5vh"
    custom-class="mounted-import-dialog"
    append-to-body
    @open="handleOpen"
    @close="handleClose"
  >
    <div class="mounted-import">
      <div class="mounted-toolbar">
        <el-select v-model="rootId" size="small" class="root-select" :disabled="importing" @change="handleRootChange">
          <el-option
            v-for="root in roots"
            :key="root.root_id"
            :label="root.label"
            :value="root.root_id"
            :disabled="!root.exists || !root.readable"
          />
        </el-select>
        <el-button size="small" :disabled="!canGoParent || importing" @click="goParent">
          <i class="el-icon-back"></i>
        </el-button>
        <el-button size="small" :loading="loadingEntries" :disabled="importing" @click="loadEntries">
          刷新
        </el-button>
        <el-button size="small" type="primary" plain :disabled="importing" @click="selectCurrent">
          选当前目录
        </el-button>
        <el-button size="small" type="success" plain :disabled="importing" @click="openRootDialog">
          添加目录
        </el-button>
      </div>

      <div class="current-path">
        <span>当前目录</span>
        <strong>{{ currentPath || '/' }}</strong>
      </div>

      <div class="browser-grid">
        <div class="directory-list" v-loading="loadingEntries">
          <div
            v-for="entry in entries"
            :key="entry.path"
            class="directory-row"
            :class="{ selected: selectedPath === entry.path, candidate: entry.is_dataset_candidate }"
            @click="selectEntry(entry)"
            @dblclick="openEntry(entry)"
          >
            <i class="el-icon-folder"></i>
            <div class="directory-main">
              <div class="directory-name">{{ entry.name }}</div>
              <div class="directory-meta">
                {{ entry.image_count || 0 }} 图 · {{ entry.json_count || 0 }} JSON · {{ entry.label_count || 0 }} labels
              </div>
            </div>
            <el-button size="mini" type="text" :disabled="importing" @click.stop="openEntry(entry)">进入</el-button>
          </div>
          <div v-if="!entries.length && !loadingEntries" class="empty-list">当前目录没有可进入的子目录</div>
        </div>

        <div class="inspect-panel" v-loading="inspecting">
          <div class="inspect-title">导入检查</div>
          <template v-if="inspectResult">
            <div class="inspect-format">{{ formatLabel(inspectResult.format) }}</div>
            <div class="inspect-stats">
              <span>{{ inspectResult.image_count || 0 }} 图片</span>
              <span>{{ inspectResult.json_count || 0 }} JSON</span>
              <span>{{ inspectResult.label_count || 0 }} YOLO 标签</span>
            </div>
            <div class="inspect-path">{{ inspectResult.path || '/' }}</div>
            <div v-if="inspectResult.warnings && inspectResult.warnings.length" class="warning-list">
              <div v-for="item in inspectResult.warnings" :key="item">· {{ item }}</div>
            </div>
          </template>
          <div v-else class="empty-inspect">选择一个目录后会在这里显示检查结果</div>
        </div>
      </div>

      <div v-if="importing" class="task-panel">
        <div class="task-line">
          <span>{{ stageText }}</span>
          <strong>{{ progress }}%</strong>
        </div>
        <el-progress :percentage="progress" :stroke-width="8" />
        <div class="task-meta">
          <span v-if="progressCountText">{{ progressCountText }}</span>
          <span v-if="detailMessage">{{ detailMessage }}</span>
        </div>
        <div v-if="currentItem" class="task-current" :title="currentItem">
          {{ currentItem }}
        </div>
        <div v-if="lastErrorMessage" class="task-error">
          {{ stageText }}：{{ lastErrorMessage }}
        </div>
      </div>
    </div>

    <span slot="footer" class="dialog-footer">
      <el-button :disabled="importing" @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="importing" :disabled="!canImport" @click="submitImport">
        引用导入
      </el-button>
    </span>

    <el-dialog
      title="添加挂载目录"
      :visible.sync="rootDialogVisible"
      width="760px"
      top="5vh"
      custom-class="mounted-root-picker-dialog"
      append-to-body
    >
      <div class="root-picker">
        <div class="mounted-toolbar">
          <el-input v-model="fsSelectedPath" size="small" class="root-path-input" placeholder="选择或输入后端可访问的目录" />
          <el-button size="small" :disabled="!fsParentPath || fsLoading" @click="goFsParent">
            <i class="el-icon-back"></i>
          </el-button>
          <el-button size="small" :loading="fsLoading" @click="loadFsEntries(fsPath)">刷新</el-button>
          <el-button size="small" type="primary" plain :disabled="!fsPath || fsLoading" @click="selectFsCurrent">
            选当前目录
          </el-button>
        </div>
        <div class="current-path">
          <span>当前位置</span>
          <strong>{{ fsPath || '文件系统根' }}</strong>
        </div>
        <div class="directory-list root-directory-list" v-loading="fsLoading">
          <div
            v-for="entry in fsEntries"
            :key="entry.path"
            class="directory-row"
            :class="{ selected: fsSelectedPath === entry.path }"
            @click="selectFsEntry(entry)"
            @dblclick="openFsEntry(entry)"
          >
            <i class="el-icon-folder"></i>
            <div class="directory-main">
              <div class="directory-name">{{ entry.name }}</div>
              <div class="directory-meta">{{ entry.path }}</div>
            </div>
            <el-button size="mini" type="text" :disabled="!entry.readable" @click.stop="openFsEntry(entry)">进入</el-button>
          </div>
          <div v-if="!fsEntries.length && !fsLoading" class="empty-list">当前目录没有可进入的子目录</div>
        </div>
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button :disabled="addRootSaving" @click="rootDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addRootSaving" :disabled="!fsSelectedPath" @click="submitRoot">
          添加并使用
        </el-button>
      </span>
    </el-dialog>
  </el-dialog>
</template>

<script>
import {
  createDatasetImportRoot,
  fetchDatasetImportEntries,
  fetchDatasetImportFsEntries,
  fetchDatasetImportRoots,
  inspectDatasetImportPath,
} from '@/api/datasetImports';
import { importIllegalDatasetFromPath } from '@/api/illegalDatasets';
import { importStandardDatasetFromPath } from '@/api/standardDatasets';
import { pollUploadTask } from '@/api/apiUtils';

const STAGE_LABELS = {
  queued: '正在排队...',
  extracting: '正在准备任务...',
  validating: '正在校验目录...',
  linking: '正在创建目录引用...',
  scanning: '正在扫描目录...',
  pairing: '正在配对图片和 JSON...',
  parsing: '正在解析 JSON 标签...',
  indexing: '正在生成索引...',
  finalizing: '正在收尾...',
  materializing: '正在切换版本...',
  done: '导入完成',
  failed: '导入失败',
};

export default {
  name: 'MountedImportDialog',
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    datasetId: {
      type: [String, Number],
      required: true,
    },
    datasetKind: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      default: 'upload',
    },
  },
  data() {
    return {
      roots: [],
      rootId: 'default',
      currentPath: '',
      parentPath: null,
      entries: [],
      selectedPath: null,
      inspectResult: null,
      loadingEntries: false,
      inspecting: false,
      importing: false,
      progress: 0,
      stage: '',
      processedCount: 0,
      totalCount: 0,
      currentItem: '',
      detailMessage: '',
      lastErrorMessage: '',
      rootDialogVisible: false,
      fsPath: '',
      fsParentPath: null,
      fsEntries: [],
      fsSelectedPath: '',
      fsLoading: false,
      addRootSaving: false,
    };
  },
  computed: {
    canGoParent() {
      return this.parentPath !== null && this.parentPath !== undefined;
    },
    canImport() {
      return this.selectedPath !== null && !this.importing && this.inspectResult && Number(this.inspectResult.image_count || 0) > 0;
    },
    stageText() {
      return STAGE_LABELS[this.stage] || this.stage || '正在导入...';
    },
    progressCountText() {
      const processed = Number(this.processedCount || 0);
      const total = Number(this.totalCount || 0);
      if (total > 0) return `${processed}/${total}`;
      if (processed > 0) return `已处理 ${processed}`;
      return '';
    },
  },
  methods: {
    async handleOpen() {
      await this.loadRoots();
      await this.loadEntries();
    },
    handleClose() {
      if (this.importing) return;
      this.$emit('update:visible', false);
    },
    closeDialog() {
      if (this.importing) return;
      this.$emit('update:visible', false);
    },
    async loadRoots() {
      try {
        this.roots = await fetchDatasetImportRoots();
        const current = (this.roots || []).find(item => item.root_id === this.rootId && item.exists && item.readable);
        const first = (this.roots || []).find(item => item.exists && item.readable);
        this.rootId = (current && current.root_id) || (first && first.root_id) || 'default';
      } catch (error) {
        this.$message.error(`加载导入根目录失败：${error.message || error}`);
      }
    },
    async handleRootChange() {
      this.currentPath = '';
      this.selectedPath = null;
      this.inspectResult = null;
      await this.loadEntries();
    },
    async loadEntries(path = this.currentPath) {
      this.loadingEntries = true;
      try {
        const data = await fetchDatasetImportEntries({ rootId: this.rootId, path });
        this.currentPath = data.path || '';
        this.parentPath = data.parent_path;
        this.entries = Array.isArray(data.entries) ? data.entries : [];
      } catch (error) {
        this.$message.error(`加载目录失败：${error.message || error}`);
      } finally {
        this.loadingEntries = false;
      }
    },
    async goParent() {
      if (!this.canGoParent) return;
      this.selectedPath = null;
      this.inspectResult = null;
      await this.loadEntries(this.parentPath || '');
    },
    async openEntry(entry) {
      if (!entry || !entry.is_dir) return;
      this.selectedPath = null;
      this.inspectResult = null;
      await this.loadEntries(entry.path);
    },
    async selectCurrent() {
      this.selectedPath = this.currentPath || '';
      await this.inspectSelected();
    },
    async selectEntry(entry) {
      if (!entry || !entry.is_dir) return;
      this.selectedPath = entry.path;
      await this.inspectSelected();
    },
    async inspectSelected() {
      if (this.selectedPath === null) return;
      this.inspecting = true;
      try {
        this.inspectResult = await inspectDatasetImportPath({ rootId: this.rootId, path: this.selectedPath });
      } catch (error) {
        this.inspectResult = null;
        this.$message.error(`检查目录失败：${error.message || error}`);
      } finally {
        this.inspecting = false;
      }
    },
    async openRootDialog() {
      this.rootDialogVisible = true;
      this.fsSelectedPath = '';
      this.fsPath = '';
      this.fsParentPath = null;
      this.fsEntries = [];
      await this.loadFsEntries('');
    },
    async loadFsEntries(path = this.fsPath) {
      this.fsLoading = true;
      try {
        const data = await fetchDatasetImportFsEntries({ path: path || '' });
        this.fsPath = data.path || '';
        this.fsParentPath = data.parent_path || null;
        this.fsEntries = Array.isArray(data.entries) ? data.entries : [];
      } catch (error) {
        this.$message.error(`加载目录失败：${error.message || error}`);
      } finally {
        this.fsLoading = false;
      }
    },
    async goFsParent() {
      if (!this.fsParentPath) return;
      await this.loadFsEntries(this.fsParentPath);
    },
    selectFsCurrent() {
      if (!this.fsPath) return;
      this.fsSelectedPath = this.fsPath;
    },
    selectFsEntry(entry) {
      if (!entry || !entry.path) return;
      this.fsSelectedPath = entry.path;
    },
    async openFsEntry(entry) {
      if (!entry || !entry.path || entry.readable === false) return;
      this.fsSelectedPath = entry.path;
      await this.loadFsEntries(entry.path);
    },
    async submitRoot() {
      if (!this.fsSelectedPath) return;
      this.addRootSaving = true;
      try {
        const root = await createDatasetImportRoot({ path: this.fsSelectedPath });
        this.$message.success('挂载目录已添加');
        this.rootDialogVisible = false;
        await this.loadRoots();
        if (root && root.root_id) {
          this.rootId = root.root_id;
        }
        this.currentPath = '';
        this.selectedPath = null;
        this.inspectResult = null;
        await this.loadEntries('');
      } catch (error) {
        this.$message.error(`添加挂载目录失败：${error.message || error}`);
      } finally {
        this.addRootSaving = false;
      }
    },
    formatLabel(value) {
      const map = {
        yolo: 'YOLO 数据集',
        json: '图片 + JSON 标注',
        images: '仅图片目录',
        unknown: '未识别',
      };
      return map[String(value || '')] || value || '-';
    },
    async submitImport() {
      if (!this.canImport) return;
      this.importing = true;
      this.progress = 0;
      this.stage = 'queued';
      this.processedCount = 0;
      this.totalCount = 0;
      this.currentItem = '';
      this.detailMessage = '';
      this.lastErrorMessage = '';
      try {
        const payload = {
          root_id: this.rootId,
          path: this.selectedPath,
          storage_strategy: 'link',
          mode: this.mode || 'upload',
        };
        const task = this.datasetKind === 'standard'
          ? await importStandardDatasetFromPath(this.datasetId, payload)
          : await importIllegalDatasetFromPath(this.datasetId, payload);
        const taskId = task && task.task_id;
        if (taskId) {
          await pollUploadTask(taskId, {
            interval: 1000,
            onStageChange: (stage, info) => {
              this.stage = stage;
              this.progress = Math.max(this.progress, Number(info && info.progress) || 0);
              this.processedCount = Number((info && (info.processedCount ?? info.processed_count)) || 0);
              this.totalCount = Number((info && (info.totalCount ?? info.total_count)) || 0);
              this.currentItem = String((info && (info.currentItem || info.current_item)) || '');
              this.detailMessage = String((info && (info.detailMessage || info.detail_message)) || '');
              this.lastErrorMessage = String((info && info.errorMessage) || '');
            },
          });
        }
        this.stage = 'done';
        this.progress = 100;
        this.$message.success('挂载目录导入完成');
        this.$emit('imported');
        this.$emit('update:visible', false);
      } catch (error) {
        this.stage = 'failed';
        this.lastErrorMessage = String(error && error.message || error || '');
        this.$message.error(`挂载目录导入失败：${error.message || error}`);
      } finally {
        this.importing = false;
      }
    },
  },
};
</script>

<style scoped>
.mounted-import {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.mounted-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.root-select {
  flex: 1;
}

.root-path-input {
  flex: 1;
}

.current-path {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #64748b;
  font-size: 13px;
}

.current-path strong {
  color: #0f172a;
  font-weight: 600;
}

.browser-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 12px;
  height: min(52vh, 480px);
  min-height: 300px;
  min-width: 0;
}

.directory-list,
.inspect-panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  overflow: auto;
  min-height: 0;
}

.directory-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
}

.directory-row:hover,
.directory-row.selected {
  background: #eff6ff;
}

.directory-row.candidate .directory-name {
  color: #0369a1;
}

.directory-main {
  min-width: 0;
  flex: 1;
}

.directory-name {
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-meta {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 12px;
}

.inspect-panel {
  padding: 14px;
}

.inspect-title {
  color: #64748b;
  font-size: 13px;
}

.inspect-format {
  margin-top: 8px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 700;
}

.inspect-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  color: #334155;
}

.inspect-path {
  margin-top: 12px;
  color: #64748b;
  word-break: break-all;
  font-size: 12px;
}

.warning-list {
  margin-top: 12px;
  color: #b45309;
  font-size: 12px;
  line-height: 1.6;
}

.empty-list,
.empty-inspect {
  padding: 20px;
  color: #94a3b8;
  text-align: center;
}

.task-panel {
  padding: 12px;
  border-radius: 8px;
  background: #f8fafc;
}

.task-line {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #334155;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.task-current {
  margin-top: 6px;
  color: #475569;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-error {
  margin-top: 8px;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
}

.root-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.root-directory-list {
  height: min(52vh, 460px);
  min-height: 300px;
}

:deep(.mounted-import-dialog),
:deep(.mounted-root-picker-dialog) {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.mounted-import-dialog .el-dialog__body),
:deep(.mounted-root-picker-dialog .el-dialog__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

:deep(.mounted-import-dialog .el-dialog__footer),
:deep(.mounted-root-picker-dialog .el-dialog__footer) {
  flex-shrink: 0;
}
</style>
