<template>
  <div class="manual-aug-panel">
    <div class="aug-layout">
      <!-- Left Column: Configuration -->
      <div class="aug-config">
        <el-form :model="form" size="small" class="aug-form" label-position="top">
          
          <div class="config-section">
            <div class="section-title"><i class="el-icon-setting"></i> 基础设置</div>
            <div class="section-content">
              <el-form-item label="数据集版本">
                <el-select v-model="form.version_id" placeholder="默认当前激活版本" clearable class="full-width">
                  <el-option v-for="item in versionOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-form-item label="包含原图">
                    <el-switch v-model="form.include_original" active-color="#13ce66" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="每图最大扩增数">
                    <el-input-number v-model="form.max_outputs_per_image" :min="1" :max="5000" controls-position="right" class="full-width" />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
          </div>

          <div class="config-section" :class="{ 'is-disabled': !form.slice_enabled }">
            <div class="section-title">
              <div class="title-left"><i class="el-icon-scissors"></i> 切片扩增 (Slice)</div>
              <el-switch v-model="form.slice_enabled" active-color="#13ce66" />
            </div>
            <el-collapse-transition>
              <div class="section-content" v-show="form.slice_enabled">
                <el-form-item label="切片尺度 (scales)">
                  <el-input v-model.trim="form.slice_scales_text" placeholder="例如: 640或者640,800" />
                  <div class="form-tip">切图的基础尺寸列表，用逗号分隔</div>
                </el-form-item>
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="重叠率 (overlap)">
                      <el-input-number v-model="form.slice_overlap" :min="0" :max="0.95" :step="0.05" controls-position="right" class="full-width" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="最小面积比" title="min_area_ratio">
                      <el-input-number v-model="form.slice_min_area_ratio" :min="0" :max="1" :step="0.05" controls-position="right" class="full-width" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="最小可见度" title="min_visibility">
                      <el-input-number v-model="form.slice_min_visibility" :min="0" :max="1" :step="0.05" controls-position="right" class="full-width" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="最小像素" title="min_pixel_size">
                      <el-input-number v-model="form.slice_min_pixel_size" :min="1" :max="4096" controls-position="right" class="full-width" />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </el-collapse-transition>
          </div>

          <div class="config-section" :class="{ 'is-disabled': !form.rotate_enabled }">
            <div class="section-title">
              <div class="title-left"><i class="el-icon-refresh-right"></i> 旋转扩增 (Rotate)</div>
              <el-switch v-model="form.rotate_enabled" active-color="#13ce66" />
            </div>
            <el-collapse-transition>
              <div class="section-content" v-show="form.rotate_enabled">
                <el-form-item label="旋转角度 (angles)">
                  <el-input v-model.trim="form.rotate_angles_text" placeholder="例如: -15,15,90" />
                  <div class="form-tip">支持多角度旋转，用逗号分隔</div>
                </el-form-item>
                <el-form-item label="边界填充值">
                  <el-input-number v-model="form.rotate_border_value" :min="0" :max="255" controls-position="right" class="full-width" />
                </el-form-item>
              </div>
            </el-collapse-transition>
          </div>

          <div class="config-section" :class="{ 'is-disabled': !form.translate_enabled }">
            <div class="section-title">
              <div class="title-left"><i class="el-icon-rank"></i> 平移扩增 (Translate)</div>
              <el-switch v-model="form.translate_enabled" active-color="#13ce66" />
            </div>
            <el-collapse-transition>
              <div class="section-content" v-show="form.translate_enabled">
                <el-form-item label="平移偏移 (offsets)">
                  <el-input
                    v-model.trim="form.translate_offsets_text"
                    type="textarea"
                    :rows="2"
                    placeholder="每行一组: dx,dy (例如: 0.1,0)"
                    class="mono-input"
                  />
                  <div class="form-tip">横向/纵向平移比例，每行一组</div>
                </el-form-item>
                <el-form-item label="边界填充值">
                  <el-input-number v-model="form.translate_border_value" :min="0" :max="255" controls-position="right" class="full-width" />
                </el-form-item>
              </div>
            </el-collapse-transition>
          </div>

        </el-form>
      </div>

      <!-- Right Column: Status and Operations -->
      <div class="aug-status">
        <div class="action-card glass-panel">
          <div class="action-buttons">
            <el-button size="medium" :loading="previewLoading" @click="runPreview" class="btn-preview" icon="el-icon-data-analysis">测算产出</el-button>
            <el-button size="medium" type="primary" :loading="creating" :disabled="isRunning" @click="startJob" class="btn-start" icon="el-icon-video-play">开始任务</el-button>
            <el-button size="medium" type="danger" plain :disabled="!isRunning" @click="cancelJob" icon="el-icon-circle-close">取消当前任务</el-button>
            <el-button size="medium" :disabled="!jobId" @click="refreshJob" icon="el-icon-refresh" circle></el-button>
          </div>

          <!-- Preview Data -->
          <el-collapse-transition>
            <div v-if="previewData && !isRunning && !canPublish" class="preview-stats">
              <div class="stat-item">
                <div class="stat-val">{{ previewData.total_images || 0 }}</div>
                <div class="stat-lbl">源图数</div>
              </div>
              <div class="stat-item">
                <div class="stat-val">{{ previewData.with_labels || 0 }}</div>
                <div class="stat-lbl">有标注</div>
              </div>
              <div class="stat-item highlight">
                <div class="stat-val">+{{ previewData.estimated_generated_outputs || 0 }}</div>
                <div class="stat-lbl">预计新增</div>
              </div>
              <div class="stat-item total">
                <div class="stat-val">{{ previewData.estimated_total_outputs || 0 }}</div>
                <div class="stat-lbl">总计产出</div>
              </div>
            </div>
          </el-collapse-transition>

          <!-- Job Status Tracker -->
          <div v-if="job" class="job-tracking">
            <div class="job-header-row">
              <span class="job-id-text">任务 #{{ String(job.job_id).slice(0, 8) }}</span>
              <el-tag size="small" :type="getStatusType(job.status)" effect="dark" class="status-tag">{{ statusText }}</el-tag>
            </div>
            <div class="job-progress-wrap">
              <el-progress 
                :percentage="Number(job.progress || 0)" 
                :status="job.status === 'failed' ? 'exception' : (job.status === 'completed' ? 'success' : undefined)" 
                :stroke-width="12"
              />
              <div class="job-meta-row">
                <span class="job-phase"><i class="el-icon-loading" v-if="isRunning"></i> {{ getPhaseText(job.phase) }}</span>
                <span class="job-count">{{ job.processed || 0 }} / {{ job.total || 0 }}</span>
              </div>
            </div>
            <div v-if="job.error_message" class="job-error-msg">
              <i class="el-icon-error"></i> {{ job.error_message }}
            </div>
            <div v-if="wsDisconnected && !['completed', 'failed', 'cancelled'].includes(String(job.status||'').toLowerCase())" class="ws-warning-msg">
              <i class="el-icon-warning-outline"></i> 实时连接中断，正尝试轮询恢复...
            </div>
          </div>
        </div>

        <!-- Publish Box -->
        <el-collapse-transition>
          <div v-if="canPublish" class="publish-card glass-panel success-glow">
            <div class="publish-header">
              <i class="el-icon-circle-check"></i> 任务完成！可发布为新版本
            </div>
            <el-form size="small" label-position="top" class="publish-form">
              <el-row :gutter="15">
                <el-col :span="12">
                  <el-form-item label="操作人">
                    <el-input v-model.trim="publish.created_by" placeholder="如: 管理员" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="设为当前激活版本" class="switch-item">
                    <el-switch v-model="publish.activate" active-color="#13ce66" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item label="备注消息 (可选)">
                <el-input v-model.trim="publish.message" placeholder="描述此次扩增的效果或参数..." />
              </el-form-item>
              <el-button type="success" :loading="publishing" @click="publishJob" class="btn-publish full-width" icon="el-icon-upload">发布数据集版本</el-button>
            </el-form>
          </div>
        </el-collapse-transition>

        <!-- Console -->
        <div class="terminal-panel">
          <div class="terminal-header">
            <span class="term-title"><i class="el-icon-monitor"></i> 处理日志</span>
            <el-button type="text" size="mini" class="clear-btn" @click="logs = []">清空</el-button>
          </div>
          <div class="terminal-body" ref="logBox">
            <div v-if="!logs.length" class="terminal-empty">等待任务开始...</div>
            <div v-for="line in logs" :key="line.id" class="log-line">
              <span class="log-ts">[{{ line.ts }}]</span> <span class="log-msg">{{ line.text }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import {
  previewDatasetAugmentation,
  createDatasetAugmentationJob,
  fetchDatasetAugmentationJob,
  cancelDatasetAugmentationJob,
  publishDatasetAugmentationJob,
  openDatasetAugmentationStream,
} from '@/api/datasets';

export default {
  name: 'ManualAugmentationPanel',
  props: {
    datasetId: { type: [Number, String], required: true },
    defaultVersionId: { type: [Number, String], default: null },
    versionOptions: { type: Array, default: () => [] },
  },
  data() {
    return {
      form: {
        version_id: this.defaultVersionId || null, include_original: true, max_outputs_per_image: 200,
        slice_enabled: true, slice_scales_text: '640', slice_overlap: 0.2, slice_min_area_ratio: 0.3, slice_min_visibility: 0.15, slice_min_pixel_size: 4,
        rotate_enabled: false, rotate_angles_text: '-15,15', rotate_border_value: 114,
        translate_enabled: false, translate_offsets_text: '0.1,0\n-0.1,0', translate_border_value: 114,
      },
      previewLoading: false, previewData: null, creating: false, publishing: false,
      jobId: null, job: null, logs: [], wsHandle: null, pollTimer: null, wsDisconnected: false,
      manualClosingStream: false,
      publish: { activate: false, message: '', created_by: '管理员' },
    };
  },
  computed: {
    isRunning() { return this.job && ['queued', 'running'].includes(String(this.job.status || '').toLowerCase()); },
    canPublish() {
      const status = this.job && String(this.job.status || '').toLowerCase();
      const publishedId = this.job && this.job.result && this.job.result.published_version_id;
      return status === 'completed' && !publishedId;
    },
    statusText() {
      const status = String((this.job && this.job.status) || '');
      const map = { queued: '排队中', running: '执行中', completed: '已完成', failed: '已失败', cancelled: '已取消' };
      return map[status] || status || '-';
    },
  },
  watch: {
    defaultVersionId(next) { if (next !== undefined && next !== null) this.form.version_id = next; },
    logs() {
       this.$nextTick(() => {
         const box = this.$refs.logBox;
         if (box) {
           box.scrollTop = box.scrollHeight;
         }
       });
    }
  },
  beforeDestroy() { this.stopStream(); this.stopPolling(); },
  methods: {
    getStatusType(status) {
      status = String(status || '').toLowerCase();
      if (status === 'completed') return 'success';
      if (status === 'failed') return 'danger';
      if (status === 'cancelled') return 'info';
      if (status === 'running') return '';
      return 'info';
    },
    getPhaseText(phase) {
      phase = String(phase || '').toLowerCase();
      if (phase === 'initializing') return '正在初始化...';
      if (phase === 'augmenting') return '扩增处理中...';
      if (phase === 'finalizing') return '正在保存数据...';
      if (phase === 'queued') return '等待分配资源...';
      return phase || '准备就绪';
    },
    parseNumberList(text, parser = Number) {
      return String(text || '')
        .split(/[,\s]+/)
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .map(v => parser(v))
        .filter(v => Number.isFinite(v));
    },
    parseOffsets(text) {
      const out = [];
      String(text || '').split(/\n+/).forEach((line) => {
        const parts = String(line).trim().split(/[,\s]+/).filter(Boolean);
        if (parts.length < 2) return;
        const dx = Number(parts[0]); const dy = Number(parts[1]);
        if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
        out.push({ dx, dy });
      });
      return out;
    },
    buildPayload() {
      const scales = this.parseNumberList(this.form.slice_scales_text, Number).map(v => Math.max(32, Math.round(v)));
      const angles = this.parseNumberList(this.form.rotate_angles_text, Number);
      const offsets = this.parseOffsets(this.form.translate_offsets_text);
      return {
        version_id: this.form.version_id ? Number(this.form.version_id) : null,
        include_original: !!this.form.include_original,
        max_outputs_per_image: Number(this.form.max_outputs_per_image) || 200,
        slice: { enabled: !!this.form.slice_enabled, scales, overlap: Number(this.form.slice_overlap), min_area_ratio: Number(this.form.slice_min_area_ratio), min_visibility: Number(this.form.slice_min_visibility), min_pixel_size: Number(this.form.slice_min_pixel_size) },
        rotate: { enabled: !!this.form.rotate_enabled, angles, border_value: Number(this.form.rotate_border_value) },
        translate: { enabled: !!this.form.translate_enabled, offsets, border_value: Number(this.form.translate_border_value) },
      };
    },
    appendLog(text) {
      this.logs.push({ id: `${Date.now()}_${Math.random()}`, ts: new Date().toLocaleTimeString(), text: String(text || '') });
      if (this.logs.length > 500) this.logs.splice(0, this.logs.length - 500);
    },
    async runPreview() {
      this.previewLoading = true;
      try { this.previewData = await previewDatasetAugmentation(this.datasetId, this.buildPayload()); } catch (e) { this.$message.error(e.message || '预览失败'); }
      finally { this.previewLoading = false; }
    },
    async startJob() {
      this.creating = true;
      try {
        const row = await createDatasetAugmentationJob(this.datasetId, this.buildPayload());
        this.jobId = row.job_id; this.job = row; this.logs = []; this.appendLog(`任务已启动, 任务ID: ${row.job_id}`);
        this.startStream(row.job_id);
      } catch (e) { this.$message.error(e.message || '任务启动失败'); }
      finally { this.creating = false; }
    },
    async refreshJob() {
      if (!this.jobId) return;
      try { this.job = await fetchDatasetAugmentationJob(this.datasetId, this.jobId); this.$message.success('状态已刷新'); } catch (e) { this.$message.error(e.message || '刷新失败'); }
    },
    async cancelJob() {
      if (!this.jobId) return;
      try { await cancelDatasetAugmentationJob(this.datasetId, this.jobId); this.appendLog('已发送取消请求...'); } catch (e) { this.$message.error(e.message || '取消失败'); }
    },
    async publishJob() {
      if (!this.jobId) return;
      this.publishing = true;
      try {
        const out = await publishDatasetAugmentationJob(this.datasetId, this.jobId, this.publish);
        this.appendLog(`成功, 已发布为数据版本 v${out.version}`);
        this.$emit('published', out);
      } catch (e) { this.$message.error(e.message || '发布失败'); }
      finally { this.publishing = false; }
    },
    startStream(jobId) {
      this.stopStream(); this.stopPolling(); this.wsDisconnected = false; this.manualClosingStream = false;
      this.wsHandle = openDatasetAugmentationStream(this.datasetId, jobId, {
        onSnapshot: (data) => { this.job = data; this.jobId = data.job_id || jobId; },
        onProgress: (data) => { this.job = { ...(this.job || {}), ...data }; },
        onItem: (item) => { this.appendLog(`[处理完成] ${item.source_image || '-'} 生成了 ${item.generated || 0} 张图`); },
        onDone: (data) => { this.job = { ...(this.job || {}), ...data }; this.wsDisconnected = false; this.stopPolling(); this.$emit('job-done', this.job); this.appendLog('任务执行完毕!'); },
        onError: (err) => { if (err) this.appendLog(`连接错误: ${err.message || err}`); },
        onOpen: () => { this.wsDisconnected = false; this.stopPolling(); this.appendLog('已建立实时进度连接...'); },
        onClose: () => {
          if (this.manualClosingStream) return;
          const status = String((this.job && this.job.status) || '').toLowerCase();
          if (!['completed', 'failed', 'cancelled'].includes(status)) { this.wsDisconnected = true; this.startPolling(); }
        },
      });
    },
    stopStream() {
      this.manualClosingStream = true;
      if (this.wsHandle && typeof this.wsHandle.close === 'function') this.wsHandle.close();
      this.wsHandle = null;
    },
    startPolling() {
      this.stopPolling();
      this.pollTimer = setInterval(async () => {
        if (!this.jobId) return;
        try {
          const row = await fetchDatasetAugmentationJob(this.datasetId, this.jobId);
          this.job = row;
          const status = String(row.status || '').toLowerCase();
          if (['completed', 'failed', 'cancelled'].includes(status)) this.stopPolling();
        } catch (_) { /* ignore */ }
      }, 5000);
    },
    stopPolling() { if (this.pollTimer) clearInterval(this.pollTimer); this.pollTimer = null; },
  },
};
</script>

<style scoped>
.manual-aug-panel { 
  display: flex; 
  flex-direction: column; 
  container-type: inline-size;
}

.aug-layout {
  display: flex;
  flex-direction: row;
  height: 580px;
  gap: 20px;
}

.aug-config {
  flex: 1.1;
  overflow-y: auto;
  padding-right: 15px;
  /* hide scrollbar */
  scrollbar-width: thin;
}
.aug-config::-webkit-scrollbar {
  width: 6px;
}
.aug-config::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 4px;
}

.aug-status {
  flex: 0.9;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
  padding-right: 5px;
}

/* Base Styles */
.full-width { width: 100%; }
.mono-input :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.form-tip { font-size: 12px; color: #909399; margin-top: 4px; line-height: 1.4; }

/* Form tuning for label-position="top" */
.aug-form :deep(.el-form-item__label) {
  padding-bottom: 2px !important;
  line-height: normal;
  color: #606266;
}
.aug-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

/* Sections */
.config-section {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 16px;
  background: #ffffff;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.config-section.is-disabled {
  opacity: 0.8;
  border-color: #f0f2f5;
  background: #fafafa;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #ebeef5;
  border-radius: 8px 8px 0 0;
  font-weight: 600;
  color: #303133;
}
.config-section.is-disabled .section-title {
  border-bottom-color: transparent;
  border-radius: 8px;
}
.title-left i {
  margin-right: 6px;
  color: #409EFF;
}

.section-content {
  padding: 16px 16px 4px 16px;
}

/* Glass Panels */
.glass-panel {
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.btn-preview { flex: 1; }
.btn-start { flex: 2; }

/* Preview Stats */
.preview-stats {
  display: flex;
  justify-content: space-between;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  border-right: 1px dashed #dcdfe6;
}
.stat-item:last-child { border-right: none; }
.stat-val { font-size: 18px; font-weight: 600; color: #303133; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.stat-lbl { font-size: 12px; color: #909399; margin-top: 4px; }
.highlight .stat-val { color: #67c23a; }
.total .stat-val { color: #409EFF; }

/* Job Tracking */
.job-tracking {
  background: #f4f4f5;
  border-radius: 6px;
  padding: 16px;
  border: 1px dashed #c0c4cc;
}
.job-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.job-id-text { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 600; color: #606266; }
.job-progress-wrap { margin-bottom: 10px; }
.job-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
.job-error-msg {
  color: #F56C6C;
  font-size: 12px;
  margin-top: 10px;
  padding: 8px;
  background: #fef0f0;
  border-radius: 4px;
}
.ws-warning-msg {
  color: #E6A23C;
  font-size: 12px;
  margin-top: 10px;
}

/* Publish Box */
.success-glow {
  border: 1px solid #e1f3d8;
  background: #f0f9eb;
}
.publish-header {
  font-size: 14px;
  font-weight: 600;
  color: #67c23a;
  margin-bottom: 16px;
}
.publish-form :deep(.el-form-item) { margin-bottom: 14px; }
.switch-item { display: flex; flex-direction: column; }
.switch-item :deep(.el-form-item__label) { padding-bottom: 4px; }

/* Terminal */
.terminal-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
  min-height: 180px;
}
.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #2d2d2d;
  color: #e5e5e5;
  font-size: 13px;
  border-bottom: 1px solid #111;
}
.clear-btn {
  color: #909399;
  padding: 4px;
}
.clear-btn:hover { color: #fff; }
.terminal-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #d4d4d4;
  scroll-behavior: smooth;
}
.terminal-empty { color: #6e6e6e; font-style: italic; }
.log-line { margin-bottom: 2px; }
.log-ts { color: #569cd6; margin-right: 6px; }
.log-msg { color: #d4d4d4; word-break: break-all; }

/* Responsive layout adjustments mostly handle scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: #dcdfe6;
  border-radius: 3px;
}
</style>
