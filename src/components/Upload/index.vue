<template>
  <div class="UploadZip">
    <div class="file-upload-container">
      <div class="upload-card">
        <!-- Header -->
        <div class="upload-header">
          <div class="icon-ring">
            <i class="el-icon-upload cloud-icon"></i>
          </div>
          <h3 class="upload-title">上传数据集压缩包</h3>
          <p class="upload-subtitle">支持上传包含图片和标注的 .zip 格式文件</p>
        </div>

        <!-- Resume Notification -->
        <transition name="fade">
          <div v-if="resumeAvailable && !isUploading" class="resume-banner">
            <div class="resume-content">
              <i class="el-icon-refresh"></i>
              <span>检测到可恢复的上传会话，将跳过已上传的分片</span>
            </div>
            <button class="resume-dismiss" type="button" @click="dismissResume">
              <i class="el-icon-close"></i>
            </button>
          </div>
        </transition>

        <!-- Drop Area -->
        <div
          class="drop-area"
          :class="{ 'is-dragover': isDragover, 'has-file': !!selectedFile, 'is-uploading': isUploading }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="!isUploading && $refs.fileInput.click()"
        >
          <input
            type="file"
            id="fileInput"
            ref="fileInput"
            accept=".zip"
            @change="handleFileSelect"
            class="hidden"
            @click.stop
            :disabled="isUploading"
          />

          <!-- Idle State -->
          <div v-if="!selectedFile && !isUploading" class="upload-label-idle">
            <div class="upload-icon-wrapper">
              <i class="el-icon-plus add-icon"></i>
            </div>
            <p class="primary-text">点击或拖拽文件到此处</p>
            <p class="secondary-text">仅支持 .zip 格式文件，请保持原有目录结构</p>
          </div>

          <!-- File Selected State -->
          <div v-else-if="selectedFile && !isUploading" class="selected-file-card">
            <div class="file-icon-box">
              <i class="el-icon-document-copy file-icon"></i>
            </div>
            <div class="file-info">
              <p class="file-name truncate" :title="selectedFile.name">{{ selectedFile.name }}</p>
              <p class="file-size">{{ formatSize(selectedFile.size) }}</p>
            </div>
            <div class="file-action" @click.stop="clearFile">
              <i class="el-icon-close remove-icon"></i>
            </div>
          </div>

          <!-- Uploading State -->
          <div v-if="isUploading" class="uploading-state">
            <div class="upload-status-header">
              <span class="status-text">{{ stageDisplayLabel }}</span>
              <span class="status-percent">{{ displayProgress }}%</span>
            </div>

            <div class="progress-track">
              <div
                class="progress-fill"
                :class="{ 'processing': displayProgress === 100 && isProcessing }"
                :style="{ width: displayProgress + '%' }"
              ></div>
            </div>

            <p v-if="selectedFile" class="uploading-filename truncate">{{ selectedFile.name }}</p>
            <p v-else-if="resumedFileName" class="uploading-filename truncate">{{ resumedFileName }}</p>

            <!-- 取消按钮 -->
            <div class="cancel-row">
              <button class="btn-cancel" type="button" @click="cancelUpload">
                <i class="el-icon-close"></i> 取消上传
              </button>
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        <transition name="fade">
          <div v-if="errorMessage && !isUploading" class="error-banner">
            <i class="el-icon-warning"></i>
            <span>{{ errorMessage }}</span>
          </div>
        </transition>

        <!-- Actions -->
        <div class="action-footer">
          <button
            class="btn-upload"
            :class="{ 'is-loading': isUploading, 'is-disabled': !selectedFile || isUploading || !datasetId }"
            :disabled="!selectedFile || isUploading || !datasetId"
            @click="uploadFile"
          >
            <i v-if="isUploading" class="el-icon-loading btn-icon"></i>
            <i v-else class="el-icon-upload2 btn-icon"></i>
            <span>{{ isUploading ? '上传中...' : (resumeAvailable ? '恢复上传' : '开始上传') }}</span>
          </button>
        </div>
        
        <!-- Success State Overlay -->
        <transition name="zoom">
          <div v-if="uploadSuccess" class="success-overlay">
            <div class="success-content">
              <div class="check-circle">
                <i class="el-icon-check check-icon"></i>
              </div>
              <h4 class="success-title">上传成功</h4>
              <p class="success-desc">数据集文件已成功上传并开始处理</p>
            </div>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>


<script>
import {
  uploadIllegalDatasetChunked,
} from '@/api/illegalDatasets';
import {
  uploadStandardDatasetChunked,
} from '@/api/standardDatasets';
import {
  pollUploadTask,
  saveUploadSession,
  clearUploadSession,
  findResumableSession,
  saveUploadTask,
  loadUploadTask,
  clearUploadTask,
} from '@/api/apiUtils';

const DATASET_KIND_ILLEGAL = 'illegal';
const DATASET_KIND_STANDARD = 'standard';

// 服务端处理阶段 → 中文标签映射
const STAGE_LABELS = {
  creating: '正在创建上传会话...',
  resuming: '正在恢复上传会话...',
  uploading: '正在上传分片...',
  completing: '正在合并分片...',
  queued: '正在排队等待处理...',
  extracting: '正在解压数据集...',
  validating: '正在校验数据内容...',
  materializing: '正在写入数据集文件...',
  indexing: '正在建立图片索引...',
  finalizing: '正在完成导入...',
  done: '处理完成',
  failed: '处理失败',
  cancelled: '已取消',
};

// 终态阶段
const TERMINAL_STAGES = ['done', 'failed', 'cancelled'];

export default {
  name: 'UploadZip',
  props: {
    datasetId: {
      type: [String, Number],
      required: true,
    },
    datasetKind: {
      type: String,
      default: '',
    },
    mode: {
      type: String,
      default: 'upload',
    },
    isIllegal: {
      type: Boolean,
      default: false,
    },
    externalFile: {
      type: [File, Object],
      default: null,
    },
    externalUploading: {
      type: Boolean,
      default: null,
    },
    externalProgress: {
      type: Number,
      default: null,
    },
  },
  data() {
    return {
      internalFile: null,
      isDragover: false,
      errorMessage: '',
      internalUploading: false,
      internalProgress: 0,
      uploadStage: 'idle',
      cancelUploadRequest: null,
      uploadSuccess: false,
      successTimer: null,
      // 分片上传扩展状态
      serverStage: '',
      serverStageMessage: '',
      serverProgress: 0,
      uploadAbortController: null,
      pollAbortController: null,
      taskId: null,
      currentSessionId: null,
      cancelRequested: false,
      cancelEventSent: false,
      resumeAvailable: false,
      resumeSessionId: null,
      resumeInfo: null,
      resumedFileName: '',
    };
  },
  computed: {
    selectedFile: {
      get() {
        return this.externalFile !== null ? this.externalFile : this.internalFile;
      },
      set(val) {
        this.internalFile = val;
        this.$emit('update:externalFile', val);
      },
    },
    isUploading: {
      get() {
        return this.externalUploading !== null ? this.externalUploading : this.internalUploading;
      },
      set(val) {
        this.internalUploading = val;
        this.$emit('update:externalUploading', val);
      },
    },
    progress: {
      get() {
        return this.externalProgress !== null ? this.externalProgress : this.internalProgress;
      },
      set(val) {
        this.internalProgress = val;
        this.$emit('update:externalProgress', val);
      },
    },
    resolvedDatasetKind() {
      const kind = String(this.datasetKind || '').trim().toLowerCase();
      if (kind === DATASET_KIND_STANDARD) return DATASET_KIND_STANDARD;
      if (kind === DATASET_KIND_ILLEGAL) return DATASET_KIND_ILLEGAL;
      return this.isIllegal ? DATASET_KIND_ILLEGAL : DATASET_KIND_STANDARD;
    },
    resolvedMode() {
      const mode = String(this.mode || 'upload').trim().toLowerCase();
      if (this.resolvedDatasetKind === DATASET_KIND_ILLEGAL && mode === 'append') return 'append';
      return 'upload';
    },
    isProcessing() {
      return this.serverStage && !TERMINAL_STAGES.includes(this.serverStage);
    },
    isServerTaskActive() {
      return !!this.taskId;
    },
    displayProgress() {
      const raw = this.isServerTaskActive ? this.serverProgress : this.progress;
      const value = Math.round(Number(raw) || 0);
      return Math.max(0, Math.min(100, value));
    },
    stageDisplayLabel() {
      return STAGE_LABELS[this.serverStage] || this.serverStageMessage || '处理中...';
    },
  },
  mounted() {
    this.tryAutoResumeTask();
  },
  beforeDestroy() {
    if (this.successTimer) clearTimeout(this.successTimer);
    this.abortAll();
  },
  methods: {
    // ── helpers ──────────────────────────────────────────────────────────

    formatSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    translateError(error) {
      const msg = error && error.message ? String(error.message) : '上传失败';
      // 网络中断
      if (msg.toLowerCase().includes('network error') || msg.includes('NetworkError')
          || msg.includes('Failed to fetch') || msg.includes('TypeError')) {
        return { title: '网络连接中断', detail: '请检查网络后重试，已上传的分片不会丢失', canRetry: true };
      }
      // 取消
      if (msg.includes('取消') || msg.includes('cancel') || msg.includes('abort')) {
        return { title: '已取消上传', detail: msg, canRetry: false };
      }
      // 合并失败
      if (msg.includes('merge') || msg.includes('completing') || msg.includes('合并')) {
        return { title: '分片合并失败', detail: msg, canRetry: false };
      }
      // 解压失败
      if (msg.includes('extract') || msg.includes('zip') || msg.includes('解压') || msg.includes('corrupt')) {
        return { title: '解压失败', detail: 'ZIP 文件可能已损坏或格式不支持: ' + msg, canRetry: true };
      }
      // 磁盘空间
      if (msg.includes('disk') || msg.includes('space') || msg.includes('空间')) {
        return { title: '磁盘空间不足', detail: msg, canRetry: false };
      }
      // 409 conflict
      if (msg.includes('409') || msg.includes('conflict') || msg.includes('不可变')) {
        return { title: '数据集不可变更', detail: msg, canRetry: false };
      }
      // 分片上传失败
      if (msg.includes('分片') || msg.includes('part')) {
        return { title: '分片上传失败', detail: msg, canRetry: true };
      }
      // 通用错误
      return { title: '上传失败', detail: msg, canRetry: true };
    },

    abortAll() {
      if (this.uploadAbortController) {
        try { this.uploadAbortController.abort(); } catch (_) { /* ignore */ }
        this.uploadAbortController = null;
      }
      if (this.pollAbortController) {
        try { this.pollAbortController.abort(); } catch (_) { /* ignore */ }
        this.pollAbortController = null;
      }
    },

    resetState() {
      this.errorMessage = '';
      this.serverStage = '';
      this.serverStageMessage = '';
      this.serverProgress = 0;
      this.taskId = null;
      this.currentSessionId = null;
      this.cancelRequested = false;
      this.cancelEventSent = false;
      this.resumeAvailable = false;
      this.resumeSessionId = null;
      this.resumeInfo = null;
      this.resumedFileName = '';
    },

    isCancelledUpload(error) {
      if (this.cancelRequested) return true;
      const msg = error && error.message ? String(error.message) : String(error || '');
      const lower = msg.toLowerCase();
      return msg.includes('取消') || lower.includes('cancel') || lower.includes('abort');
    },

    emitUploadCancel(detail = '用户取消') {
      if (this.cancelEventSent) return;
      this.cancelEventSent = true;
      this.$emit('upload-cancel', {
        title: '已取消上传',
        detail,
        canRetry: false,
        raw: 'cancelled',
      });
    },

    // ── file handling ─────────────────────────────────────────────────────

    clearFile() {
      this.selectedFile = null;
      this.errorMessage = '';
      this.resetState();
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    handleFileSelect(event) {
      const file = event.target.files[0];
      this.validateAndSetFile(file);
    },

    handleDragOver(event) {
      if (this.isUploading) return;
      event.preventDefault();
      this.isDragover = true;
    },

    handleDragLeave() {
      this.isDragover = false;
    },

    handleDrop(event) {
      if (this.isUploading) return;
      event.preventDefault();
      this.isDragover = false;
      if (event.dataTransfer.files.length) {
        this.validateAndSetFile(event.dataTransfer.files[0]);
      }
    },

    validateAndSetFile(file) {
      this.errorMessage = '';
      this.uploadSuccess = false;
      this.resetState();
      if (!file) {
        this.selectedFile = null;
        return;
      }
      if (!String(file.name || '').toLowerCase().endsWith('.zip')) {
        this.errorMessage = '请上传 .zip 格式的压缩文件';
        this.selectedFile = null;
        return;
      }
      this.selectedFile = file;
      // 检查是否有可恢复的会话
      this.checkResumableSession(file);
    },

    checkResumableSession(file) {
      const found = findResumableSession({
        datasetId: this.datasetId,
        datasetKind: this.resolvedDatasetKind,
        fileName: file.name,
        fileSize: file.size,
      });
      if (found) {
        this.resumeAvailable = true;
        this.resumeSessionId = found.sessionId;
        this.resumeInfo = found.info;
      } else {
        this.resumeAvailable = false;
        this.resumeSessionId = null;
        this.resumeInfo = null;
      }
    },

    dismissResume() {
      this.resumeAvailable = false;
      this.resumeSessionId = null;
      this.resumeInfo = null;
    },

    // ── upload ────────────────────────────────────────────────────────────

    getUploader() {
      if (this.resolvedDatasetKind === DATASET_KIND_ILLEGAL) {
        return uploadIllegalDatasetChunked;
      }
      return uploadStandardDatasetChunked;
    },

    async uploadFile() {
      if (!this.selectedFile) return;
      if (!this.datasetId) {
        this.errorMessage = '请先创建并保存数据集';
        return;
      }

      this.isUploading = true;
      this.progress = 0;
      this.uploadStage = 'uploading';
      this.uploadSuccess = false;
      this.errorMessage = '';
      this.serverStage = '';
      this.serverStageMessage = '';
      this.serverProgress = 0;
      this.taskId = null;
      this.cancelRequested = false;
      this.cancelEventSent = false;

      // 中断之前的操作
      this.abortAll();
      this.uploadAbortController = new AbortController();

      const useResume = this.resumeAvailable && this.resumeSessionId;
      this.dismissResume();

      try {
        const uploadFn = this.getUploader();

        // 构建额外参数
        const extraOpts = {};
        if (this.resolvedMode === 'append') {
          extraOpts.mode = 'append';
        }

        const req = uploadFn(this.datasetId, this.selectedFile, {
          ...extraOpts,
          signal: this.uploadAbortController.signal,
          resumeSessionId: useResume ? this.resumeSessionId : null,
          onProgress: ({ loaded, total, percent }) => {
            const l = Number(loaded) || 0;
            const t = Number(total) || 0;
            const pct = percent !== null && percent !== undefined
              ? Number(percent) || 0
              : (t > 0 ? Math.round((l / t) * 100) : 0);
            this.progress = Math.max(0, Math.min(100, pct));
          },
          onUploadDone: () => {
            this.uploadStage = 'processing';
            this.progress = Math.max(this.progress, 100);
          },
          onStageChange: (stage, info) => {
            this.serverStage = stage;
            this.serverStageMessage = String(info && info.message || '');
          },
          onSessionCreated: (info) => {
            // 保存会话信息到 localStorage 以便断点续传
            if (info && info.sessionId) {
              this.currentSessionId = info.sessionId;
              saveUploadSession(info.sessionId, {
                datasetId: String(this.datasetId),
                datasetKind: this.resolvedDatasetKind,
                fileName: this.selectedFile.name,
                fileSize: this.selectedFile.size,
                mode: this.resolvedMode,
              });
            }
          },
          onTaskReady: (taskId) => {
            this.taskId = taskId;
            this.serverStage = 'queued';
            this.serverStageMessage = STAGE_LABELS.queued;
            this.serverProgress = 0;
            // 持久化任务信息，页面刷新后可恢复轮询
            saveUploadTask(this.datasetId, this.resolvedDatasetKind, taskId, {
              sessionId: this.currentSessionId,
              fileName: this.selectedFile.name,
              fileSize: this.selectedFile.size,
              mode: this.resolvedMode,
            });
            // 启动任务轮询
            this.startPolling(taskId);
          },
        });

        this.cancelUploadRequest = req.cancel;
        await req.promise;

        // 如果没有 task_id（后端未实现），直接视为成功
        if (!this.taskId) {
          this.handleFinalSuccess();
        }
      } catch (error) {
        this.abortAll();
        // 上传失败，清理持久化（未到 task 阶段不清理 task，仅清理 session）
        if (this.currentSessionId && !this.taskId) {
          clearUploadSession(this.currentSessionId);
        }
        const { title, detail, canRetry } = this.translateError(error);
        this.isUploading = false;
        if (this.isCancelledUpload(error) || title === '已取消上传') {
          this.serverStage = 'cancelled';
          this.serverStageMessage = STAGE_LABELS.cancelled;
          this.errorMessage = title;
          this.emitUploadCancel(detail);
          return;
        }
        this.errorMessage = `${title}: ${detail}`;
        this.$emit('upload-fail', { title, detail, canRetry, raw: error });
      } finally {
        this.cancelUploadRequest = null;
        this.uploadAbortController = null;
      }
    },

    async startPolling(taskId) {
      this.pollAbortController = new AbortController();
      try {
        await pollUploadTask(taskId, {
          signal: this.pollAbortController.signal,
          interval: 2000,
          onStageChange: (stage, info) => {
            this.serverStage = stage;
            this.serverStageMessage = STAGE_LABELS[stage] || String(info && info.message || '处理中...');
            this.serverProgress = Math.max(0, Math.min(100, Number(info && info.progress) || 0));
          },
        });
        // 任务成功完成
        this.serverStage = 'done';
        this.serverStageMessage = STAGE_LABELS.done;
        this.handleFinalSuccess();
      } catch (error) {
        // 任务失败或轮询中断
        const msg = error && error.message ? String(error.message) : '处理失败';
        if (msg.includes('取消')) {
          this.serverStage = 'cancelled';
          this.serverStageMessage = '已取消处理';
          this.isUploading = false;
          clearUploadTask(this.datasetId, this.resolvedDatasetKind);
          return;
        }
        this.serverStage = 'failed';
        this.serverStageMessage = msg;
        this.isUploading = false;
        this.errorMessage = `服务端处理失败: ${msg}`;
        // 任务终态为 failed，清理持久化
        clearUploadTask(this.datasetId, this.resolvedDatasetKind);
        this.$emit('upload-fail', { title: '服务端处理失败', detail: msg, canRetry: false, raw: error });
      } finally {
        this.pollAbortController = null;
      }
    },

    async tryAutoResumeTask() {
      // 页面刷新后，检查是否有正在处理的任务
      const saved = loadUploadTask(this.datasetId, this.resolvedDatasetKind);
      if (!saved || !saved.taskId) return;

      // 有活跃任务，尝试恢复轮询
      this.isUploading = true;
      this.progress = 100;
      this.serverProgress = 0;
      this.uploadStage = 'processing';
      this.serverStage = 'queued';
      this.serverStageMessage = '正在恢复任务状态...';
      this.taskId = saved.taskId;
      this.currentSessionId = saved.sessionId || null;
      this.resumedFileName = saved.fileName || '';

      this.$nextTick(() => {
        this.startPolling(saved.taskId);
      });
    },

    handleFinalSuccess() {
      this.isUploading = false;
      this.progress = 100;
      this.serverProgress = 100;
      this.uploadSuccess = true;
      this.serverStage = 'done';

      // 清理 localStorage 中的会话和任务
      if (this.currentSessionId) {
        clearUploadSession(this.currentSessionId);
      }
      clearUploadTask(this.datasetId, this.resolvedDatasetKind);

      this.successTimer = setTimeout(() => {
        this.uploadSuccess = false;
        this.clearFile();
      }, 3000);
      this.$emit('upload-success', this.datasetId);
    },

    cancelUpload() {
      this.cancelRequested = true;
      this.abortAll();
      if (typeof this.cancelUploadRequest === 'function') {
        try { this.cancelUploadRequest(); } catch (_) { /* ignore */ }
      }
      // 清理持久化状态
      if (this.currentSessionId) {
        clearUploadSession(this.currentSessionId);
      }
      clearUploadTask(this.datasetId, this.resolvedDatasetKind);
      this.isUploading = false;
      this.serverStage = 'cancelled';
      this.serverStageMessage = STAGE_LABELS.cancelled;
      this.errorMessage = '已取消上传';
      this.emitUploadCancel();
    },
  },
};
</script>


<style scoped>
.file-upload-container {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.upload-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 32px;
  width: 100%;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
  position: relative;
  overflow: hidden;
}

/* Header */
.upload-header {
  text-align: center;
  margin-bottom: 24px;
}
.icon-ring {
  width: 56px;
  height: 56px;
  background: #eff6ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}
.cloud-icon {
  font-size: 28px;
  color: #3b82f6;
  animation: float 3s ease-in-out infinite;
}
.upload-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
}
.upload-subtitle {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0;
}

/* Drop Area */
.drop-area {
  background: #fafbfd;
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}
.drop-area:hover:not(.has-file):not(.is-uploading) {
  border-color: #93c5fd;
  background: #eff6ff;
}
.drop-area.is-dragover {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: scale(1.02);
}
.drop-area.has-file:not(.is-uploading) {
  border: 2px solid #e2e8f0;
  padding: 16px;
  background: #fff;
  cursor: default;
}
.drop-area.is-uploading {
  border: 2px solid transparent;
  background: #f8fafc;
  cursor: not-allowed;
  padding: 24px;
}
.hidden {
  display: none;
}

/* Idle State */
.upload-label-idle {
  pointer-events: none;
}
.upload-icon-wrapper {
  width: 40px;
  height: 40px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.add-icon {
  font-size: 18px;
  color: #94a3b8;
  transition: color 0.3s;
}
.drop-area:hover .add-icon {
  color: #3b82f6;
}
.primary-text {
  font-size: 0.95rem;
  font-weight: 500;
  color: #334155;
  margin: 0 0 4px 0;
}
.secondary-text {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
}

/* File Selected State */
.selected-file-card {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
.file-icon-box {
  width: 40px;
  height: 40px;
  background: #e0e7ff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}
.file-icon {
  font-size: 20px;
  color: #4f46e5;
}
.file-info {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.file-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #1e293b;
  margin: 0 0 2px 0;
}
.file-size {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}
.file-action {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  color: #94a3b8;
  transition: all 0.2s;
}
.file-action:hover {
  background: #fee2e2;
  color: #ef4444;
}

/* Uploading State */
.uploading-state {
  width: 100%;
}
.upload-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.status-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: #1e293b;
}
.status-percent {
  font-size: 0.85rem;
  font-weight: 600;
  color: #3b82f6;
  font-variant-numeric: tabular-nums;
}
.progress-track {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
  background-size: 200% 100%;
  border-radius: 4px;
  transition: width 0.3s ease-out;
  animation: shimmer 2s linear infinite;
}
.progress-fill.processing {
  background: linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent);
  background-color: #10b981;
  background-size: 1rem 1rem;
  animation: stripe 1s linear infinite;
}
.uploading-filename {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
  text-align: left;
}

/* Error Banner */
.error-banner {
  margin-top: 16px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #b91c1c;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Actions */
.action-footer {
  margin-top: 24px;
}
.btn-upload {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.btn-upload:hover:not(.is-disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
  background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
}
.btn-upload:active:not(.is-disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
}
.btn-upload.is-disabled {
  background: #cbd5e1;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.8;
}
.btn-icon {
  font-size: 1.1rem;
}

/* Success Overlay */
.success-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.success-content {
  text-align: center;
}
.check-circle {
  width: 64px;
  height: 64px;
  background: #10b981;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.1);
  animation: scale-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.check-icon {
  font-size: 32px;
  color: white;
  font-weight: bold;
}
.success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}
.success-desc {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0;
}

/* Animations */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes shimmer {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes stripe {
  0% { background-position: 1rem 0; }
  100% { background-position: 0 0; }
}
@keyframes scale-in {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.zoom-enter-active, .zoom-leave-active {
  transition: opacity 0.3s, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.zoom-enter, .zoom-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Resume Banner */
.resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 8px;
  font-size: 0.85rem;
  color: #1d4ed8;
}
.resume-content {
  display: flex;
  align-items: center;
  gap: 8px;
}
.resume-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  border-radius: 4px;
  font-size: 14px;
}
.resume-dismiss:hover {
  background: #dbeafe;
  color: #1d4ed8;
}

/* Cancel Button */
.cancel-row {
  margin-top: 12px;
  text-align: center;
}
.btn-cancel {
  padding: 6px 16px;
  background: #fff;
  color: #ef4444;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}
.btn-cancel:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

/* Utils */
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
