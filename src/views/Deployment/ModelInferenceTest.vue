<template>
  <div class="inference-test-tool">
    <div class="tool-header premium-header">
      <div class="header-content">
        <h3 class="gradient-text"><i class="el-icon-odometer"></i> 模型推理测试</h3>
        <p>选择已训练模型进行单图、多图或视频推理，全流程清晰可见。</p>
      </div>
      <div class="tool-actions">
        <el-button class="action-btn" size="medium" @click="reloadModels" :loading="modelsLoading">
          <i class="el-icon-refresh"></i> 刷新模型
        </el-button>
        <el-button class="action-btn cancel-btn-light" size="medium" @click="resetAll" :disabled="isRunning">
          <i class="el-icon-refresh-left"></i> 重置状态
        </el-button>
      </div>
    </div>

    <div class="tool-body">
      <!-- 配置面板 -->
      <section class="smooth-card config-panel">
        <div class="card-title">
          <i class="el-icon-setting"></i> 参数配置
        </div>

        <el-form label-position="top" size="medium" class="config-form">
          <el-form-item label="选择模型">
            <el-select
              v-model="form.modelKey"
              filterable
              placeholder="请选择可推理模型"
              class="full-width premium-select"
              :loading="modelsLoading"
            >
              <el-option
                v-for="m in models"
                :key="m._key"
                :label="`${m.label} [${m.engine}]`"
                :value="m._key"
              >
                <div class="model-option">
                  <span class="model-name">{{ m.label }}</span>
                  <el-tag size="mini" type="info" effect="plain" class="engine-tag">{{ m.engine }}</el-tag>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="推理模式">
            <el-radio-group v-model="form.mode" @change="handleModeChange" class="premium-radio-group">
              <el-radio-button label="image"><i class="el-icon-picture-outline"></i> 单图</el-radio-button>
              <el-radio-button label="batch"><i class="el-icon-copy-document"></i> 多图</el-radio-button>
              <el-radio-button label="video"><i class="el-icon-video-camera"></i> 视频</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="文件上传" class="upload-field">
            <el-upload
              class="premium-uploader"
              drag
              action="#"
              :auto-upload="false"
              :on-change="handleFileChange"
              :on-remove="handleFileRemove"
              :file-list="uploadFileList"
              :multiple="form.mode !== 'video'"
              :accept="acceptTypes"
            >
              <div class="upload-inner">
                <i class="el-icon-upload upload-icon"></i>
                <div class="upload-text">{{ uploadText }}</div>
                <div class="upload-tip">{{ uploadTip }}</div>
              </div>
            </el-upload>
          </el-form-item>

          <div class="sliders-row">
            <el-form-item class="slider-field">
              <template slot="label">
                置信度阈值 <span class="slider-val">{{ (form.conf * 100).toFixed(0) }}%</span>
              </template>
              <el-slider v-model="form.conf" :min="0.1" :max="1" :step="0.01" class="premium-slider" show-tooltip></el-slider>
            </el-form-item>
            <el-form-item class="slider-field">
              <template slot="label">
                IOU阈值 <span class="slider-val">{{ (form.iou * 100).toFixed(0) }}%</span>
              </template>
              <el-slider v-model="form.iou" :min="0.1" :max="1" :step="0.01" class="premium-slider" show-tooltip></el-slider>
            </el-form-item>
          </div>

          <el-form-item class="switches-field">
            <el-checkbox v-model="form.showLabels" border class="premium-checkbox">显示标签内容</el-checkbox>
            <el-checkbox v-model="form.showConfidence" border class="premium-checkbox">显示置信度值</el-checkbox>
          </el-form-item>

          <div class="action-buttons">
            <el-button
              type="primary"
              class="start-btn pulse-glow"
              :disabled="!canStart"
              :loading="isStarting"
              @click="startInference"
            >
              <i class="el-icon-video-play"></i> 立即开始推理
            </el-button>
            <el-button
              class="stop-btn"
              :disabled="!isRunning"
              @click="cancelCurrentJob"
            >
              <i class="el-icon-close"></i> 终止任务
            </el-button>
          </div>
        </el-form>
      </section>

      <!-- 结果面板 -->
      <section class="smooth-card result-panel">
        <div class="card-title">
          <i class="el-icon-data-analysis"></i> 分析结果监控
        </div>

        <div class="status-monitor" :class="jobStatus">
          <div class="status-header">
            <div class="status-badge" :class="jobStatus">
              <span class="dot" :class="jobStatus"></span>
              {{ statusText }}
            </div>
            <div v-if="jobId" class="job-id">
              <i class="el-icon-key"></i> {{ jobId }}
            </div>
          </div>
          
          <el-progress 
            :percentage="jobProgress" 
            :status="progressStatus" 
            :stroke-width="14"
            class="premium-progress"
          ></el-progress>
          
          <div class="status-footer">
            <div class="phase-info">当前阶段：<strong class="highlight-text">{{ jobPhase || "-" }}</strong></div>
            <div v-if="total > 0" class="progress-info">
              进度：<strong class="highlight-text">{{ processed }}</strong> / {{ total }}
            </div>
          </div>
          <div v-if="wsHint" class="ws-hint"><i class="el-icon-warning-outline"></i> {{ wsHint }}</div>
          <el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon :closable="false" class="error-alert"></el-alert>
        </div>

        <!-- 视频结果 -->
        <transition name="fade" mode="out-in">
          <div v-if="videoOutputUrl" key="video" class="feature-box video-box">
            <div class="box-header"><i class="el-icon-film"></i> 视频输出结果</div>
            <div class="video-container">
              <video :src="absoluteUrl(videoOutputUrl)" controls preload="metadata"></video>
            </div>
            <div class="video-meta">
              <span><i class="el-icon-files"></i> 帧数: {{ videoMeta.processed_frames }}/{{ videoMeta.total_frames }}</span>
              <span v-if="videoMeta.fps"><i class="el-icon-time"></i> FPS: <strong class="highlight-num">{{ Number(videoMeta.fps).toFixed(1) }}</strong></span>
            </div>
          </div>

          <!-- 图片结果列表 -->
          <div v-else key="images" class="feature-box gallery-box">
            <div class="box-header">
              <span><i class="el-icon-picture"></i> 推理结果集</span>
              <el-tag size="medium" type="primary" effect="light" class="round-tag">{{ items.length }} 项</el-tag>
            </div>
            
            <div v-if="items.length === 0" class="empty-state">
              <div class="empty-icon-box"><i class="el-icon-box"></i></div>
              <p>暂无可预览的结果，请等待任务完成</p>
            </div>
            
            <div v-else class="result-list-scroll">
              <transition-group name="list" tag="div" class="result-list-container">
                <div
                  v-for="item in items"
                  :key="item.result_id"
                  class="result-card"
                  :class="{ active: selectedResultId === item.result_id }"
                  @click="selectedResultId = item.result_id"
                >
                  <div class="res-info">
                    <div class="res-name" :title="item.filename">{{ item.filename }}</div>
                    <div class="res-meta">
                      <span class="meta-tag"><i class="el-icon-aim"></i> <strong>{{ item.detections || 0 }}</strong> 目标</span>
                      <span class="meta-tag"><i class="el-icon-timer"></i> {{ item.inference_time_ms != null ? `${item.inference_time_ms}ms` : "-" }}</span>
                    </div>
                  </div>
                  <div class="res-status" :class="item.status">
                    <i :class="item.status === 'success' ? 'el-icon-success' : 'el-icon-error'"></i>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>
        </transition>

        <!-- 结果详情预览 -->
        <transition name="fade">
          <div v-if="currentItem && !videoOutputUrl" class="feature-box preview-box">
            <div class="box-header"><i class="el-icon-view"></i> 预览：{{ currentItem.filename }}</div>
            <div class="preview-container">
              <img v-if="currentPreviewUrl" :src="absoluteUrl(currentPreviewUrl)" alt="result" />
              <div v-else class="empty-preview"><i class="el-icon-picture-outline"></i> 图源未就绪</div>
            </div>
          </div>
        </transition>
      </section>
    </div>
  </div>
</template>

<script>
import { API_BASE } from "@/utils/request";
import { uploadInferenceFile } from "@/api/inference";
import {
  fetchInferableModels,
  createInferenceJob,
  fetchInferenceJob,
  cancelInferenceJob,
  openInferenceJobStream,
} from "@/api/inferenceJobs";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export default {
  name: "ModelInferenceTestTool",
  data() {
    return {
      models: [],
      modelsLoading: false,
      form: {
        modelKey: "",
        mode: "image",
        conf: 0.5,
        iou: 0.45,
        showLabels: true,
        showConfidence: true,
      },
      uploadFileList: [],
      isStarting: false,
      jobId: "",
      jobStatus: "",
      jobPhase: "",
      jobProgress: 0,
      processed: 0,
      total: 0,
      errorMessage: "",
      items: [],
      selectedResultId: null,
      videoMeta: {},
      streamHandle: null,
      pollTimer: null,
      wsHint: "",
    };
  },
  computed: {
    selectedModel() {
      return this.models.find((m) => m._key === this.form.modelKey) || null;
    },
    canStart() {
      if (!this.selectedModel || this.isRunning) return false;
      if (this.form.mode === "video") return this.uploadFileList.length === 1;
      return this.uploadFileList.length > 0;
    },
    isRunning() {
      return this.jobStatus === "queued" || this.jobStatus === "running";
    },
    progressStatus() {
      if (this.jobStatus === "failed") return "exception";
      if (this.jobStatus === "cancelled") return "warning";
      if (this.jobStatus === "completed") return "success";
      return null;
    },
    statusText() {
      const map = {
        queued: "已进入队列排队",
        running: "正在进行推理计算",
        completed: "任务已顺利完成",
        failed: "执行失败",
        cancelled: "已由用户中断取消",
      };
      return map[this.jobStatus] || "就绪待命";
    },
    acceptTypes() {
      if (this.form.mode === "video") return ".mp4,.avi,.mov,.mkv";
      return ".jpg,.jpeg,.png,.bmp,.webp";
    },
    uploadText() {
      return this.form.mode === "video" ? "拖拽或点击上传视频文件" : "拖拽或点击上传图片文件";
    },
    uploadTip() {
      if (this.form.mode === "video") return "仅支持单视频；任务将返回可播放的推理结果视频";
      if (this.form.mode === "image") return "支持多图上传，但仅取图集第一张图片进行推理演示";
      return "支持多图批量上传，推理结果将在侧边栏逐项滚动追加";
    },
    currentItem() {
      if (!this.items.length) return null;
      const hit = this.items.find((x) => x.result_id === this.selectedResultId);
      return hit || this.items[0];
    },
    currentPreviewUrl() {
      if (!this.currentItem) return "";
      return this.currentItem.output_url || this.currentItem.source_url || "";
    },
    videoOutputUrl() {
      return this.videoMeta.output_url || "";
    },
  },
  mounted() {
    this.reloadModels();
  },
  beforeDestroy() {
    this.stopStream();
    this.stopPolling();
  },
  methods: {
    makeModelKey(row) {
      if (row.model_version_id != null) return `mv:${row.model_version_id}`;
      return `run:${row.run_id}`;
    },
    absoluteUrl(url) {
      const raw = String(url || "").trim();
      if (!raw) return "";
      if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
      if (raw.startsWith("/")) return `${API_BASE}${raw}`;
      return `${API_BASE}/${raw}`;
    },
    async reloadModels() {
      this.modelsLoading = true;
      try {
        const rows = await fetchInferableModels();
        this.models = (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, _key: this.makeModelKey(r) }));
        if (!this.form.modelKey && this.models.length) this.form.modelKey = this.models[0]._key;
      } catch (e) {
        this.$message.error(`加载模型失败: ${e.message || e}`);
      } finally {
        this.modelsLoading = false;
      }
    },
    handleModeChange() {
      this.uploadFileList = [];
    },
    handleFileChange(_file, fileList) {
      this.uploadFileList = Array.isArray(fileList) ? fileList.slice() : [];
      if ((this.form.mode === "video" || this.form.mode === "image") && this.uploadFileList.length > 1) {
        this.uploadFileList = [this.uploadFileList[this.uploadFileList.length - 1]];
      }
    },
    handleFileRemove(_file, fileList) {
      this.uploadFileList = Array.isArray(fileList) ? fileList.slice() : [];
    },
    resetAll() {
      if (this.isRunning) return;
      this.jobId = "";
      this.jobStatus = "";
      this.jobPhase = "";
      this.jobProgress = 0;
      this.processed = 0;
      this.total = 0;
      this.errorMessage = "";
      this.items = [];
      this.videoMeta = {};
      this.selectedResultId = null;
      this.wsHint = "";
      this.uploadFileList = [];
    },
    async uploadInputs() {
      if (this.form.mode === "video") {
        const first = this.uploadFileList[0];
        if (!first) throw new Error("请上传视频");
        const up = await uploadInferenceFile(first.raw || first);
        return { inputTokens: [], videoToken: up.token };
      }

      const tokens = [];
      for (const f of this.uploadFileList) {
        const up = await uploadInferenceFile(f.raw || f);
        tokens.push(up.token);
      }
      if (this.form.mode === "image" && tokens.length > 1) {
        return { inputTokens: [tokens[0]], videoToken: null };
      }
      return { inputTokens: tokens, videoToken: null };
    },
    buildPayload(uploaded) {
      const payload = {
        mode: this.form.mode,
        conf: Number(this.form.conf),
        iou: Number(this.form.iou),
        show_labels: !!this.form.showLabels,
        show_confidence: !!this.form.showConfidence,
      };
      if (this.selectedModel.model_version_id != null) payload.model_version_id = this.selectedModel.model_version_id;
      else payload.run_id = this.selectedModel.run_id;

      if (this.form.mode === "video") payload.video_token = uploaded.videoToken;
      else payload.input_tokens = uploaded.inputTokens;
      return payload;
    },
    applyJobSnapshot(data, { replaceItems = false } = {}) {
      if (!data || typeof data !== "object") return;
      this.jobId = data.job_id || this.jobId;
      this.jobStatus = data.status || this.jobStatus;
      this.jobPhase = data.phase || this.jobPhase;
      this.jobProgress = Number(data.progress || 0);
      this.processed = Number(data.processed || 0);
      this.total = Number(data.total || 0);
      this.errorMessage = data.error_message || "";

      const result = data.result && typeof data.result === "object" ? data.result : null;
      if (result && result.video && typeof result.video === "object") {
        this.videoMeta = { ...result.video };
      }
      if (result && Array.isArray(result.items)) {
        if (replaceItems) this.items = [];
        result.items.forEach((it) => this.upsertItem(it));
      }
    },
    upsertItem(item) {
      if (!item || typeof item !== "object") return;
      const rid = Number(item.result_id || 0);
      if (!Number.isFinite(rid) || rid <= 0) return;
      const idx = this.items.findIndex((x) => Number(x.result_id) === rid);
      if (idx >= 0) this.$set(this.items, idx, { ...this.items[idx], ...item });
      else this.items.push({ ...item });
      this.items.sort((a, b) => Number(a.result_id || 0) - Number(b.result_id || 0));
      if (!this.selectedResultId && this.items.length) this.selectedResultId = this.items[0].result_id;
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    startPollingFallback() {
      if (!this.jobId || this.pollTimer || TERMINAL.has(this.jobStatus)) return;
      this.wsHint = "实时连接中断，已切换为低频同步";
      this.pollTimer = setInterval(async () => {
        if (!this.jobId || TERMINAL.has(this.jobStatus)) {
          this.stopPolling();
          return;
        }
        try {
          const data = await fetchInferenceJob(this.jobId, { includeItems: true });
          this.applyJobSnapshot(data, { replaceItems: true });
          if (TERMINAL.has(String(data.status || ""))) this.stopPolling();
        } catch (e) {
          void e;
        }
      }, 5000);
    },
    stopStream() {
      if (this.streamHandle) {
        this.streamHandle.close();
        this.streamHandle = null;
      }
    },
    connectStream(job) {
      this.stopStream();
      this.stopPolling();
      this.streamHandle = openInferenceJobStream(
        job.job_id,
        {
          onOpen: () => {
            this.wsHint = "";
          },
          onSnapshot: (data) => this.applyJobSnapshot(data, { replaceItems: false }),
          onProgress: (data) => this.applyJobSnapshot(data, { replaceItems: false }),
          onItem: (item) => this.upsertItem(item),
          onDone: (data) => {
            this.applyJobSnapshot(data, { replaceItems: false });
            this.stopPolling();
            this.wsHint = "";
            this.stopStream();
          },
          onError: () => {},
          onClose: () => {
            if (!TERMINAL.has(this.jobStatus)) this.startPollingFallback();
          },
          onReconnect: () => {
            if (!TERMINAL.has(this.jobStatus)) this.wsHint = "实时连接重连中...";
          },
        },
        {
          fromSeq: job.seq || 0,
          fromResultId: job.last_result_id || 0,
        }
      );
    },
    async startInference() {
      if (!this.canStart) return;
      this.isStarting = true;
      this.errorMessage = "";
      this.items = [];
      this.videoMeta = {};
      this.selectedResultId = null;
      this.stopStream();
      this.stopPolling();

      try {
        const uploaded = await this.uploadInputs();
        const payload = this.buildPayload(uploaded);
        const job = await createInferenceJob(payload);
        this.applyJobSnapshot(job, { replaceItems: true });
        this.connectStream(job);
        this.$message.success("推理任务已启动");
      } catch (e) {
        this.errorMessage = e.message || String(e);
        this.$message.error(`启动失败: ${this.errorMessage}`);
      } finally {
        this.isStarting = false;
      }
    },
    async cancelCurrentJob() {
      if (!this.jobId || !this.isRunning) return;
      try {
        const data = await cancelInferenceJob(this.jobId);
        this.applyJobSnapshot(data, { replaceItems: false });
      } catch (e) {
        this.$message.error(`取消失败: ${e.message || e}`);
      }
    },
  },
};
</script>

<style scoped>
/* 基地结构与底色 */
.inference-test-tool {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  padding: 8px 4px;
  box-sizing: border-box;
  background-color: transparent;
  color: #1e293b;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* 顶部玻璃态顶栏 */
.premium-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 28px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(226, 232, 240, 0.8);
}
.header-content h3 {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #0ea5e9, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.header-content h3 i {
  -webkit-text-fill-color: #0ea5e9;
}
.header-content p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  letter-spacing: 0.3px;
}
.tool-actions {
  display: flex;
  gap: 12px;
}
.action-btn {
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 10px 18px;
}
.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.cancel-btn-light {
  color: #ef4444;
  border-color: #fecaca;
  background-color: #fef2f2;
}
.cancel-btn-light:hover {
  background-color: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

/* 核心布局区域（左配置，右结果） */
.tool-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(420px, 480px) minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
}

/* 悬浮微动画卡片基类 */
.smooth-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.02);
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.smooth-card:hover {
  box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}
.card-title {
  padding: 20px 24px;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 10;
}
.card-title i {
  color: #3b82f6;
  font-size: 20px;
  background: #eff6ff;
  padding: 6px;
  border-radius: 8px;
}

/* 【左侧配置面板】 */
.config-form {
  padding: 24px;
  overflow-y: auto;
  overflow-x: hidden;
}
.config-form::-webkit-scrollbar { width: 6px; }
.config-form::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

::v-deep .el-form-item__label {
  font-weight: 600;
  color: #475569;
  padding-bottom: 6px;
  font-size: 14px;
}

/* 模型选择 */
.premium-select ::v-deep .el-input__inner {
  border-radius: 10px;
  border: 1px solid #cbd5e1;
  padding-left: 16px;
  height: 44px;
  line-height: 44px;
  transition: all 0.2s;
}
.premium-select ::v-deep .el-input__inner:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}
.model-option { display: flex; justify-content: space-between; align-items: center; }
.model-name { font-weight: 500; font-size: 13px; }
.engine-tag { border-radius: 4px; font-weight: 600; }

/* 单选组效果增强 */
.premium-radio-group { display: flex; width: 100%; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); background: #f8fafc; padding: 4px; border-radius: 12px; }
::v-deep .premium-radio-group .el-radio-button { flex: 1; }
::v-deep .premium-radio-group .el-radio-button__inner {
  width: 100%;
  border-radius: 10px !important;
  border: none;
  background: transparent;
  color: #64748b;
  font-weight: 500;
  box-shadow: none !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 10px 0;
}
::v-deep .premium-radio-group .el-radio-button__orig-radio:checked + .el-radio-button__inner {
  background: #ffffff;
  color: #3b82f6;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05), inset 0 0 0 1px #e2e8f0 !important;
  font-weight: 600;
  border: none;
}

/* 上传拖拽区域高级态 */
.upload-field { margin-top: 10px; margin-bottom: 28px; }
::v-deep .premium-uploader .el-upload { width: 100%; }
::v-deep .premium-uploader .el-upload-dragger {
  width: 100%;
  padding-bottom: 20px;
  min-height: 160px;
  border-radius: 14px;
  border: 2px dashed #cbd5e1;
  background-color: #f8fafc;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}
::v-deep .premium-uploader .el-upload-dragger:hover {
  border-color: #3b82f6;
  background-color: #eff6ff;
  transform: scale(1.01);
}
.upload-inner { text-align: center; }
.upload-icon {
  font-size: 48px;
  color: #94a3b8;
  margin-bottom: 12px;
  transition: color 0.3s, transform 0.3s;
}
::v-deep .premium-uploader .el-upload-dragger:hover .upload-icon {
  color: #3b82f6;
  transform: translateY(-4px);
}
.upload-text { font-size: 15px; color: #334155; font-weight: 600; }
.upload-tip { font-size: 12px; color: #94a3b8; margin-top: 8px; line-height: 1.5; padding: 0 16px; }

/* 阈值滑块优化 */
.sliders-row { display: flex; gap: 24px; }
.slider-field { flex: 1; }
.slider-val {
  float: right;
  color: #3b82f6;
  font-weight: 800;
  font-size: 14px;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 6px;
}
::v-deep .premium-slider .el-slider__bar { background-color: #3b82f6; }
::v-deep .premium-slider .el-slider__button { border-color: #3b82f6; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4); }

/* 开关/复选框增强 */
.switches-field { margin-top: 16px; margin-bottom: 30px; }
::v-deep .premium-checkbox {
  margin-right: 12px !important;
  border-radius: 10px !important;
  padding: 10px 20px 10px 12px !important;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  transition: all 0.3s;
  height: 42px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
::v-deep .premium-checkbox.is-checked {
  background-color: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

/* 操作按键组 */
.action-buttons {
  display: flex;
  gap: 16px;
  margin-top: 12px;
}
.start-btn {
  flex: 3;
  height: 52px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
  border: none;
  box-shadow: 0 6px 15px -3px rgba(59, 130, 246, 0.4), 0 4px 6px -2px rgba(59, 130, 246, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: 0.5px;
}
.start-btn:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 10px 25px -3px rgba(59, 130, 246, 0.5), 0 8px 10px -2px rgba(59, 130, 246, 0.3);
  background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
}
.start-btn:active:not(:disabled) {
  transform: translateY(0);
}
.start-btn.is-disabled {
  background: #cbd5e1;
  box-shadow: none;
  color: #f8fafc;
}

.stop-btn {
  flex: 1;
  height: 52px;
  border-radius: 12px;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  color: #64748b;
  transition: all 0.3s;
}
.stop-btn:hover:not(:disabled) {
  color: #ef4444;
  border-color: #fca5a5;
  background: #fef2f2;
}

/* 【右侧结果面板】 */
.result-panel {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* 状态监控区域 */
.status-monitor {
  margin: 24px;
  padding: 20px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: all 0.4s ease;
  position: relative;
}
/* .status-monitor::before {
  content: "";
  position: absolute;
  top: 0; left: 0; width: 4px; height: 100%;
  background: #cbd5e1;
  transition: background 0.4s;
} */
.status-monitor.running { background: #eff6ff; border-color: #bfdbfe; }
.status-monitor.running::before { background: #3b82f6; }
.status-monitor.completed { background: #f0fdf4; border-color: #bbf7d0; }
.status-monitor.completed::before { background: #22c55e; }
.status-monitor.failed { background: #fef2f2; border-color: #fecaca; }
.status-monitor.failed::before { background: #ef4444; }

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.status-badge {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-badge.running { color: #1d4ed8; }
.status-badge.completed { color: #166534; }
.status-badge.failed { color: #991b1b; }

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #94a3b8;
}
.dot.running { background: #3b82f6; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6); animation: pulse 1.5s infinite; }
.dot.completed { background: #22c55e; }
.dot.failed { background: #ef4444; }

.job-id {
  font-size: 13px;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: #ffffff;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
::v-deep .premium-progress .el-progress-bar__outer {
  background-color: #e2e8f0;
  border-radius: 8px;
}
::v-deep .premium-progress .el-progress-bar__inner {
  border-radius: 8px;
  transition: width 0.6s ease;
}
.status-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 14px;
  color: #64748b;
}
.highlight-text {
  color: #0f172a;
  font-weight: 600;
}
.ws-hint {
  margin-top: 14px;
  font-size: 13px;
  color: #d97706;
  background: #fffbeb;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #fde68a;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.error-alert { margin-top: 14px; border-radius: 8px; }

/* 模块容器样式 (视频, 列表, 预览共用) */
.feature-box { margin: 0 24px 24px; display: flex; flex-direction: column; }
.box-header {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.box-header i { margin-right: 8px; color: #3b82f6; }
.round-tag { border-radius: 12px; font-weight: 700; padding: 0 12px; }

/* 视频播放器增强 */
.video-container {
  background: #0f172a;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
}
.video-container video { width: 100%; border-radius: 14px; display: block; }
.video-meta {
  margin-top: 16px;
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: #475569;
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.highlight-num { color: #3b82f6; font-size: 15px; }

/* 列表容器 */
.gallery-box { flex: 1; min-height: 200px; flex-shrink: 0; }
.result-list-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; padding-bottom: 20px; }
.result-list-scroll::-webkit-scrollbar { width: 6px; }
.result-list-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

/* 优雅的空态指引 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #94a3b8;
}
.empty-icon-box {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
}
.empty-icon-box i { font-size: 40px; color: #cbd5e1; }
.empty-state p { font-size: 14px; font-weight: 500; }

/* 结果卡片美化 */
.result-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0,0,0,0.01);
}
.result-card:hover {
  border-color: #94a3b8;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  transform: translateX(4px);
}
.result-card.active {
  background: linear-gradient(to right, #eff6ff, #ffffff);
  border-color: #3b82f6;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.1);
}
.res-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  margin-bottom: 8px;
  max-width: 280px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.res-meta { font-size: 12px; color: #64748b; display: flex; gap: 16px; align-items: center; }
.meta-tag { display: inline-flex; align-items: center; gap: 6px; }
.meta-tag strong { color: #3b82f6; font-size: 13px; }
.res-status.success { color: #22c55e; }
.res-status.failed { color: #ef4444; }
.res-status i { font-size: 24px; }

/* 预览图片容器增强 */
.preview-box { margin-bottom: 24px; flex-shrink: 0; }
.preview-container {
  background: radial-gradient(circle at center, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 14px;
  border: 2px dashed #e2e8f0;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 280px;
  max-height: 400px;
  position: relative;
}
.preview-container img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  transition: opacity 0.5s ease;
}
.empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 14px;
}
.empty-preview i { font-size: 40px; margin-bottom: 12px; opacity: 0.6; }

/* 关键帧与微动效配置 */
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}

.pulse-glow { position: relative; overflow: hidden; }
.pulse-glow::after {
  content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
  transform: translateX(-100%);
}
.pulse-glow:hover::after { animation: shimmer 1.5s infinite; }
@keyframes shimmer { 100% { transform: translateX(100%); } }

.list-enter-active, .list-leave-active { transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
.list-enter, .list-leave-to { opacity: 0; transform: translateX(20px) scale(0.95); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.fade-enter, .fade-leave-to { opacity: 0; transform: translateY(10px); }

/* 响应式调整 */
@media (max-width: 1200px) {
  .tool-body { grid-template-columns: 1fr; }
  .config-form { padding-bottom: 0; }
  .smooth-card { max-height: max-content; }
}
</style>
