<template>
    <div class="conversion-container">
        <div class="tool-header premium-header">
            <div class="header-content">
                <h3 class="gradient-text"><i class="el-icon-refresh"></i> 模型格式转换</h3>
                <p>将 PyTorch (.pt) 模型转换为 ONNX 以进行部署。</p>
            </div>
            <div class="tool-actions">
                <el-button class="action-btn" size="medium" @click="handleReset" :disabled="converting">
                    <i class="el-icon-refresh-right"></i> 重置
                </el-button>
                <el-button type="primary" size="medium" class="action-btn primary-btn" @click="startConversion" :loading="converting">
                    <i class="el-icon-cpu"></i> {{ converting ? '转换中...' : '开始转换' }}
                </el-button>
            </div>
        </div>

        <div class="content-wrapper">
            <!-- Configuration Panel -->
            <div class="config-panel glass-panel-sm">
                <div class="panel-header">
                    <i class="el-icon-setting"></i> 转换配置
                </div>

                <div class="config-form">
                    <div class="form-row">
                        <label>源格式</label>
                        <el-radio-group v-model="form.sourceFormat" :disabled="converting" size="small">
                            <el-radio-button label="pt">PyTorch (.pt)</el-radio-button>
                            <!-- <el-radio-button label="pdmodel" disabled>Paddle (即将推出)</el-radio-button> -->
                        </el-radio-group>
                    </div>

                    <div class="form-row">
                        <label>目标格式</label>
                        <el-radio-group v-model="form.targetFormat" :disabled="converting" size="small">
                            <el-radio-button label="onnx">ONNX</el-radio-button>
                            <!-- <el-radio-button label="tensorrt" disabled>TensorRT (即将推出)</el-radio-button> -->
                        </el-radio-group>
                    </div>

                    <div class="form-row upload-row">
                        <label>模型文件</label>
                        <el-upload
                            class="upload-area"
                            drag
                            action="#"
                            :auto-upload="false"
                            :on-change="handleFileChange"
                            :show-file-list="false"
                            :disabled="converting"
                            accept=".pt,.pth"
                        >
                            <div v-if="!uploadFile" class="upload-placeholder">
                                <i class="el-icon-upload"></i>
                                <div class="upload-text">拖拽 .pt 文件到此处</div>
                            </div>
                            <div v-else class="upload-file">
                                <i class="el-icon-document"></i>
                                <span class="filename" :title="uploadFile.name">{{ uploadFile.name }}</span>
                                <i class="el-icon-close remove-btn" @click.stop="removeFile"></i>
                            </div>
                        </el-upload>
                    </div>

                    <div class="advanced-grid">
                        <div class="param-item">
                            <span class="label">Opset 版本</span>
                            <el-input-number v-model="form.opset" :min="9" :max="17" :disabled="converting" size="mini" controls-position="right" />
                        </div>
                        <div class="param-item">
                            <span class="label">精度</span>
                            <el-select v-model="form.precision" size="mini" :disabled="converting">
                                <el-option label="FP32" value="FP32" />
                            <el-option label="FP16" value="FP16" />
                            <el-option label="INT8" value="INT8" />
                            </el-select>
                        </div>
                        <div class="param-item switch">
                            <span class="label">动态形状</span>
                            <el-switch v-model="form.dynamicShape" :disabled="converting" />
                        </div>
                        <div class="param-item switch">
                            <span class="label">量化</span>
                            <el-switch v-model="form.enableQuant" :disabled="converting" />
                        </div>
                         <div class="param-item wide">
                            <span class="label">最小形状</span>
                            <el-input v-model="form.minShape" size="mini" :disabled="converting" />
                        </div>
                        <div class="param-item wide">
                            <span class="label">最大形状</span>
                            <el-input v-model="form.maxShape" size="mini" :disabled="converting" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Status Panel -->
            <div class="status-panel">
                <div class="output-card glass-panel-sm">
                    <div class="panel-header">
                        <i class="el-icon-data-line"></i> 状态与日志
                    </div>
                    <div class="progress-section">
                        <div class="progress-info">
                            <span>进度</span>
                            <span>{{ progress }}%</span>
                        </div>
                        <el-progress :percentage="progress" :stroke-width="8" :show-text="false" status="success" />
                    </div>
                    <div class="log-terminal">
                        <div v-for="(log, idx) in logs" :key="idx" class="log-line">{{ log }}</div>
                        <div v-if="logs.length === 0" class="log-empty">等待任务...</div>
                    </div>
                </div>

                <div class="output-card glass-panel-sm result-card" v-if="result">
                    <div class="panel-header">
                        <i class="el-icon-check"></i> 转换结果
                    </div>
                    <div class="result-details">
                        <div class="detail-row">
                            <span class="label">文件</span>
                            <span class="val">{{ result.filename }}</span>
                        </div>
                        <div class="detail-row">
                             <span class="label">大小</span>
                             <span class="val">
                                {{ isNumber(compare.size.new) ? compare.size.new + ' MB' : '-' }}
                                <span v-if="compare.size.base" class="sub-val">({{ compare.size.base }} MB)</span>
                             </span>
                        </div>
                         <div class="detail-row">
                             <span class="label">延迟</span>
                             <span class="val">
                                {{ isNumber(compare.latency.new) ? compare.latency.new + ' ms' : '-' }}
                                <span v-if="compare.latency.base" class="sub-val">({{ compare.latency.base }} ms)</span>
                             </span>
                        </div>
                         <div class="detail-row">
                             <span class="label">吞吐量</span>
                             <span class="val">
                                {{ isNumber(compare.throughput.new) ? compare.throughput.new + ' img/s' : '-' }}
                                <span v-if="compare.throughput.base" class="sub-val">({{ compare.throughput.base }} img/s)</span>
                             </span>
                        </div>
                    </div>
                     <div class="result-actions">
                        <el-button type="primary" size="small" class="primary-btn" @click="downloadResult">
                            <i class="el-icon-download"></i> 下载 ONNX
                        </el-button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { API_BASE } from "@/utils/request";
import { createModelConversion, fetchModelConversion } from "@/api/modelConversions";

export default {
    name: 'ModelFormatConversion',
    props: {
        // 支持外部状态管理
        externalState: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            internalForm: {
                sourceFormat: 'pt', targetFormat: 'onnx', opset: 12, precision: 'FP32',
                batchSize: 8, threads: 8, dynamicShape: true, enableQuant: false,
                minShape: '1x3x640x640', maxShape: '8x3x1280x1280'
            },
            internalUploadFile: null, 
            internalConverting: false, 
            internalProgress: 0, 
            internalLogs: [], 
            internalResult: null, 
            internalJobId: null, 
            pollTimer: null,
            internalCompare: { latency: { base: null, new: null }, throughput: { base: null, new: null }, size: { base: null, new: null } }
        };
    },
    computed: {
        // 优先使用外部状态
        form: {
            get() { return this.externalState?.form ?? this.internalForm; },
            set(val) { this.internalForm = val; this.syncState(); }
        },
        uploadFile: {
            get() { return this.externalState?.uploadFile ?? this.internalUploadFile; },
            set(val) { this.internalUploadFile = val; this.syncState(); }
        },
        converting: {
            get() { return this.externalState?.converting ?? this.internalConverting; },
            set(val) { this.internalConverting = val; this.syncState(); }
        },
        progress: {
            get() { return this.externalState?.progress ?? this.internalProgress; },
            set(val) { this.internalProgress = val; this.syncState(); }
        },
        logs: {
            get() { return this.externalState?.logs ?? this.internalLogs; },
            set(val) { this.internalLogs = val; this.syncState(); }
        },
        result: {
            get() { return this.externalState?.result ?? this.internalResult; },
            set(val) { this.internalResult = val; this.syncState(); }
        },
        jobId: {
            get() { return this.externalState?.jobId ?? this.internalJobId; },
            set(val) { this.internalJobId = val; this.syncState(); }
        },
        compare: {
            get() { return this.externalState?.compare ?? this.internalCompare; },
            set(val) { this.internalCompare = val; this.syncState(); }
        }
    },
    watch: {
        // 恢复轮询
        jobId: {
            immediate: true,
            handler(newVal) {
                if (newVal && this.converting && !this.pollTimer) {
                    this.pollTimer = setInterval(this.pollStatus, 1000);
                }
            }
        }
    },
    methods: {
        syncState() {
            this.$emit('update:externalState', {
                form: this.internalForm,
                uploadFile: this.internalUploadFile,
                converting: this.internalConverting,
                progress: this.internalProgress,
                logs: this.internalLogs,
                result: this.internalResult,
                jobId: this.internalJobId,
                compare: this.internalCompare
            });
        },
        isNumber(v) { return typeof v === 'number' && !isNaN(v); },
        round(v, digits = 2) {
            const n = Number(v);
            if (!Number.isFinite(n)) return null;
            const p = Math.pow(10, digits);
            return Math.round(n * p) / p;
        },
        updatePerformanceFromStatus(st) {
            const perf = st && (st.performance || st.perf);
            if (!perf) return;

            const pt = (perf && perf.pt) || {};
            const targetKey = this.form.targetFormat || 'onnx';
            const target = (perf && perf[targetKey]) || {};

            const ptLat = this.isNumber(pt.latency_ms) ? this.round(pt.latency_ms, 2) : null;
            const targetLat = this.isNumber(target.latency_ms) ? this.round(target.latency_ms, 2) : null;
            const ptThr = this.isNumber(pt.throughput_img_s) ? this.round(pt.throughput_img_s, 2) : null;
            const targetThr = this.isNumber(target.throughput_img_s) ? this.round(target.throughput_img_s, 2) : null;
            const ptSize = this.isNumber(pt.size_mb) ? this.round(pt.size_mb, 2) : null;
            const targetSize = this.isNumber(target.size_mb) ? this.round(target.size_mb, 2) : null;

            this.compare = {
                latency: { base: ptLat, new: targetLat },
                throughput: { base: ptThr, new: targetThr },
                size: { base: ptSize, new: targetSize }
            };
        },
        handleFileChange(file) { this.uploadFile = file.raw || file; },
        removeFile() { if(!this.converting) this.uploadFile = null; },
        resolveErrorMessage(st, fallback = '转换失败') {
            const msg = String(st?.error_message || '').trim();
            if (msg) return msg;
            const logs = Array.isArray(st?.logs) ? st.logs : [];
            for (let i = logs.length - 1; i >= 0; i -= 1) {
                const line = String(logs[i] || '').trim();
                if (!line) continue;
                if (/error|failed|exception|not found|unauthorized|export/i.test(line)) return line;
            }
            return fallback;
        },
        handleReset() {
             this.stopPolling();
             this.form = { ...this.form, sourceFormat: 'pt', targetFormat: 'onnx' };
             this.uploadFile = null; this.result = null; this.logs = []; this.progress = 0;
        },
        async startConversion() {
             console.log('Starting conversion...');
             if (!this.uploadFile) {
                 this.$message.warning('请先选择模型文件。');
                 return;
             }
             
             this.converting = true; 
             this.logs = ['正在初始化任务...', '正在上传模型: ' + this.uploadFile.name]; 
             this.progress = 0; 
             this.result = null;
             
             try {
                console.log('Sending request to API...');
                const job = await createModelConversion({
                    file: this.uploadFile, 
                    source_format: this.form.sourceFormat, 
                    target_format: this.form.targetFormat,
                    opset: this.form.opset, 
                    dynamic: this.form.dynamicShape
                });
                console.log('Job created:', job);
                
                this.jobId = job?.job_id;
                this.progress = Number(job?.progress) || 0;
                this.logs = Array.isArray(job?.logs) && job.logs.length
                    ? job.logs.slice()
                    : this.logs;
                this.updatePerformanceFromStatus(job);
                if (job?.status === 'failed') {
                    this.converting = false;
                    const msg = this.resolveErrorMessage(job, '启动转换失败');
                    this.logs = [...this.logs, msg];
                    this.$message.error(msg);
                    return;
                }
                this.logs.push(`任务 ID: ${this.jobId}`, '等待服务器...');
                this.pollTimer = setInterval(this.pollStatus, 1000);
             } catch (e) {
                 console.error('Conversion Error:', e);
                 this.converting = false; 
                 this.logs.push('错误详情: ' + (e.message || e));
                 this.$message.error('启动转换失败: ' + e.message);
             }
        },
        async pollStatus() {
            if (!this.jobId) return;
            try {
                const st = await fetchModelConversion(this.jobId);
                this.progress = Number(st.progress) || 0;
                this.logs = st.logs || [];
                this.updatePerformanceFromStatus(st);
                if (st.status === 'completed') {
                    this.finish(st);
                } else if (st.status === 'failed') {
                    this.stopPolling();
                    this.converting = false;
                    this.$message.error(this.resolveErrorMessage(st, '转换失败'));
                }
            } catch(e) {
                this.stopPolling();
                this.converting = false;
                const msg = e && e.message ? e.message : '获取转换状态失败';
                this.logs = [...(Array.isArray(this.logs) ? this.logs : []), '状态查询失败: ' + msg];
                this.$message.error('状态查询失败: ' + msg);
            }
        },
        finish(st) {
             this.stopPolling(); this.converting = false;
             this.result = { filename: st.output_filename || 'opt.onnx', download_url: st.output_url };
             this.updatePerformanceFromStatus(st);
        },
        stopPolling() {
            if (this.pollTimer) clearInterval(this.pollTimer);
            this.pollTimer = null;
        },
        downloadResult() {
            const url = this.result?.download_url;
            if(!url) return;
            const fullUrl = url.startsWith('http') ? url : API_BASE + url;
            const a = document.createElement('a'); a.href = fullUrl; a.download=''; a.click();
        }
    },
    beforeDestroy() { this.stopPolling(); }
};
</script>

<style scoped>
.conversion-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow: hidden;
}

.premium-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
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
    flex-wrap: wrap;
    justify-content: flex-end;
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

.content-wrapper {
    flex: 1;
    display: flex;
    gap: 1.5rem;
    min-height: 0; /* Important for scrolling */
}

/* Config Panel */
.config-panel {
    flex: 0 0 400px;
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    background: rgba(255,255,255,0.5);
}

.panel-header {
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.config-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    overflow-y: auto;
    padding-right: 0.5rem;
}

.form-row { display: flex; flex-direction: column; gap: 0.5rem; }
.form-row label { font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); }

.upload-area { width: 100%; }
.upload-area >>> .el-upload { width: 100%; }
.upload-area >>> .el-upload-dragger { 
    width: 100%; height: auto; min-height: 100px; 
    border: 1px dashed var(--color-primary-light);
    background: rgba(255,255,255,0.5);
    display: flex; align-items: center; justify-content: center;
}

.upload-placeholder { padding: 1.5rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
.upload-file { padding: 1rem; display: flex; align-items: center; gap: 0.5rem; width: 100%; }
.filename { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; color: var(--text-main); text-align: left; }
.remove-btn { cursor: pointer; color: #ef4444; }

.advanced-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}
.param-item { display: flex; flex-direction: column; gap: 0.25rem; }
.param-item.switch { flex-direction: row; justify-content: space-between; align-items: center; border: 1px solid rgba(0,0,0,0.05); padding: 0.5rem; border-radius: var(--radius-sm); background: rgba(255,255,255,0.3); }
.param-item.wide { grid-column: 1 / -1; }
.param-item .label { font-size: 0.75rem; color: var(--text-secondary); }

/* Status Panel */
.status-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
}

.output-card {
    background: #1e293b; /* Dark theme for logs */
    color: #e2e8f0;
    display: flex;
    flex-direction: column;
    flex: 1; /* take remaining height */
    padding: 1.25rem;
    border: none; 
}
.output-card .panel-header { color: #fff; }

.progress-section { margin-bottom: 1rem; }
.progress-info { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem; opacity: 0.8; }

.log-terminal {
    flex: 1;
    background: #0f172a;
    border-radius: var(--radius-md);
    padding: 1rem;
    font-family: monospace;
    font-size: 0.8rem;
    overflow-y: auto;
    color: #38bdf8;
    border: 1px solid #334155;
}
.log-line { margin-bottom: 0.25rem; }
.log-empty { color: #475569; font-style: italic; }

.result-card {
    flex: 0 0 auto;
    background: rgba(255,255,255,0.8);
    color: var(--text-main);
    border: 1px solid rgba(255,255,255,0.5);
}
.result-card .panel-header { color: var(--text-main); }
.result-details { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.detail-row { display: flex; flex-direction: column; gap: 0.25rem; }
.detail-row .label { font-size: 0.75rem; color: var(--text-secondary); }
.detail-row .val { font-weight: 600; font-size: 0.9rem; }
.sub-val { font-weight: 400; font-size: 0.8rem; color: var(--text-secondary); margin-left: 0.5rem; }

.primary-btn { font-weight: 600; }
</style>
