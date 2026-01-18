<template>
    <div class="conversion-container">
        <!-- 顶部标题与操作 -->
        <div class="top-bar">
            <div>
                <h3>模型格式转换</h3>
                <p class="subtitle">支持 PyTorch/Paddle 转 ONNX 或 TensorRT，查看转换进度与性能对比</p>
            </div>
            <div class="top-actions">
                <el-button class="custom-default-btn" @click="handleReset" :disabled="converting">
                    <i class="el-icon-refresh"></i> 重置
                </el-button>
                <el-button type="primary" class="custom-primary-btn" @click="startConversion" :loading="converting">
                    <i class="el-icon-cpu"></i> {{ converting ? '转换中...' : '开始转换' }}
                </el-button>
            </div>
        </div>

        <div class="content-wrapper">
            <!-- 左侧：配置与上传 -->
            <div class="left-panel section-card">
                <div class="section-title">
                    <i class="el-icon-setting"></i>
                    转换配置
                </div>

                <div class="config-group">
                    <label class="group-label">源格式</label>
                    <el-radio-group v-model="form.sourceFormat" :disabled="converting">
                        <el-radio-button label="pt">PyTorch (.pt/.pth)</el-radio-button>
                        <el-radio-button label="pdmodel">Paddle (.pdmodel)</el-radio-button>
                    </el-radio-group>
                </div>

                <div class="config-group">
                    <label class="group-label">目标格式</label>
                    <el-radio-group v-model="form.targetFormat" :disabled="converting">
                        <el-radio-button label="onnx">ONNX</el-radio-button>
                        <el-radio-button label="tensorrt">TensorRT</el-radio-button>
                    </el-radio-group>
                </div>

                <div class="config-group">
                    <label class="group-label">模型文件</label>
                    <el-upload
                        class="upload-area"
                        drag
                        action="#"
                        :auto-upload="false"
                        :on-change="handleFileChange"
                        :disabled="converting"
                        :accept="form.sourceFormat === 'pt' ? '.pt,.pth' : '.pdmodel'"
                    >
                        <i class="el-icon-upload"></i>
                        <div class="upload-text">点击或拖拽模型文件到此处</div>
                        <div class="upload-tip">支持单个模型文件，大小&lt; 1GB</div>
                    </el-upload>
                    <div v-if="uploadFile" class="file-chip">
                        <i class="el-icon-document"></i>
                        <span class="name">{{ uploadFile.name }}</span>
                        <el-button type="text" size="mini" @click="removeFile" :disabled="converting">移除</el-button>
                    </div>
                </div>

                <div class="config-grid">
                    <div class="config-item">
                        <div class="label">Opset</div>
                        <el-input-number v-model="form.opset" :min="9" :max="17" :disabled="converting" />
                    </div>
                    <div class="config-item">
                        <div class="label">精度</div>
                        <el-select v-model="form.precision" placeholder="选择精度" :disabled="converting">
                            <el-option label="FP32" value="FP32" />
                            <el-option label="FP16" value="FP16" />
                            <el-option label="INT8" value="INT8" />
                        </el-select>
                    </div>
                    <div class="config-item">
                        <div class="label">Batch Size</div>
                        <el-slider v-model="form.batchSize" :min="1" :max="32" :step="1" show-input :disabled="converting" />
                    </div>
                    <div class="config-item">
                        <div class="label">线程数</div>
                        <el-slider v-model="form.threads" :min="1" :max="16" :step="1" show-input :disabled="converting" />
                    </div>
                    <div class="config-item switch-item">
                        <div class="label">动态 Shape</div>
                        <el-switch v-model="form.dynamicShape" :active-color="'#10b981'" :disabled="converting" />
                    </div>
                    <div class="config-item switch-item">
                        <div class="label">量化</div>
                        <el-switch v-model="form.enableQuant" :active-color="'#10b981'" :disabled="converting" />
                    </div>
                    <div class="config-item">
                        <div class="label">最小 Shape</div>
                        <el-input v-model="form.minShape" placeholder="1x3x640x640" :disabled="converting" />
                    </div>
                    <div class="config-item">
                        <div class="label">最大 Shape</div>
                        <el-input v-model="form.maxShape" placeholder="8x3x1280x1280" :disabled="converting" />
                    </div>
                </div>

                <div class="note">
                    <i class="el-icon-warning-outline"></i>
                    TensorRT 需本地环境支持；INT8 需提供校准集；动态 Shape 仅在支持的后端生效。
                </div>
            </div>

            <!-- 右侧：进度与对比 -->
            <div class="right-panel">
                <div class="section-card">
                    <div class="section-title">
                        <i class="el-icon-time"></i>
                        转换进度与日志
                    </div>
                    <div class="progress-row">
                        <el-progress :percentage="progress" :stroke-width="12" status="success" />
                        <span class="progress-text">{{ converting ? '正在转换...' : progress === 100 ? '完成' : '待开始' }}</span>
                    </div>
                    <div class="log-box">
                        <div v-for="(log, idx) in logs" :key="idx" class="log-line">{{ log }}</div>
                        <div v-if="logs.length === 0" class="log-empty">尚无日志</div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-title">
                        <i class="el-icon-data-analysis"></i>
                        性能对比
                    </div>
                    <div class="stat-grid">
                        <div class="stat-card">
                            <div class="stat-label">延迟 (ms)</div>
                            <div class="stat-value">{{ compare.latency.new }} <span class="diff" :class="{ good: compare.latency.delta < 0 }">{{ formatDelta(compare.latency.delta) }}</span></div>
                            <div class="stat-sub">原始: {{ compare.latency.base }} ms</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">吞吐 (img/s)</div>
                            <div class="stat-value">{{ compare.throughput.new }} <span class="diff good">{{ formatDelta(compare.throughput.delta) }}</span></div>
                            <div class="stat-sub">原始: {{ compare.throughput.base }} img/s</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">模型大小</div>
                            <div class="stat-value">{{ compare.size.new }} MB <span class="diff" :class="{ good: compare.size.delta < 0 }">{{ formatDelta(compare.size.delta) }} MB</span></div>
                            <div class="stat-sub">原始: {{ compare.size.base }} MB</div>
                        </div>
                    </div>
                    <div class="badge-row">
                        <span class="flag primary">{{ form.targetFormat === 'onnx' ? 'ONNX IR' : 'TensorRT Engine' }}</span>
                        <span class="flag" :class="form.precision === 'INT8' ? 'success' : 'info'">{{ form.precision }}</span>
                        <span class="flag" :class="form.dynamicShape ? 'warning' : 'muted'">动态 Shape {{ form.dynamicShape ? '开' : '关' }}</span>
                        <span class="flag" :class="form.enableQuant ? 'success' : 'muted'">量化 {{ form.enableQuant ? '启用' : '默认' }}</span>
                    </div>
                </div>

                <div class="section-card">
                    <div class="section-title">
                        <i class="el-icon-document"></i>
                        转换结果
                    </div>
                    <div v-if="result" class="result-grid">
                        <div class="result-item">
                            <span class="label">输出文件</span>
                            <span class="value">{{ result.filename }}</span>
                        </div>
                        <div class="result-item">
                            <span class="label">路径</span>
                            <span class="value">/outputs/{{ result.filename }}</span>
                        </div>
                        <div class="result-item">
                            <span class="label">大小</span>
                            <span class="value">{{ compare.size.new }} MB</span>
                        </div>
                        <div class="result-item">
                            <span class="label">配置摘要</span>
                            <span class="value">Opset {{ form.opset }} · BS {{ form.batchSize }} · {{ form.precision }}</span>
                        </div>
                        <div class="result-actions">
                            <el-button type="primary" size="small" class="custom-primary-btn" @click="downloadResult">
                                <i class="el-icon-download"></i> 下载
                            </el-button>
                            <el-button size="small" @click="copyLog">复制日志</el-button>
                        </div>
                    </div>
                    <div v-else class="empty-box">转换完成后展示结果</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ModelFormatConversion',
    data() {
        return {
            form: {
                sourceFormat: 'pt',
                targetFormat: 'onnx',
                opset: 12,
                precision: 'FP32',
                batchSize: 8,
                threads: 8,
                dynamicShape: true,
                enableQuant: false,
                minShape: '1x3x640x640',
                maxShape: '8x3x1280x1280'
            },
            uploadFile: null,
            converting: false,
            progress: 0,
            logs: [],
            result: null,
            compare: {
                latency: { base: 35, new: 24, delta: -11 },
                throughput: { base: 120, new: 178, delta: 58 },
                size: { base: 180, new: 96, delta: -84 }
            }
        };
    },
    methods: {
        handleFileChange(file) {
            this.uploadFile = file.raw || file;
        },
        removeFile() {
            if (this.converting) return;
            this.uploadFile = null;
        },
        startConversion() {
            if (!this.uploadFile) {
                this.$message.warning('请先选择模型文件');
                return;
            }
            this.converting = true;
            this.progress = 0;
            this.logs = ['开始转换：' + this.uploadFile.name];
            this.result = null;

            const steps = [
                '校验文件与格式...',
                '导出中间表示...',
                this.form.targetFormat === 'onnx' ? '生成 ONNX 文件...' : '构建 TensorRT Engine...',
                '应用优化与精度配置...',
                '写入输出...' 
            ];

            let idx = 0;
            const timer = setInterval(() => {
                if (this.progress < 100) {
                    this.progress = Math.min(100, this.progress + 12);
                    if (idx < steps.length) {
                        this.logs.push(steps[idx]);
                        idx++;
                    }
                } else {
                    clearInterval(timer);
                    this.converting = false;
                    this.logs.push('转换完成');
                    const ext = this.form.targetFormat === 'onnx' ? 'onnx' : 'engine';
                    this.result = {
                        filename: `${this.uploadFile.name.split('.')[0]}_export.${ext}`
                    };
                    this.$message.success('转换完成');
                }
            }, 500);
        },
        handleReset() {
            this.form = {
                sourceFormat: 'pt',
                targetFormat: 'onnx',
                opset: 12,
                precision: 'FP32',
                batchSize: 8,
                threads: 8,
                dynamicShape: true,
                enableQuant: false,
                minShape: '1x3x640x640',
                maxShape: '8x3x1280x1280'
            };
            this.uploadFile = null;
            this.progress = 0;
            this.logs = [];
            this.result = null;
        },
        formatDelta(val) {
            const sign = val > 0 ? '+' : '';
            return `${sign}${val}`;
        },
        downloadResult() {
            this.$message.success('模拟下载：' + (this.result ? this.result.filename : ''));
        },
        copyLog() {
            const text = this.logs.join('\n');
            navigator.clipboard && navigator.clipboard.writeText(text);
            this.$message.success('日志已复制');
        }
    }
};
</script>

<style scoped>
.conversion-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-right: 6px;
}

.top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.top-bar h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #111f68;
}

.subtitle {
    margin: 2px 0 0 0;
    color: #6c757d;
    font-size: 13px;
}

.top-actions {
    display: flex;
    gap: 10px;
}

.content-wrapper {
    display: grid;
    grid-template-columns: 40% 60%;
    gap: 16px;
}

.section-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e8ecef;
}

.left-panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.right-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.section-title {
    font-size: 15px;
    font-weight: 600;
    color: #111f68;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.group-label {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
    margin-bottom: 6px;
}

.config-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.upload-area {
    background: transparent;
    border: none;
}

.upload-area >>> .el-upload {
    width: 100%;
}

.upload-area >>> .el-upload-dragger {
    background: linear-gradient(135deg, #f0f3f9 0%, #ffffff 100%);
    border: 2px dashed #111f68;
    border-radius: 12px;
    padding: 36px 20px;
    min-height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    transition: all 0.3s;
}

.upload-area >>> .el-upload-dragger:hover {
    border-color: #111f68;
    box-shadow: 0 8px 20px rgba(17, 31, 104, 0.15);
}

.upload-area i {
    font-size: 44px;
    color: #111f68;
}

.upload-text {
    font-size: 15px;
    font-weight: 600;
    color: #111f68;
}

.upload-tip {
    font-size: 12px;
    color: #6c757d;
}

.file-chip {
    margin-top: 6px;
    padding: 8px 10px;
    background: #f9fafb;
    border: 1px solid #e8ecef;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.file-chip .name {
    flex: 1;
    color: #111f68;
}

.config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
}

.config-item {
    padding: 12px;
    border: 1.5px solid #e8ecef;
    border-radius: 10px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.config-item .label {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.switch-item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}

.note {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    font-size: 12px;
    color: #6c757d;
    background: #f9fafb;
    border: 1px solid #e8ecef;
    padding: 10px;
    border-radius: 10px;
}

.progress-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.progress-row .el-progress {
    flex: 1;
}

.progress-text {
    font-size: 12px;
    color: #6c757d;
}

.log-box {
    margin-top: 10px;
    background: #0b102c;
    color: #e5e7eb;
    font-family: Menlo, Consolas, monospace;
    font-size: 12px;
    border-radius: 10px;
    padding: 10px;
    min-height: 120px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #1f2a44;
}

.log-line + .log-line {
    margin-top: 6px;
}

.log-empty {
    color: #9ca3af;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
}

.stat-card {
    border: 1.5px solid #e8ecef;
    border-radius: 10px;
    padding: 12px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
}

.stat-label {
    font-size: 12px;
    color: #8e9aaf;
    margin-bottom: 4px;
}

.stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #111f68;
}

.stat-sub {
    font-size: 12px;
    color: #6c757d;
    margin-top: 4px;
}

.diff {
    margin-left: 6px;
    font-size: 12px;
    color: #d97706;
}

.diff.good {
    color: #0f9f75;
}

.badge-row {
    margin-top: 10px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.flag {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    border: 1px solid transparent;
}

.flag.primary { background: rgba(17, 31, 104, 0.12); color: #111f68; border-color: #111f68; }
.flag.success { background: rgba(16, 185, 129, 0.12); color: #0f9f75; border-color: #0f9f75; }
.flag.info { background: rgba(6, 182, 212, 0.12); color: #0891b2; border-color: #0891b2; }
.flag.warning { background: rgba(245, 158, 11, 0.12); color: #d97706; border-color: #d97706; }
.flag.muted { background: #f3f4f6; color: #6b7280; border-color: #e5e7eb; }

.result-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
}

.result-item {
    padding: 10px;
    border: 1px solid #e8ecef;
    border-radius: 10px;
    background: #f9fafb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
}

.result-item .label {
    color: #6c757d;
}

.result-item .value {
    color: #111f68;
    font-weight: 600;
}

.result-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 10px;
}

.empty-box {
    text-align: center;
    color: #8e9aaf;
    font-size: 13px;
}

.custom-primary-btn {
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%) !important;
    border-color: #111f68 !important;
    color: #fff !important;
    box-shadow: 0 2px 8px rgba(17, 31, 104, 0.2);
}

.custom-primary-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #0d1554 0%, #070e3a 100%) !important;
    border-color: #0d1554 !important;
    box-shadow: 0 4px 16px rgba(17, 31, 104, 0.3);
    transform: translateY(-2px);
}

.custom-default-btn {
    background-color: #ffffff !important;
    border: 1.5px solid #111f68 !important;
    color: #111f68 !important;
    box-shadow: 0 2px 8px rgba(17, 31, 104, 0.1);
}

.custom-default-btn:hover {
    background: linear-gradient(135deg, #f0f3f9 0%, #ffffff 100%) !important;
    box-shadow: 0 4px 16px rgba(17, 31, 104, 0.15);
    border-color: #111f68 !important;
    transform: translateY(-2px);
}

@media (max-width: 1280px) {
    .content-wrapper {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 768px) {
    .top-bar {
        flex-direction: column;
        align-items: flex-start;
    }

    .top-actions {
        flex-wrap: wrap;
    }
}
</style>