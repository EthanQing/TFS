<template>
  <div class="conversion-container">
    <div class="header-strip">
      <div class="header-left">
        <div class="icon-wrapper">
          <i class="el-icon-folder-opened tool-icon"></i>
        </div>
        <div>
          <h3 class="page-title">数据转换服务</h3>
          <p class="subtitle">支持图像与标注文件的格式转换，生成标准 YOLO 训练数据。</p>
        </div>
      </div>
      <div class="header-actions">
        <el-button size="small" @click="handleReset" :disabled="converting || uploadingDataset">
          <i class="el-icon-refresh-right"></i> 重置任务
        </el-button>
        <el-button
          type="primary"
          size="small"
          class="primary-btn"
          @click="startConversion"
          :loading="converting"
          :disabled="!uploadFile || uploadingDataset"
        >
          <i class="el-icon-cpu"></i> {{ converting ? "正在执行..." : "开始执行" }}
        </el-button>
      </div>
    </div>

    <div class="content-wrapper">
      <!-- Config -->
      <div class="config-panel glass-panel-sm">
        <div class="panel-header">
          <i class="el-icon-upload"></i> 导入源数据
        </div>

        <div class="config-form">
          <div class="form-row">
            <label class="form-label">目标格式</label>
            <el-radio-group v-model="targetFormat" size="small" :disabled="converting || uploadingDataset">
              <el-radio label="yolo" border>YOLO (TXT)</el-radio>
              <el-radio label="coco" border>COCO (JSON)</el-radio>
            </el-radio-group>
          </div>

          <div class="form-row upload-row">
            <label class="form-label">压缩包文件</label>
            <el-upload
              class="upload-area"
              drag
              action="#"
              :auto-upload="false"
              :on-change="handleFileChange"
              :show-file-list="false"
              :disabled="converting || uploadingDataset"
              accept=".zip"
            >
              <div v-if="!uploadFile" class="upload-placeholder">
                <i class="el-icon-upload cloud-icon"></i>
                <div class="upload-text">点击或拖拽 ZIP 文件至此区域</div>
              </div>
              <div v-else class="upload-file">
                <div class="file-icon-wrapper">
                  <i class="el-icon-document"></i>
                </div>
                <div class="file-info">
                  <span class="filename" :title="uploadFile.name">{{ uploadFile.name }}</span>
                  <span class="filesize" v-if="uploadFile.size">{{ (uploadFile.size / 1024 / 1024).toFixed(2) }} MB</span>
                </div>
                <i class="el-icon-close remove-btn" @click.stop="removeFile"></i>
              </div>
            </el-upload>
          </div>

          <div class="hint-box">
             <i class="el-icon-info"></i>
             <span>仅支持 ZIP 格式。请确保压缩包内包含图片及对应的 JSON 标注文件。</span>
          </div>
        </div>
      </div>

      <!-- Progress -->
      <div class="progress-panel glass-panel-sm">
        <div class="panel-header">
          <i class="el-icon-monitor"></i> 任务状态
        </div>

        <div v-if="jobId" class="progress-body">
          <div class="status-card">
            <div class="status-header">
              <span class="status-label">当前状态</span>
              <el-tag size="small" :type="statusType">{{ statusLabel }}</el-tag>
            </div>
            <div class="progress-bar-wrapper">
              <el-progress 
                :percentage="progress" 
                :color="progressColor" 
                :stroke-width="8"
                :show-text="false"
              ></el-progress>
              <div class="progress-info">
                 <span v-if="stageLabel">{{ stageLabel }}</span>
                 <span v-if="hasCounts">{{ processed }} / {{ total }}</span>
                 <span v-else>{{ progress }}%</span>
              </div>
            </div>
          </div>

          <div class="logs-container">
            <div class="logs-header">运行日志</div>
            <div class="logs-content" ref="logsContainer">
               <div v-for="(log, index) in logs" :key="index" class="log-line">{{ log }}</div>
            </div>
          </div>

          <div class="result-actions" v-if="isCompleted">
            <el-button type="primary" plain @click="downloadResult" :disabled="!outputUrl" size="small">
              <i class="el-icon-download"></i> 下载结果
            </el-button>
          </div>
        </div>

        <div v-else class="empty-state">
          <div class="empty-icon-wrapper">
            <i class="el-icon-data-line"></i>
          </div>
          <p>任务未开始</p>
          <span class="empty-desc">请上传文件并点击“开始执行”</span>
        </div>
      </div>

      <!-- Upload to datasets -->
      <div class="result-panel glass-panel-sm">
        <div class="panel-header">
          <i class="el-icon-upload2"></i> 入库操作
        </div>

        <div class="config-form">
          <div class="form-row">
            <label class="form-label">数据集名称</label>
            <el-input 
              v-model="datasetName" 
              placeholder="请输入数据集名称" 
              :disabled="!isCompleted || uploadingDataset"
              size="small"
            ></el-input>
          </div>

          <div class="form-row">
            <label class="form-label">任务类型</label>
            <el-tag type="info" effect="plain" size="small">
              {{ targetFormat === "coco" ? "通用数据 (COCO)" : "目标检测 (YOLO)" }}
            </el-tag>
          </div>

          <div class="form-row action-row">
            <el-button
              type="primary"
              @click="uploadToDatasets"
              :loading="uploadingDataset"
              :disabled="!isCompleted || !outputUrl || !datasetName"
              size="small"
              class="full-width-btn"
            >
              <i class="el-icon-check"></i> 保存至数据集
            </el-button>
          </div>

          <div v-if="uploadingDataset || uploadProgress > 0" class="upload-progress-wrapper">
            <div class="progress-meta">
              <span>上传中...</span>
              <span>{{ uploadProgress }}%</span>
            </div>
            <el-progress :percentage="uploadProgress" :show-text="false" :stroke-width="4"></el-progress>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { API_BASE } from "@/utils/request";
import { createDatasetConversion, fetchDatasetConversion } from "@/api/datasetConversions";
import { uploadDataset } from "@/api/datasets";

export default {
  name: "DatasetFormatConversion",
  data() {
    return {
      uploadFile: null,
      targetFormat: "yolo",
      converting: false,
      uploadingDataset: false,
      datasetName: "",

      jobId: null,
      pollTimer: null,
      progress: 0,
      stage: "",
      processed: 0,
      total: 0,
      logs: [],
      status: null,
      outputUrl: "",
      outputFilename: "",

      uploadProgress: 0,
      uploadCancel: null,
    };
  },
  computed: {
    isCompleted() {
      return this.status === "completed";
    },
    isFailed() {
      return this.status === "failed";
    },
    statusLabel() {
      const map = {
        queued: "排队中",
        running: "运行中",
        completed: "已完成",
        failed: "失败",
      };
      return map[this.status] || this.status || "未开始";
    },
    statusType() {
        if (this.status === 'completed') return 'success';
        if (this.status === 'failed') return 'danger';
        if (this.status === 'running') return 'primary';
        return 'info';
    },
    stageLabel() {
      const s = String(this.stage || "").trim();
      if (!s) return "";
      const map = {
        queued: "排队",
        extracting: "解压资源",
        converting_labels: "转换标注格式",
        converting_coco: "生成 COCO JSON",
        copying_images: "迁移图片资源",
        writing_data_yaml: "生成配置 (data.yaml)",
        zipping: "打包结果",
        done: "处理完成",
        failed: "处理失败",
      };
      return map[s] || s;
    },
    hasCounts() {
      return Number.isFinite(Number(this.total)) && Number(this.total) > 0;
    },
    progressColor() {
      if (this.isFailed) return "#F56C6C";
      if (this.isCompleted) return "#67C23A";
      return "#409EFF";
    },
  },
  watch: {
      logs() {
          this.$nextTick(() => {
              if (this.$refs.logsContainer) {
                  this.$refs.logsContainer.scrollTop = this.$refs.logsContainer.scrollHeight;
              }
          })
      }
  },
  beforeDestroy() {
    this.stopPolling();
    this.cancelUpload();
  },
  methods: {
    handleFileChange(file) {
      const f = file && (file.raw || file);
      this.uploadFile = f || null;
    },
    removeFile() {
      if (this.converting || this.uploadingDataset) return;
      this.uploadFile = null;
    },
    handleReset() {
      if (this.converting || this.uploadingDataset) return;
      this.stopPolling();
      this.cancelUpload();
      this.uploadFile = null;
      this.datasetName = "";
      this.targetFormat = "yolo";
      this.jobId = null;
      this.progress = 0;
      this.stage = "";
      this.processed = 0;
      this.total = 0;
      this.logs = [];
      this.status = null;
      this.outputUrl = "";
      this.outputFilename = "";
      this.uploadProgress = 0;
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async startConversion() {
      if (!this.uploadFile) {
        this.$message.warning("请先上传数据包");
        return;
      }
      this.converting = true;
      this.uploadProgress = 0;
      this.logs = ["正在初始化任务...", "上传源文件: " + this.uploadFile.name, "目标格式: " + this.targetFormat.toUpperCase()];
      try {
        const job = await createDatasetConversion({ file: this.uploadFile, targetFormat: this.targetFormat });
        this.jobId = job && job.job_id;
        this.status = job && job.status;
        this.stage = job && job.stage;
        this.progress = Number(job && job.progress) || 0;
        this.logs = (job && job.logs) || this.logs;
        this.outputUrl = job && job.output_url;
        this.outputFilename = job && job.output_filename;

        this.stopPolling();
        this.pollTimer = setInterval(this.pollStatus, 1000);
        await this.pollStatus();
      } catch (e) {
        this.converting = false;
        this.$message.error("任务启动失败: " + (e.message || e));
        this.logs.push("错误: " + (e.message || e));
      }
    },
    async pollStatus() {
      if (!this.jobId) return;
      try {
        const st = await fetchDatasetConversion(this.jobId);
        this.status = st && st.status;
        this.stage = st && st.stage;
        this.progress = Number(st && st.progress) || 0;
        this.processed = Number(st && st.processed) || 0;
        this.total = Number(st && st.total) || 0;
        const newLogs = (st && st.logs) || [];
        // simple dedup content check or formatting could go here
        this.logs = newLogs; 
        this.outputUrl = st && st.output_url;
        this.outputFilename = st && st.output_filename;

        if (this.status === "completed") {
          this.converting = false;
          this.stopPolling();
          this.$message.success("转换成功");
        } else if (this.status === "failed") {
          this.converting = false;
          this.stopPolling();
          const msg = (st && (st.error_message || st.detail)) || "任务失败";
          this.$message.error(msg);
        }
      } catch (e) {
        console.error("pollStatus error:", e);
      }
    },
    downloadResult() {
      if (!this.outputUrl) return;
      const url = /^https?:\/\//i.test(this.outputUrl) ? this.outputUrl : `${API_BASE}${this.outputUrl}`;
      window.open(url, "_blank");
    },
    cancelUpload() {
      if (typeof this.uploadCancel === "function") {
        try {
          this.uploadCancel();
        } catch (_) {
          /* ignore */
        }
      }
      this.uploadCancel = null;
    },
    async uploadToDatasets() {
      if (!this.isCompleted || !this.outputUrl) return;
      if (!this.datasetName) {
        this.$message.warning("请输入数据集名称");
        return;
      }
      this.uploadingDataset = true;
      this.uploadProgress = 0;
      this.cancelUpload();

      try {
        const url = /^https?:\/\//i.test(this.outputUrl) ? this.outputUrl : `${API_BASE}${this.outputUrl}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`无法获取文件: HTTP ${res.status}`);
        const blob = await res.blob();
        const filename = this.outputFilename || `dataset_yolo_${this.jobId}.zip`;
        const zipFile = new File([blob], filename, { type: "application/zip" });

        const req = uploadDataset(zipFile, this.datasetName, "detection", null, {
          onProgress: (p) => {
            const percent = p && p.percent;
            if (typeof percent === "number") this.uploadProgress = percent;
          },
        });
        this.uploadCancel = req && req.cancel;
        const result = await (req && req.promise);
        this.uploadingDataset = false;
        this.uploadCancel = null;
        this.uploadProgress = 100;
        const ds = result && result.dataset;
        const id = ds && (ds.dataset_id || ds.id);
        this.$message.success("数据集创建成功");
        if (id) {
            // Slight delay to allow progress bar to show complete
            setTimeout(() => {
                 this.$router.push({ path: "/datadetail", query: { datasetId: id, datasetName: this.datasetName, datasetType: "detection" } });
            }, 500);
        } else {
          this.$router.push({ path: "/datasets" });
        }
      } catch (e) {
        this.uploadingDataset = false;
        this.$message.error("入库失败: " + (e.message || e));
      }
    },
  },
};
</script>

<style scoped>
.conversion-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  height: 100%;
}

/* Header */
.header-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
}

.header-left {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.icon-wrapper {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-light, rgba(64, 158, 255, 0.1));
  border-radius: 8px;
}

.tool-icon {
  font-size: 1.25rem;
  color: var(--color-primary);
}

.page-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-main);
}

.subtitle {
  margin: 0.25rem 0 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.primary-btn {
  box-shadow: 0 4px 6px -1px rgba(64, 158, 255, 0.2);
}

/* Content Layout */
.content-wrapper {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 1.5rem;
  min-height: 0;
  flex: 1;
}

.config-panel,
.progress-panel,
.result-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #ffffff;
  border-radius: var(--radius-lg, 8px);
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); /* Softer shadow */
  border: 1px solid var(--border-light, #e4e7ed);
}

.progress-panel {
  grid-row: span 2;
  display: flex;
  flex-direction: column;
}

.panel-header {
  font-weight: 600;
  padding: 1rem 1.25rem;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--border-light, #f0f2f5);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-main);
  background: #fcfcfc;
  border-radius: var(--radius-lg, 8px) var(--radius-lg, 8px) 0 0;
}

.panel-header i {
  color: var(--text-secondary);
  font-size: 1.1em;
}

.config-form {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  flex: 1;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

/* Upload Area */
.upload-area :deep(.el-upload) {
  width: 100%;
}

.upload-area :deep(.el-upload-dragger) {
  width: 100%;
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  background: #fbfbfb;
  transition: all 0.2s;
}

.upload-area :deep(.el-upload-dragger:hover) {
  border-color: var(--color-primary);
  background: #f0f9ff;
}

.cloud-icon {
  font-size: 2.5rem;
  color: #c0c4cc;
  margin-bottom: 0.5rem;
}

.upload-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.upload-file {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1.5rem;
  background: #f0f9ff;
  border-color: var(--color-primary);
}

.file-icon-wrapper {
  width: 36px;
  height: 36px;
  background: #ffffff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.filename {
  font-weight: 500;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.9rem;
}

.filesize {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.remove-btn {
  padding: 0.5rem;
  cursor: pointer;
  color: #909399;
  transition: color 0.2s;
}

.remove-btn:hover {
  color: #f56c6c;
}

.hint-box {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  background: #fdf6ec;
  border-radius: 4px;
  color: #e6a23c;
  font-size: 0.8rem;
  line-height: 1.4;
}

.hint-box i {
  font-size: 1rem;
  margin-top: 0.1rem;
}

/* Progress Section */
.progress-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
  min-height: 0;
}

.status-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.progress-bar-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.logs-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
  background: #1e1e1e; /* Dark terminal look */
}

.logs-header {
  padding: 0.5rem 0.75rem;
  background: #2d2d2d;
  color: #dcdfe6;
  font-size: 0.75rem;
  border-bottom: 1px solid #333;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.logs-content {
  flex: 1;
  padding: 0.75rem;
  overflow-y: auto;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 0.75rem;
  color: #a9b7c6;
  line-height: 1.5;
  background: #1e1e1e;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  padding: 2rem;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  background: #f5f7fa;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.empty-icon-wrapper i {
  font-size: 1.75rem;
  color: #dcdfe6;
}

.empty-state p {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.25rem;
}

.empty-desc {
  font-size: 0.85rem;
}

/* Result Panel */
.action-row {
  margin-top: 0.5rem;
}

.full-width-btn {
  width: 100%;
}

.upload-progress-wrapper {
  margin-top: 0.75rem;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 4px;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.35rem;
}

/* Responsive */
@media (max-width: 1100px) {
  .content-wrapper {
    grid-template-columns: 1fr;
  }
  .progress-panel {
    grid-row: auto;
  }
}
</style>

