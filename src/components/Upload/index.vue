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
              <span class="status-text">{{ progress === 100 ? '正在处理...' : '正在上传...' }}</span>
              <span class="status-percent">{{ progress }}%</span>
            </div>
            
            <div class="progress-track">
              <div 
                class="progress-fill" 
                :class="{ 'processing': progress === 100 }"
                :style="{ width: progress + '%' }"
              ></div>
            </div>
            
            <p class="uploading-filename truncate">{{ selectedFile.name }}</p>
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
            <span>{{ isUploading ? '上传中...' : '开始上传' }}</span>
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
import { uploadIllegalDatasetArchive } from '@/api/illegalDatasets';
import { uploadStandardDatasetArchive } from '@/api/standardDatasets';

export default {
  name: "UploadZip",
  props: {
    datasetId: {
      type: [String, Number],
      required: true
    },
    isIllegal: {
      type: Boolean,
      default: false
    },
    // 支持外部状态管理
    externalFile: {
      type: [File, Object],
      default: null
    },
    externalUploading: {
      type: Boolean,
      default: null
    },
    externalProgress: {
      type: Number,
      default: null
    }
  },
  data() {
    return {
      internalFile: null,
      isDragover: false,
      errorMessage: "",
      internalUploading: false,
      internalProgress: 0,
      uploadStage: "idle", // idle | uploading | processing
      cancelUploadRequest: null,
      uploadSuccess: false,
      successTimer: null,
    };
  },
  computed: {
    // 优先使用外部状态，否则使用内部状态
    selectedFile: {
      get() {
        return this.externalFile !== null ? this.externalFile : this.internalFile;
      },
      set(val) {
        this.internalFile = val;
        this.$emit('update:externalFile', val);
      }
    },
    isUploading: {
      get() {
        return this.externalUploading !== null ? this.externalUploading : this.internalUploading;
      },
      set(val) {
        this.internalUploading = val;
        this.$emit('update:externalUploading', val);
      }
    },
    progress: {
      get() {
        return this.externalProgress !== null ? this.externalProgress : this.internalProgress;
      },
      set(val) {
        this.internalProgress = val;
        this.$emit('update:externalProgress', val);
      }
    }
  },
  beforeDestroy() {
    if (this.successTimer) clearTimeout(this.successTimer);
  },
  methods: {
    formatSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    clearFile() {
      this.selectedFile = null;
      this.errorMessage = "";
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = "";
      }
    },

    // 处理文件选择
    handleFileSelect(event) {
      const file = event.target.files[0];
      this.validateAndSetFile(file);
    },

    // 处理拖放事件
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
        const file = event.dataTransfer.files[0];
        this.validateAndSetFile(file);
      }
    },

    // 验证并设置文件
    validateAndSetFile(file) {
      this.errorMessage = "";
      this.uploadSuccess = false;

      if (!file) {
        this.selectedFile = null;
        return;
      }

      // 验证文件类型
      if (!file.name.endsWith(".zip")) {
        this.errorMessage = "请上传 .zip 格式的压缩文件";
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
    },

    // 上传文件 - 使用API接口
    async uploadFile() {
      if (!this.selectedFile) return;
      if (!this.datasetId) {
        this.errorMessage = "请先创建并保存数据集";
        return;
      }

      this.isUploading = true;
      this.progress = 0;
      this.uploadStage = "uploading";
      this.cancelUploadRequest = null;
      this.uploadSuccess = false;
      this.errorMessage = "";

      try {
        const uploadFn = this.isIllegal ? uploadIllegalDatasetArchive : uploadStandardDatasetArchive;
        const req = uploadFn(this.datasetId, this.selectedFile, {
          onProgress: ({ loaded, total, percent }) => {
            const l = Number(loaded) || 0;
            const t = Number(total) || 0;
            const pct = (percent !== null && percent !== undefined)
              ? Number(percent) || 0
              : (t > 0 ? Math.round((l / t) * 100) : 0);
            this.progress = Math.max(0, Math.min(100, pct));
          },
          onUploadDone: () => {
            this.uploadStage = "processing";
            this.progress = Math.max(this.progress, 100);
          },
        });
        this.cancelUploadRequest = req.cancel;

        const result = await req.promise;

        const payload = result && (result.dataset || result.data || result);
        const returnedId = payload && (payload.dataset_id || payload.id);
        const displayId = returnedId || this.datasetId;
        
        // 上传成功处理
        this.isUploading = false;
        this.progress = 100;
        this.uploadSuccess = true;
        
        // 自动隐藏成功弹窗
        this.successTimer = setTimeout(() => {
          this.uploadSuccess = false;
          this.clearFile();
        }, 3000);
        
        // 通知父组件上传成功
        this.$emit('upload-success', this.datasetId);
      } catch (error) {
        // 上传失败处理
        this.isUploading = false;
        this.uploadSuccess = false;
        const msg = error && error.message ? String(error.message) : '上传失败';
        if (msg.toLowerCase().includes('cancel')) {
          this.errorMessage = '已取消上传';
          this.$emit('upload-fail', 'cancelled');
        } else {
          this.errorMessage = `上传失败: ${msg}`;
          this.$emit('upload-fail', msg);
        }
      } finally {
        this.cancelUploadRequest = null;
        this.uploadStage = "idle";
      }
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

/* Utils */
.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
