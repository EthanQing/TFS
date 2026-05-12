<template>
  <div class="manual-aug-panel">
    <div class="aug-layout">
      <div class="aug-config">
        <el-form :model="form" label-position="top" size="small" class="aug-form">
          <div class="config-section">
            <div class="section-title"><i class="el-icon-setting"></i> 基础设置</div>
            <div class="section-content">
              <el-row :gutter="16">
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
            <div class="section-title section-switch">
              <div class="title-left"><i class="el-icon-scissors"></i> 切片扩增</div>
              <el-switch v-model="form.slice_enabled" active-color="#13ce66" />
            </div>
            <div v-show="form.slice_enabled" class="section-content">
              <el-form-item label="切片尺度">
                <el-input v-model.trim="form.slice_scales_text" placeholder="例如：640 或 640,800" />
              </el-form-item>
              <el-row :gutter="16">
                <el-col :span="12"><el-form-item label="重叠率"><el-input-number v-model="form.slice_overlap" :min="0" :max="0.95" :step="0.05" controls-position="right" class="full-width" /></el-form-item></el-col>
                <el-col :span="12"><el-form-item label="最小面积比"><el-input-number v-model="form.slice_min_area_ratio" :min="0" :max="1" :step="0.05" controls-position="right" class="full-width" /></el-form-item></el-col>
                <el-col :span="12"><el-form-item label="最小可见度"><el-input-number v-model="form.slice_min_visibility" :min="0" :max="1" :step="0.05" controls-position="right" class="full-width" /></el-form-item></el-col>
                <el-col :span="12"><el-form-item label="最小像素"><el-input-number v-model="form.slice_min_pixel_size" :min="1" :max="4096" controls-position="right" class="full-width" /></el-form-item></el-col>
              </el-row>
            </div>
          </div>

          <div class="config-section" :class="{ 'is-disabled': !form.rotate_enabled }">
            <div class="section-title section-switch">
              <div class="title-left"><i class="el-icon-refresh-right"></i> 旋转扩增</div>
              <el-switch v-model="form.rotate_enabled" active-color="#13ce66" />
            </div>
            <div v-show="form.rotate_enabled" class="section-content">
              <el-form-item label="旋转角度">
                <el-input v-model.trim="form.rotate_angles_text" placeholder="例如：-15,15,90" />
              </el-form-item>
              <el-form-item label="边界填充值">
                <el-input-number v-model="form.rotate_border_value" :min="0" :max="255" controls-position="right" class="full-width" />
              </el-form-item>
            </div>
          </div>

          <div class="config-section" :class="{ 'is-disabled': !form.translate_enabled }">
            <div class="section-title section-switch">
              <div class="title-left"><i class="el-icon-rank"></i> 平移扩增</div>
              <el-switch v-model="form.translate_enabled" active-color="#13ce66" />
            </div>
            <div v-show="form.translate_enabled" class="section-content">
              <el-form-item label="平移偏移 (每行一组 dx,dy)">
                <el-input v-model.trim="form.translate_offsets_text" type="textarea" :rows="3" placeholder="例如：0.1,0&#10;-0.1,0" class="mono-input" />
              </el-form-item>
              <el-form-item label="边界填充值">
                <el-input-number v-model="form.translate_border_value" :min="0" :max="255" controls-position="right" class="full-width" />
              </el-form-item>
            </div>
          </div>
        </el-form>
      </div>

      <div class="aug-status">
        <div class="glass-panel">
          <div class="action-buttons">
            <el-button size="small" :loading="previewLoading" @click="runPreview">测算产出</el-button>
            <el-button type="primary" size="small" :loading="creating" :disabled="isRunning" @click="startJob">开始任务</el-button>
            <el-button type="danger" plain size="small" :disabled="!isRunning" @click="cancelJob">取消任务</el-button>
            <el-button size="small" :disabled="!jobId" @click="refreshJob">刷新</el-button>
          </div>

          <div v-if="previewData && !jobId" class="preview-stats">
            <div class="stat-item"><div class="stat-val">{{ previewData.total_images || 0 }}</div><div class="stat-lbl">源图数</div></div>
            <div class="stat-item"><div class="stat-val">{{ previewData.with_labels || 0 }}</div><div class="stat-lbl">有标注</div></div>
            <div class="stat-item highlight"><div class="stat-val">+{{ previewData.estimated_generated_outputs || 0 }}</div><div class="stat-lbl">预计新增</div></div>
            <div class="stat-item total"><div class="stat-val">{{ previewData.estimated_total_outputs || 0 }}</div><div class="stat-lbl">总计产出</div></div>
          </div>

          <div v-if="job" class="job-block">
            <div class="job-row">
              <span>任务 #{{ String(job.job_id || '').slice(0, 8) }}</span>
              <el-tag size="mini" :type="statusTagType">{{ statusText }}</el-tag>
            </div>
            <el-progress :percentage="Number(job.progress || 0)" :status="job.status === 'failed' ? 'exception' : (job.status === 'completed' ? 'success' : undefined)" :stroke-width="12" />
            <div class="job-meta">
              <span>{{ phaseText }}</span>
              <span>{{ job.processed || 0 }} / {{ job.total || 0 }}</span>
            </div>
            <div v-if="job.error_message" class="error-text">{{ job.error_message }}</div>
            <div v-if="wsDisconnected && isRunning" class="warn-text">实时连接中断，已自动切换为轮询刷新。</div>
          </div>
        </div>

        <div v-if="canPublish" class="glass-panel publish-card">
          <div class="publish-title">任务完成，可发布为新的标准数据集</div>
          <div class="publish-hint">增强结果会生成一个全新的标准数据集，不会覆盖当前标准数据集。</div>
          <el-form :model="publish" label-position="top" size="small">
            <el-form-item label="操作人">
              <el-input v-model.trim="publish.created_by" placeholder="例如：admin" />
            </el-form-item>
            <el-form-item label="备注说明">
              <el-input v-model.trim="publish.message" placeholder="描述此次增强的目的或参数" />
            </el-form-item>
            <el-form-item>
              <el-switch v-model="publish.activate" active-text="发布后自动激活为当前候选结果（仅后端记录）" />
            </el-form-item>
            <el-button type="success" :loading="publishing" class="full-width" @click="publishJob">发布增强结果</el-button>
          </el-form>
        </div>

        <div class="terminal-panel">
          <div class="terminal-header">
            <span>处理日志</span>
            <el-button type="text" size="mini" @click="logs = []">清空</el-button>
          </div>
          <div ref="logBox" class="terminal-body">
            <div v-if="!logs.length" class="terminal-empty">等待任务开始...</div>
            <div v-for="line in logs" :key="line.id" class="log-line">
              <span class="log-ts">[{{ line.ts }}]</span>
              <span class="log-msg">{{ line.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  previewStandardAugmentation,
  createStandardAugmentationJob,
  fetchStandardAugmentationJob,
  cancelStandardAugmentationJob,
  publishStandardAugmentationJob,
  openStandardAugmentationStream,
} from '@/api/standardDatasets';

export default {
  name: 'ManualAugmentationPanel',
  props: {
    datasetId: { type: [Number, String], required: true },
  },
  data() {
    return {
      form: {
        include_original: true,
        max_outputs_per_image: 200,
        slice_enabled: true,
        slice_scales_text: '640',
        slice_overlap: 0.2,
        slice_min_area_ratio: 0.3,
        slice_min_visibility: 0.15,
        slice_min_pixel_size: 4,
        rotate_enabled: false,
        rotate_angles_text: '-15,15',
        rotate_border_value: 114,
        translate_enabled: false,
        translate_offsets_text: '0.1,0\n-0.1,0',
        translate_border_value: 114,
      },
      previewLoading: false,
      previewData: null,
      creating: false,
      publishing: false,
      jobId: null,
      job: null,
      logs: [],
      wsHandle: null,
      pollTimer: null,
      wsDisconnected: false,
      publish: {
        activate: false,
        message: '',
        created_by: 'admin',
      },
    };
  },
  computed: {
    isRunning() {
      const status = String(this.job && this.job.status || '').toLowerCase();
      return status === 'queued' || status === 'running';
    },
    canPublish() {
      const status = String(this.job && this.job.status || '').toLowerCase();
      const publishedId = this.job && this.job.result && this.job.result.published_standard_dataset_id;
      return status === 'completed' && !publishedId;
    },
    statusText() {
      const map = { queued: '排队中', running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' };
      const status = String(this.job && this.job.status || '').toLowerCase();
      return map[status] || status || '-';
    },
    statusTagType() {
      const status = String(this.job && this.job.status || '').toLowerCase();
      if (status === 'completed') return 'success';
      if (status === 'failed') return 'danger';
      if (status === 'running') return '';
      return 'info';
    },
    phaseText() {
      const map = {
        preparing: '准备中',
        scanning: '扫描样本',
        augmenting: '执行扩增',
        finalizing: '整理输出',
        done: '完成',
        failed: '失败',
        cancelled: '已取消',
      };
      const phase = String(this.job && this.job.phase || '').toLowerCase();
      return map[phase] || phase || '-';
    },
  },
  watch: {
    logs() {
      this.$nextTick(() => {
        const box = this.$refs.logBox;
        if (box) box.scrollTop = box.scrollHeight;
      });
    },
  },
  beforeDestroy() {
    this.stopStream();
    this.stopPolling();
  },
  methods: {
    parseNumberList(text) {
      return String(text || '')
        .split(/[\s,]+/)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
    },
    parseOffsets(text) {
      return String(text || '')
        .split(/\n+/)
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .map((line) => line.split(/[\s,]+/).filter(Boolean))
        .filter((parts) => parts.length >= 2)
        .map((parts) => ({ dx: Number(parts[0]), dy: Number(parts[1]) }))
        .filter((item) => Number.isFinite(item.dx) && Number.isFinite(item.dy));
    },
    buildPayload() {
      return {
        include_original: !!this.form.include_original,
        max_outputs_per_image: Number(this.form.max_outputs_per_image) || 200,
        slice: {
          enabled: !!this.form.slice_enabled,
          scales: this.parseNumberList(this.form.slice_scales_text).map((value) => Math.max(32, Math.round(value))),
          overlap: Number(this.form.slice_overlap) || 0,
          min_area_ratio: Number(this.form.slice_min_area_ratio) || 0,
          min_visibility: Number(this.form.slice_min_visibility) || 0,
          min_pixel_size: Number(this.form.slice_min_pixel_size) || 1,
        },
        rotate: {
          enabled: !!this.form.rotate_enabled,
          angles: this.parseNumberList(this.form.rotate_angles_text),
          border_value: Number(this.form.rotate_border_value) || 114,
        },
        translate: {
          enabled: !!this.form.translate_enabled,
          offsets: this.parseOffsets(this.form.translate_offsets_text),
          border_value: Number(this.form.translate_border_value) || 114,
        },
      };
    },
    appendLog(text) {
      this.logs.push({ id: `${Date.now()}_${Math.random()}`, ts: new Date().toLocaleTimeString(), text: String(text || '') });
      if (this.logs.length > 500) {
        this.logs.splice(0, this.logs.length - 500);
      }
    },
    async runPreview() {
      this.previewLoading = true;
      try {
        this.previewData = await previewStandardAugmentation(this.datasetId, this.buildPayload());
      } catch (error) {
        this.$message.error(error.message || '测算失败');
      } finally {
        this.previewLoading = false;
      }
    },
    async startJob() {
      this.creating = true;
      try {
        const row = await createStandardAugmentationJob(this.datasetId, this.buildPayload());
        this.jobId = row.job_id;
        this.job = row;
        this.logs = [];
        this.appendLog(`已创建增强任务：${row.job_id}`);
        this.startStream(row.job_id);
      } catch (error) {
        this.$message.error(error.message || '启动任务失败');
      } finally {
        this.creating = false;
      }
    },
    async refreshJob() {
      if (!this.jobId) return;
      try {
        this.job = await fetchStandardAugmentationJob(this.datasetId, this.jobId);
        this.$message.success('任务状态已刷新');
      } catch (error) {
        this.$message.error(error.message || '刷新失败');
      }
    },
    async cancelJob() {
      if (!this.jobId) return;
      try {
        await cancelStandardAugmentationJob(this.datasetId, this.jobId);
        this.appendLog('已发送取消请求');
        await this.refreshJob();
      } catch (error) {
        this.$message.error(error.message || '取消失败');
      }
    },
    async publishJob() {
      if (!this.jobId) return;
      this.publishing = true;
      try {
        const out = await publishStandardAugmentationJob(this.datasetId, this.jobId, this.publish);
        this.appendLog(`发布成功，新的标准数据集 ID：${out.standard_dataset_id}`);
        this.job = await fetchStandardAugmentationJob(this.datasetId, this.jobId).catch(() => this.job);
        this.$emit('published', out);
      } catch (error) {
        this.$message.error(error.message || '发布失败');
      } finally {
        this.publishing = false;
      }
    },
    startStream(jobId) {
      this.stopStream();
      this.stopPolling();
      this.wsDisconnected = false;
      this.wsHandle = openStandardAugmentationStream(this.datasetId, jobId, {
        onSnapshot: (data) => {
          this.job = data;
          this.jobId = data.job_id || jobId;
        },
        onProgress: (data) => {
          this.job = { ...(this.job || {}), ...data };
        },
        onItem: (item) => {
          this.appendLog(`${item.source_image || '-'} → 生成 ${item.generated || 0} 张增强样本`);
        },
        onDone: (data) => {
          this.job = { ...(this.job || {}), ...data };
          this.wsDisconnected = false;
          this.stopPolling();
          this.appendLog('增强任务已结束');
        },
        onOpen: () => {
          this.wsDisconnected = false;
          this.stopPolling();
          this.appendLog('已建立实时进度连接');
        },
        onClose: () => {
          if (this.isRunning) {
            this.wsDisconnected = true;
            this.startPolling();
          }
        },
        onError: (error) => {
          if (error) this.appendLog(`连接异常：${error.message || error}`);
        },
      });
    },
    stopStream() {
      if (this.wsHandle && typeof this.wsHandle.close === 'function') {
        this.wsHandle.close();
      }
      this.wsHandle = null;
    },
    startPolling() {
      this.stopPolling();
      this.pollTimer = setInterval(async () => {
        if (!this.jobId) return;
        try {
          this.job = await fetchStandardAugmentationJob(this.datasetId, this.jobId);
          const status = String(this.job && this.job.status || '').toLowerCase();
          if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            this.stopPolling();
          }
        } catch (_) {
          // ignore polling errors
        }
      }, 5000);
    },
    stopPolling() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    },
  },
};
</script>

<style scoped>
.manual-aug-panel {
  min-height: 560px;
}

.aug-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
  gap: 20px;
}

.aug-config,
.aug-status {
  min-width: 0;
}

.config-section,
.glass-panel,
.terminal-panel {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
}

.config-section {
  margin-bottom: 16px;
}

.config-section.is-disabled {
  opacity: 0.85;
}

.section-title {
  padding: 14px 16px;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
  color: #303133;
}

.section-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-left i {
  margin-right: 6px;
  color: #409eff;
}

.section-content {
  padding: 16px;
}

.full-width {
  width: 100%;
}

.mono-input :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.glass-panel {
  padding: 16px;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.preview-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  border-radius: 10px;
  background: #f5f7fa;
  padding: 12px;
  text-align: center;
}

.stat-item.highlight {
  background: #ecf5ff;
}

.stat-item.total {
  background: #f0f9eb;
}

.stat-val {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.stat-lbl {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.job-block {
  margin-top: 12px;
}

.job-row,
.job-meta,
.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.job-row {
  margin-bottom: 10px;
}

.job-meta {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}

.error-text {
  margin-top: 8px;
  color: #f56c6c;
}

.warn-text {
  margin-top: 8px;
  color: #e6a23c;
}

.publish-card {
  background: linear-gradient(180deg, #f0f9eb 0%, #ffffff 100%);
}

.publish-title {
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.publish-hint {
  margin: 8px 0 16px;
  color: #606266;
  line-height: 1.6;
}

.full-width {
  width: 100%;
}

.terminal-panel {
  overflow: hidden;
}

.terminal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
}

.terminal-body {
  height: 260px;
  overflow: auto;
  padding: 12px 16px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.terminal-empty {
  color: #94a3b8;
}

.log-line + .log-line {
  margin-top: 6px;
}

.log-ts {
  color: #67e8f9;
}

.log-msg {
  margin-left: 8px;
}

@media (max-width: 992px) {
  .aug-layout {
    grid-template-columns: 1fr;
  }

  .preview-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
