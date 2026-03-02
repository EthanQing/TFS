<template>
    <div class="frame-select-container">
        <!-- 顶部标题与操作 -->
        <div class="top-bar">
            <div>
                <h3>框架选择与配置</h3>
                <p class="subtitle">选择合适的推理/训练框架，查看特点并动态配置运行选项</p>
            </div>
            <div class="top-actions">
                <el-button class="custom-default-btn" @click="resetConfig">
                    <i class="el-icon-refresh"></i> 重置配置
                </el-button>
                <el-button type="primary" class="custom-primary-btn" @click="applyConfig">
                    <i class="el-icon-check"></i> 应用配置
                </el-button>
            </div>
        </div>

        <div class="content-wrapper">
            <!-- 左侧：框架列表 -->
            <div class="left-panel section-card">
                <div class="panel-header">
                    <h4><i class="el-icon-box"></i> 可用框架</h4>
                    <span class="badge">{{ frameworks.length }}</span>
                </div>
                <div class="frame-grid">
                    <div
                        v-for="frame in frameworks"
                        :key="frame.id"
                        class="frame-card"
                        :class="{ active: frame.id === selectedFrameworkId }"
                        @click="selectFrame(frame.id)"
                    >
                        <div class="frame-card-top">
                            <div class="frame-title">
                                <i :class="frame.icon"></i>
                                <div>
                                    <div class="name">{{ frame.name }}</div>
                                    <div class="meta">v{{ frame.version }} · {{ frame.license }}</div>
                                </div>
                            </div>
                            <el-tag size="mini" type="success">{{ frame.stage }}</el-tag>
                        </div>
                        <p class="desc">{{ frame.desc }}</p>
                        <div class="chips">
                            <span v-for="tag in frame.tags" :key="tag" class="chip">{{ tag }}</span>
                        </div>
                        <div class="stats-row">
                            <div class="stat">
                                <div class="label">设备</div>
                                <div class="value">{{ frame.devices.join(' / ') }}</div>
                            </div>
                            <div class="stat">
                                <div class="label">性能评级</div>
                                <div class="value">{{ frame.score }} / 10</div>
                            </div>
                            <div class="stat">
                                <div class="label">生态</div>
                                <div class="value">{{ frame.ecosystem }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：详情与动态配置 -->
            <div class="right-panel">
                <div class="section-card">
                    <div class="panel-header">
                        <h4><i class="el-icon-info"></i> 框架特点说明</h4>
                        <span class="badge">亮点</span>
                    </div>
                    <div v-if="selectedFrame" class="feature-list">
                        <div v-for="(item, idx) in selectedFrame.features" :key="idx" class="feature-item">
                            <div class="feature-icon">{{ idx + 1 }}</div>
                            <div>
                                <div class="feature-title">{{ item.title }}</div>
                                <div class="feature-desc">{{ item.desc }}</div>
                            </div>
                        </div>
                        <div class="compat-row">
                            <div class="compat-item">
                                <span class="label">最佳场景</span>
                                <span class="value">{{ selectedFrame.bestFor }}</span>
                            </div>
                            <div class="compat-item">
                                <span class="label">推荐硬件</span>
                                <span class="value">{{ selectedFrame.recommend }}</span>
                            </div>
                            <div class="compat-item">
                                <span class="label">导出/部署</span>
                                <span class="value">{{ selectedFrame.export }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="panel-header">
                        <h4><i class="el-icon-setting"></i> 动态配置选项</h4>
                        <span class="badge">实时</span>
                    </div>
                    <div class="form-grid">
                        <div class="form-item">
                            <div class="label">运行设备</div>
                            <el-select v-model="form.device" placeholder="选择设备">
                                <el-option label="自动" value="auto"></el-option>
                                <el-option label="GPU" value="gpu"></el-option>
                                <el-option label="CPU" value="cpu"></el-option>
                                <el-option label="NPU/加速卡" value="accelerator"></el-option>
                            </el-select>
                        </div>

                        <div class="form-item">
                            <div class="label">精度模式</div>
                            <el-select v-model="form.precision" :placeholder="'选择精度'">
                                <el-option
                                    v-for="p in availablePrecisions"
                                    :key="p"
                                    :label="p"
                                    :value="p"
                                />
                            </el-select>
                        </div>

                        <div class="form-item">
                            <div class="label">Batch Size</div>
                            <el-slider
                                v-model="form.batchSize"
                                :min="1"
                                :max="64"
                                :step="1"
                                show-input
                            />
                        </div>

                        <div class="form-item">
                            <div class="label">线程/并发</div>
                            <el-slider
                                v-model="form.numThreads"
                                :min="1"
                                :max="32"
                                :step="1"
                                show-input
                            />
                        </div>

                        <div class="form-item switch-item">
                            <div class="label">启用量化</div>
                            <el-switch v-model="form.enableQuant" :active-color="'#10b981'" />
                        </div>

                        <div class="form-item switch-item">
                            <div class="label">半精度/混合精度</div>
                            <el-switch v-model="form.enableHalf" :active-color="'#10b981'" />
                        </div>

                        <div class="form-item switch-item">
                            <div class="label">动态 Shape</div>
                            <el-switch v-model="form.dynamicShape" :active-color="'#10b981'" />
                        </div>

                        <div class="form-item switch-item">
                            <div class="label">TensorRT / Graph 优化</div>
                            <el-switch v-model="form.useOptim" :active-color="'#10b981'" />
                        </div>

                        <div class="form-item switch-item">
                            <div class="label">性能分析 (Profiler)</div>
                            <el-switch v-model="form.enableProfile" :active-color="'#10b981'" />
                        </div>
                    </div>

                    <div class="summary-panel">
                        <div class="summary-row">
                            <span>当前框架</span>
                            <strong>{{ selectedFrame ? selectedFrame.name : '-' }}</strong>
                        </div>
                        <div class="summary-row">
                            <span>设备 / 精度</span>
                            <strong>{{ form.device.toUpperCase() }} · {{ form.precision }}</strong>
                        </div>
                        <div class="summary-row">
                            <span>Batch / 线程</span>
                            <strong>BS={{ form.batchSize }} · {{ form.numThreads }} Threads</strong>
                        </div>
                        <div class="summary-flags">
                            <span v-if="form.enableQuant" class="flag success">量化启用</span>
                            <span v-if="form.enableHalf" class="flag info">FP16/BF16</span>
                            <span v-if="form.dynamicShape" class="flag warning">动态 Shape</span>
                            <span v-if="form.useOptim" class="flag primary">加速优化</span>
                            <span v-if="form.enableProfile" class="flag neutral">性能分析</span>
                            <span v-if="!anyFlag" class="flag muted">默认配置</span>
                        </div>
                    </div>
                </div>

                <div class="section-card">
                    <div class="panel-header">
                        <h4><i class="el-icon-guide"></i> 推荐配置</h4>
                        <span class="badge">智能提示</span>
                    </div>
                    <div class="recommend-list">
                        <div
                            v-for="(tip, idx) in recommendations"
                            :key="idx"
                            class="recommend-card"
                        >
                            <div class="recommend-title">
                                <span class="dot"></span>
                                {{ tip.title }}
                            </div>
                            <div class="recommend-body">{{ tip.body }}</div>
                            <div class="recommend-tags">
                                <span class="chip" v-for="tag in tip.tags" :key="tag">{{ tag }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ModelFrameSelect',
    data() {
        return {
            frameworks: [
                {
                    id: 'pytorch',
                    name: 'PyTorch',
                    version: '2.1',
                    license: 'BSD',
                    stage: 'Stable',
                    icon: 'el-icon-cpu',
                    score: 9.2,
                    ecosystem: 'TorchHub / ONNX / TRT',
                    devices: ['GPU', 'CPU'],
                    desc: '动态图友好，生态成熟，训练与部署链路完善',
                    tags: ['动态图', '强大生态', 'TRT 加速'],
                    bestFor: '实验迭代、Transformer 任务',
                    recommend: 'NVIDIA GPU / CUDA 11+',
                    export: 'ONNX / TorchScript / TRT',
                    features: [
                        { title: '动态图与调试友好', desc: '开发体验好，适合快速实验与迭代' },
                        { title: '部署链路完善', desc: 'ONNX / TensorRT / TorchScript 多路径覆盖' },
                        { title: '社区资源丰富', desc: '模型、教程、插件生态齐全' }
                    ]
                },
                {
                    id: 'tensorflow',
                    name: 'TensorFlow',
                    version: '2.15',
                    license: 'Apache 2.0',
                    stage: 'Stable',
                    icon: 'el-icon-coin',
                    score: 8.6,
                    ecosystem: 'TF Serving / TFLite',
                    devices: ['GPU', 'CPU', 'Edge'],
                    desc: '端云一体，Serving/JS/Lite 部署成熟',
                    tags: ['生产级', 'TFLite', 'Serving'],
                    bestFor: '云端推理、移动端轻量部署',
                    recommend: 'GPU + XLA / Edge TPU',
                    export: 'SavedModel / TFLite / TFJS',
                    features: [
                        { title: '成熟的生产方案', desc: 'TF Serving、TFLite、TF.js 覆盖端云' },
                        { title: 'XLA 优化', desc: '图优化能力强，适合大规模部署' },
                        { title: '丰富工具链', desc: 'Profiler、TensorBoard 等调试监控完善' }
                    ]
                },
                {
                    id: 'onnx',
                    name: 'ONNX Runtime',
                    version: '1.17',
                    license: 'MIT',
                    stage: 'Stable',
                    icon: 'el-icon-share',
                    score: 8.8,
                    ecosystem: 'ORT / Web / Mobile',
                    devices: ['GPU', 'CPU', 'NPU'],
                    desc: '统一中间表示，多后端加速，跨平台友好',
                    tags: ['跨框架', '多后端', '量化支持'],
                    bestFor: '多框架模型落地、跨硬件部署',
                    recommend: 'CUDA / DirectML / OpenVINO EP',
                    export: 'ONNX (各主流框架导出)',
                    features: [
                        { title: '跨框架统一', desc: '支持 PyTorch / TF / Paddle 等导出' },
                        { title: '后端可插拔', desc: 'CUDA / TensorRT / OpenVINO / DML / ARM' },
                        { title: '量化与优化', desc: 'QAT/PTQ 支持，Graph 优化丰富' }
                    ]
                },
                {
                    id: 'openvino',
                    name: 'OpenVINO',
                    version: '2024',
                    license: 'Apache 2.0',
                    stage: 'Stable',
                    icon: 'el-icon-s-platform',
                    score: 8.4,
                    ecosystem: 'CPU / VPU / GPU',
                    devices: ['CPU', 'GPU', 'VPU'],
                    desc: '英特尔全栈优化，CPU/边缘端高性价比推理',
                    tags: ['INT8', '边缘设备', 'CPU 优化'],
                    bestFor: 'x86 CPU 边缘推理、INT8 场景',
                    recommend: 'Intel CPU + VNNI / iGPU / VPU',
                    export: 'ONNX / IR / FP32-FP16-INT8',
                    features: [
                        { title: 'CPU 友好', desc: '无 GPU 也可获得高吞吐，部署简单' },
                        { title: 'INT8 优化', desc: '成熟的 INT8 PTQ/QAT 流程' },
                        { title: '多设备编排', desc: 'CPU + iGPU + VPU 组合调度' }
                    ]
                },
                {
                    id: 'paddlepaddle',
                    name: 'PaddlePaddle',
                    version: '2.6',
                    license: 'Apache 2.0',
                    stage: 'Stable',
                    icon: 'el-icon-ship',
                    score: 8.7,
                    ecosystem: 'PaddleDetection / PaddleSlim / Paddle Inference',
                    devices: ['GPU', 'CPU', 'XPU', 'NPU'],
                    desc: '百度自研深度学习框架，检测套件成熟，国产硬件适配优秀',
                    tags: ['PP-YOLOE', 'PicoDet', '国产硬件'],
                    bestFor: '目标检测、遥感、工业质检场景',
                    recommend: 'NVIDIA GPU / 昆仑芯 XPU / 昇腾 NPU',
                    export: 'Paddle Inference / ONNX / TensorRT',
                    features: [
                        { title: '检测套件完善', desc: 'PP-YOLOE+、PicoDet、RT-DETR 等 SOTA 模型开箱即用' },
                        { title: '国产硬件支持', desc: '原生适配昆仑芯 XPU、昇腾 NPU、海光 DCU 等' },
                        { title: '端到端部署', desc: 'Paddle Inference + PaddleSlim 量化压缩一站式' }
                    ]
                }
            ],
            selectedFrameworkId: 'pytorch',
            form: {
                device: 'auto',
                precision: 'FP32',
                batchSize: 8,
                numThreads: 8,
                enableQuant: false,
                enableHalf: true,
                dynamicShape: true,
                useOptim: true,
                enableProfile: false
            }
        };
    },
    computed: {
        selectedFrame() {
            return this.frameworks.find(f => f.id === this.selectedFrameworkId) || null;
        },
        availablePrecisions() {
            if (!this.selectedFrame) return ['FP32'];
            const map = {
                pytorch: ['FP32', 'FP16', 'INT8'],
                tensorflow: ['FP32', 'BF16', 'FP16', 'INT8'],
                onnx: ['FP32', 'FP16', 'INT8'],
                openvino: ['FP32', 'FP16', 'INT8'],
                paddlepaddle: ['FP32', 'FP16', 'INT8']
            };
            const list = map[this.selectedFrame.id] || ['FP32'];
            if (!list.includes(this.form.precision)) {
                this.form.precision = list[0];
            }
            return list;
        },
        recommendations() {
            const tips = {
                pytorch: [
                    { title: '训练/实验优先', body: '使用 FP32/FP16 混合精度，开启动态 Shape 便于多尺寸输入。', tags: ['实验', '混合精度'] },
                    { title: '部署到 TensorRT', body: '导出 ONNX，启用 TensorRT / useOptim 以获得 GPU 端最佳吞吐。', tags: ['TRT', 'ONNX'] }
                ],
                tensorflow: [
                    { title: '云端服务', body: '使用 SavedModel + TF Serving，建议启用 XLA 与自动批处理。', tags: ['Serving', 'XLA'] },
                    { title: '移动端', body: '导出 TFLite，结合量化 (INT8) 在 Edge 设备上获得最佳延迟。', tags: ['TFLite', 'INT8'] }
                ],
                onnx: [
                    { title: '跨平台统一', body: '保持 ONNX IR，按需切换 Execution Provider (CUDA / OpenVINO / DML)。', tags: ['EP', '跨平台'] },
                    { title: '量化加速', body: '启用 INT8/PTQ，适合 CPU/NPU 设备，吞吐大幅提升。', tags: ['INT8', 'PTQ'] }
                ],
                openvino: [
                    { title: 'CPU 高性价比', body: '开启 INT8 + 多线程，充分利用 x86 VNNI 指令集。', tags: ['CPU', 'INT8'] },
                    { title: '边缘编排', body: 'CPU+iGPU+VPU 协同，平衡延迟与功耗，适合边缘场景。', tags: ['边缘', '多设备'] }
                ],
                paddlepaddle: [
                    { title: '检测训练', body: '使用 PP-YOLOE+ 或 PicoDet，配合 COCO 数据格式获得最佳精度。', tags: ['PP-YOLOE', '检测'] },
                    { title: '部署推理', body: '导出 Paddle Inference 模型，结合 PaddleSlim 量化实现高效部署。', tags: ['Inference', 'PaddleSlim'] }
                ]
            };
            return tips[this.selectedFrameworkId] || [];
        },
        anyFlag() {
            return (
                this.form.enableQuant ||
                this.form.enableHalf ||
                this.form.dynamicShape ||
                this.form.useOptim ||
                this.form.enableProfile
            );
        }
    },
    methods: {
        selectFrame(id) {
            this.selectedFrameworkId = id;
        },
        resetConfig() {
            this.selectedFrameworkId = 'pytorch';
            this.form = {
                device: 'auto',
                precision: 'FP32',
                batchSize: 8,
                numThreads: 8,
                enableQuant: false,
                enableHalf: true,
                dynamicShape: true,
                useOptim: true,
                enableProfile: false
            };
        },
        applyConfig() {
            this.$message.success('配置已应用');
        }
    }
};
</script>

<style scoped>
.frame-select-container {
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
    grid-template-columns: 38% 62%;
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
    gap: 12px;
    min-height: 0;
}

.right-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    color: #111f68;
}

.panel-header h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
}

.badge {
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    color: #fff;
    border-radius: 12px;
    padding: 4px 10px;
    font-size: 12px;
}

.frame-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
}

.frame-card {
    border: 1.5px solid #e8ecef;
    border-radius: 10px;
    padding: 12px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.frame-card:hover {
    border-color: #111f68;
    box-shadow: 0 6px 18px rgba(17, 31, 104, 0.12);
    transform: translateY(-2px);
}

.frame-card.active {
    border-color: #111f68;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    color: #fff;
    box-shadow: 0 10px 24px rgba(17, 31, 104, 0.2);
}

.frame-card.active .desc,
.frame-card.active .meta,
.frame-card.active .label,
.frame-card.active .value {
    color: #f0f4ff;
}

.frame-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.frame-title {
    display: flex;
    gap: 8px;
    align-items: center;
}

.frame-title i {
    font-size: 20px;
    color: #111f68;
}

.frame-card.active .frame-title i {
    color: #fff;
}

.frame-title .name {
    font-size: 15px;
    font-weight: 700;
    color: #111f68;
}

.frame-card.active .frame-title .name {
    color: #fff;
}

.frame-title .meta {
    font-size: 12px;
    color: #6c757d;
}

.frame-card .desc {
    font-size: 13px;
    color: #6c757d;
    margin: 0;
}

.chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.chip {
    padding: 4px 8px;
    background: #eef1f6;
    border-radius: 8px;
    font-size: 12px;
    color: #111f68;
}

.frame-card.active .chip {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
}

.stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}

.stat {
    background: #fff;
    border-radius: 8px;
    padding: 8px;
    border: 1px solid #e8ecef;
}

.frame-card.active .stat {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
}

.stat .label {
    font-size: 11px;
    color: #8e9aaf;
}

.stat .value {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.feature-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.feature-item {
    display: flex;
    gap: 10px;
    padding: 10px;
    border: 1px solid #e8ecef;
    border-radius: 10px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
}

.feature-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
}

.feature-title {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.feature-desc {
    font-size: 12px;
    color: #6c757d;
}

.compat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

.compat-item {
    padding: 10px;
    border: 1px solid #e8ecef;
    border-radius: 10px;
    background: #f9fafb;
}

.compat-item .label {
    display: block;
    font-size: 12px;
    color: #8e9aaf;
}

.compat-item .value {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 6px;
}

.form-item {
    padding: 12px;
    border: 1.5px solid #e8ecef;
    border-radius: 10px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.form-item .label {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
}

.switch-item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}

.summary-panel {
    margin-top: 12px;
    border: 1.5px solid #e8ecef;
    border-radius: 10px;
    padding: 12px;
    background: linear-gradient(135deg, #f0f3f9 0%, #ffffff 100%);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: #6c757d;
}

.summary-row strong {
    color: #111f68;
}

.summary-flags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.flag {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    border: 1px solid transparent;
}

.flag.success { background: rgba(16, 185, 129, 0.12); color: #0f9f75; border-color: #0f9f75; }
.flag.info { background: rgba(6, 182, 212, 0.12); color: #0891b2; border-color: #0891b2; }
.flag.warning { background: rgba(245, 158, 11, 0.12); color: #d97706; border-color: #d97706; }
.flag.primary { background: rgba(17, 31, 104, 0.12); color: #111f68; border-color: #111f68; }
.flag.neutral { background: rgba(99, 102, 241, 0.12); color: #4f46e5; border-color: #4f46e5; }
.flag.muted { background: #f3f4f6; color: #6b7280; border-color: #e5e7eb; }

.recommend-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 10px;
}

.recommend-card {
    border: 1.5px solid #e8ecef;
    border-radius: 10px;
    padding: 12px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
}

.recommend-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    color: #111f68;
    margin-bottom: 4px;
}

.recommend-title .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
}

.recommend-body {
    font-size: 12px;
    color: #6c757d;
    margin-bottom: 6px;
}

.recommend-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
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

    .frame-grid {
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }
}

@media (max-width: 768px) {
    .top-bar {
        flex-direction: column;
        align-items: flex-start;
    }

    .top-actions {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
    }
}
</style>