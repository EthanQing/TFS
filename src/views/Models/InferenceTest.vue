<template>
    <div class="inference-test-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>模型推理测试</h3>
            <div class="top-actions">
                <el-button
                    class="custom-default-btn"
                    @click="handleClearResults"
                    :disabled="inferenceResults.length === 0"
                >
                    <i class="el-icon-delete"></i> 清空结果
                </el-button>
                <el-button
                    class="custom-default-btn"
                    @click="handleExportReport"
                    :disabled="inferenceResults.length === 0"
                >
                    <i class="el-icon-download"></i> 导出报告
                </el-button>
            </div>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：推理配置 -->
            <div class="config-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-setting"></i>
                    推理配置
                </h4>

                <div class="config-content">
                    <!-- 推理类型选择 -->
                    <div class="config-group">
                        <label class="group-label">推理类型</label>
                        <div class="radio-group-custom">
                            <div 
                                class="radio-option-custom"
                                :class="{ 'active': inferenceConfig.type === 'image' }"
                                @click="selectInferenceType('image')"
                            >
                                <div class="radio-circle">
                                    <div class="radio-inner"></div>
                                </div>
                                <i class="el-icon-picture"></i>
                                <span>图片推理</span>
                            </div>
                            <div 
                                class="radio-option-custom"
                                :class="{ 'active': inferenceConfig.type === 'folder' }"
                                @click="selectInferenceType('folder')"
                            >
                                <div class="radio-circle">
                                    <div class="radio-inner"></div>
                                </div>
                                <i class="el-icon-folder"></i>
                                <span>文件夹推理</span>
                            </div>
                            <div 
                                class="radio-option-custom"
                                :class="{ 'active': inferenceConfig.type === 'video' }"
                                @click="selectInferenceType('video')"
                            >
                                <div class="radio-circle">
                                    <div class="radio-inner"></div>
                                </div>
                                <i class="el-icon-video-play"></i>
                                <span>视频推理</span>
                            </div>
                        </div>
                    </div>

                    <!-- 文件上传 -->
                    <div class="config-group">
                        <label class="group-label">上传文件</label>
                        <el-upload
                            class="upload-area"
                            drag
                            action="#"
                            :auto-upload="false"
                            :on-change="handleFileSelect"
                            :multiple="inferenceConfig.type !== 'video'"
                            :accept="getAcceptTypes()"
                        >
                            <i :class="getUploadIcon()"></i>
                            <div class="upload-text">{{ getUploadText() }}</div>
                            <div class="upload-tip">{{ getUploadTip() }}</div>
                        </el-upload>

                        <div v-if="selectedFiles.length > 0" class="file-list">
                            <div class="file-list-title">
                                已选择 {{ selectedFiles.length }} 个文件
                            </div>
                            <div
                                v-for="(file, index) in selectedFiles"
                                :key="index"
                                class="file-item"
                            >
                                <span class="file-icon">
                                    <i :class="getFileIcon(file.name)"></i>
                                </span>
                                <span class="file-name">{{ file.name }}</span>
                                <el-button
                                    type="text"
                                    size="small"
                                    @click="removeFile(index)"
                                >
                                    移除
                                </el-button>
                            </div>
                        </div>
                    </div>

                    <!-- 推理参数 -->
                    <div class="config-group">
                        <label class="group-label">推理参数</label>
                        <div class="param-item">
                            <span class="param-name">模型选择</span>
                            <el-select v-model="inferenceConfig.model" placeholder="选择模型">
                                <el-option label="YOLOv8n" value="yolov8n"></el-option>
                                <el-option label="YOLOv8s" value="yolov8s"></el-option>
                                <el-option label="YOLOv8m" value="yolov8m"></el-option>
                                <el-option label="YOLOv8l" value="yolov8l"></el-option>
                            </el-select>
                        </div>
                        <div class="param-item">
                            <span class="param-name">置信度阈值</span>
                            <el-slider
                                v-model="inferenceConfig.confidence"
                                :min="0"
                                :max="1"
                                :step="0.05"
                                :format-tooltip="formatConfidence"
                                class="confidence-slider"
                            ></el-slider>
                        </div>
                        <div class="param-item">
                            <span class="param-name">IOU阈值</span>
                            <el-slider
                                v-model="inferenceConfig.iou"
                                :min="0"
                                :max="1"
                                :step="0.05"
                                :format-tooltip="formatIOU"
                                class="confidence-slider"
                            ></el-slider>
                        </div>
                        <div class="param-item">
                            <span class="param-name">显示标签</span>
                            <el-switch
                                v-model="inferenceConfig.showLabels"
                                :active-color="'#10b981'"
                                :inactive-color="'#ccc'"
                            ></el-switch>
                        </div>
                        <div class="param-item">
                            <span class="param-name">显示置信度</span>
                            <el-switch
                                v-model="inferenceConfig.showConfidence"
                                :active-color="'#10b981'"
                                :inactive-color="'#ccc'"
                            ></el-switch>
                        </div>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="action-buttons">
                        <el-button
                            type="primary"
                            class="custom-primary-btn"
                            @click="handleStartInference"
                            :loading="isInferencing"
                            :disabled="selectedFiles.length === 0"
                        >
                            <i class="el-icon-video-play"></i>
                            {{ isInferencing ? '推理中...' : '开始推理' }}
                        </el-button>
                        <el-button
                            @click="handleReset"
                            :disabled="isInferencing"
                        >
                            重置配置
                        </el-button>
                    </div>
                </div>
            </div>

            <!-- 右侧：推理结果 -->
            <div class="right-section">
                <!-- 结果统计 -->
                <div class="stats-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-data-analysis"></i>
                        结果统计
                    </h4>

                    <div v-if="inferenceResults.length > 0" class="stats-content">
                        <div class="stat-cards-grid">
                            <div class="stat-card">
                                <div class="stat-icon">
                                    <i class="el-icon-document"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-label">总处理</div>
                                    <div class="stat-value">{{ inferenceResults.length }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="el-icon-success"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-label">成功</div>
                                    <div class="stat-value">{{ successCount }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon warning">
                                    <i class="el-icon-warning"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-label">检测对象</div>
                                    <div class="stat-value">{{ totalDetections }}</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon info">
                                    <i class="el-icon-time"></i>
                                </div>
                                <div class="stat-info">
                                    <div class="stat-label">平均耗时</div>
                                    <div class="stat-value">{{ averageTime }}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="empty-stats">
                        <i class="el-icon-document-copy"></i>
                        <p>暂无结果统计</p>
                    </div>
                </div>

                <!-- 结果列表 -->
                <div class="results-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-picture"></i>
                        推理结果
                        <span v-if="inferenceResults.length > 0" class="result-count">
                            ({{ inferenceResults.length }})
                        </span>
                    </h4>

                    <div class="result-filters">
                        <el-input
                            v-model="resultFilter"
                            placeholder="搜索结果..."
                            clearable
                            size="small"
                        >
                            <i slot="prefix" class="el-icon-search"></i>
                        </el-input>
                    </div>

                    <div v-if="filteredResults.length > 0" class="results-list">
                        <div
                            v-for="(result, index) in filteredResults"
                            :key="index"
                            class="result-item"
                            @click="selectResult(index)"
                            :class="{ 'active': selectedResultIndex === index }"
                        >
                            <div class="result-thumbnail">
                                <img v-if="result.type === 'image'" :src="absoluteUrl(result.preview)" :alt="result.name">
                                <div v-else class="video-thumbnail">
                                    <i class="el-icon-video-play"></i>
                                </div>
                            </div>
                            <div class="result-info">
                                <div class="result-name">{{ result.name }}</div>
                                <div class="result-meta">
                                    <span class="meta-item">对象: {{ result.detections }}</span>
                                    <span class="meta-item">耗时: {{ result.time }}</span>
                                </div>
                                <el-tag
                                    :type="result.status === '成功' ? 'success' : 'danger'"
                                    size="mini"
                                >
                                    {{ result.status }}
                                </el-tag>
                            </div>
                        </div>
                    </div>

                    <div v-else class="empty-results">
                        <i class="el-icon-picture"></i>
                        <p>{{ inferenceResults.length === 0 ? '暂无推理结果' : '没有符合条件的结果' }}</p>
                    </div>
                </div>

                <!-- 详细信息 -->
                <div v-if="currentResult" class="detail-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-info"></i>
                        详细信息
                    </h4>

                    <div class="detail-content">
                        <div class="result-preview">
                            <AnnotatedImagePreview
                                v-if="currentResult.type === 'image' && currentResult.preview"
                                class="result-annotator"
                                :image-url="absoluteUrl(currentResult.preview)"
                                :predictions="currentResult.predictions || []"
                                :show-labels="inferenceConfig.showLabels"
                                :show-confidence="inferenceConfig.showConfidence"
                                :alt="currentResult.name"
                            />
                            <div v-else class="video-preview">
                                <i class="el-icon-video-play"></i>
                                <span>{{ currentResult.name }}</span>
                            </div>
                        </div>

                        <div class="detection-details">
                            <div class="detail-row">
                                <span class="label">文件名:</span>
                                <span class="value">{{ currentResult.name }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">文件类型:</span>
                                <span class="value">{{ currentResult.type === 'image' ? '图片' : '视频' }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">推理耗时:</span>
                                <span class="value">{{ currentResult.time }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">检测对象数:</span>
                                <span class="value">{{ currentResult.detections }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">模型:</span>
                                <span class="value">{{ inferenceConfig.model }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">置信度:</span>
                                <span class="value">{{ (inferenceConfig.confidence * 100).toFixed(0) }}%</span>
                            </div>

                            <div v-if="currentResult.detections > 0" class="detection-classes">
                                <div class="class-title">检测类别统计</div>
                                <div
                                    v-for="(count, className) in currentResult.classes"
                                    :key="className"
                                    class="class-item"
                                >
                                    <span class="class-name">{{ className }}</span>
                                    <span class="class-count">{{ count }} 个</span>
                                </div>
                            </div>
                        </div>

                        <div class="detail-actions">
                            <el-button
                                type="primary"
                                size="small"
                                class="custom-primary-btn"
                                @click="handleDownloadResult"
                            >
                                <i class="el-icon-download"></i>
                                下载结果
                            </el-button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { API_BASE } from "@/utils/request";
import AnnotatedImagePreview from "@/components/Inference/AnnotatedImagePreview.vue";
import { uploadInferenceFile, runSingleInference, runBatchInference, runVideoInference } from "@/api/inference";
import { fetchModelVersionsByRunId, registerModelVersionFromRun } from "@/api/models";

export default {
    name: 'ModelInferenceTest',
    components: {
        AnnotatedImagePreview,
    },
    data() {
        return {
            selectedFiles: [],
            isInferencing: false,
            resultFilter: '',
            selectedResultIndex: null,
            inferenceConfig: {
                type: 'image',
                model: '',
                confidence: 0.5,
                iou: 0.5,
                showLabels: true,
                showConfidence: true
            },
            inferenceResults: [],
            jobId: null,
            modelVersionId: null,
            inferenceProgress: 0
        };
    },
    computed: {
        successCount() {
            return this.inferenceResults.filter(r => r.status === '\u6210\u529f').length;
        },
        totalDetections() {
            return this.inferenceResults.reduce((sum, r) => sum + r.detections, 0);
        },
        averageTime() {
            if (this.inferenceResults.length === 0) return '0ms';
            const total = this.inferenceResults.reduce((sum, r) => {
                const ms = parseInt(r.time);
                return sum + (isNaN(ms) ? 0 : ms);
            }, 0);
            return Math.round(total / this.inferenceResults.length) + 'ms';
        },
        filteredResults() {
            if (!this.resultFilter) {
                return this.inferenceResults;
            }
            return this.inferenceResults.filter(r =>
                r.name.toLowerCase().includes(this.resultFilter.toLowerCase())
            );
        },
        currentResult() {
            if (this.selectedResultIndex !== null && this.filteredResults[this.selectedResultIndex]) {
                return this.filteredResults[this.selectedResultIndex];
            }
            return null;
        }
    },
    mounted() {
        this.resolveJobId();
    },
    activated() {
        this.resolveJobId();
    },
    methods: {
        absoluteUrl(url) {
            const raw = String(url || '').trim();
            if (!raw) return '';
            if (
                raw.startsWith('http://')
                || raw.startsWith('https://')
                || raw.startsWith('blob:')
                || raw.startsWith('data:')
            ) return raw;
            if (raw.startsWith('/')) return `${API_BASE}${raw}`;
            return `${API_BASE}/${raw}`;
        },
        resolveJobId() {
            const routeJobId = this.$route && this.$route.query && this.$route.query.jobId;
            if (routeJobId) {
                if (this.jobId !== routeJobId) this.modelVersionId = null;
                this.jobId = routeJobId;
            } else {
                const stored = localStorage.getItem("currentJobId");
                if (stored) {
                    if (this.jobId !== stored) this.modelVersionId = null;
                    this.jobId = stored;
                }
            }
        },
        async resolveModelVersionId() {
            if (this.modelVersionId) return this.modelVersionId;
            const id = String(this.jobId || "").trim();
            if (!id) return null;
            try {
                const list = await fetchModelVersionsByRunId(id, 1, 5);
                if (list && list.length) {
                    const mv = list[0];
                    const mvId = mv?.model_version_id || mv?.id;
                    if (mvId != null) { this.modelVersionId = mvId; return mvId; }
                }
            } catch (e) {
                console.warn("fetchModelVersionsByRunId failed:", e?.message || e);
            }
            // Auto-register
            try {
                const created = await registerModelVersionFromRun({
                    run_id: id,
                    version: `run-${id.slice(0, 8)}`,
                    stage: "development",
                    description: "Auto-created for inference test",
                });
                const mvId = created?.model_version_id || created?.id;
                if (mvId != null) { this.modelVersionId = mvId; return mvId; }
            } catch (e) {
                console.warn("registerModelVersionFromRun failed:", e?.message || e);
            }
            return null;
        },
        // --- Utility methods ---
        getAcceptTypes() {
            const types = { image: '.jpg,.jpeg,.png,.bmp', folder: '*', video: '.mp4,.avi,.mov,.mkv' };
            return types[this.inferenceConfig.type] || '.*';
        },
        getUploadIcon() {
            const icons = { image: 'el-icon-picture', folder: 'el-icon-folder-add', video: 'el-icon-video-play' };
            return icons[this.inferenceConfig.type] || 'el-icon-upload';
        },
        getUploadText() {
            const texts = { image: '\u70b9\u51fb\u4e0a\u4f20\u6216\u62d6\u62fd\u56fe\u7247\u5230\u6b64\u5904', folder: '\u70b9\u51fb\u9009\u62e9\u6216\u62d6\u62fd\u6587\u4ef6\u5939\u5230\u6b64\u5904', video: '\u70b9\u51fb\u4e0a\u4f20\u6216\u62d6\u62fd\u89c6\u9891\u5230\u6b64\u5904' };
            return texts[this.inferenceConfig.type] || '\u70b9\u51fb\u4e0a\u4f20\u6587\u4ef6';
        },
        getUploadTip() {
            const tips = { image: '\u652f\u6301 JPG, PNG, BMP \u7b49\u683c\u5f0f\uff0c\u6bcf\u4e2a\u6587\u4ef6\u6700\u5927 50MB', folder: '\u652f\u6301\u6574\u4e2a\u6587\u4ef6\u5939\u7684\u63a8\u7406', video: '\u652f\u6301 MP4, AVI, MOV \u7b49\u683c\u5f0f\uff0c\u6bcf\u4e2a\u6587\u4ef6\u6700\u5927 500MB' };
            return tips[this.inferenceConfig.type] || '\u652f\u6301\u591a\u79cd\u683c\u5f0f';
        },
        getFileIcon(filename) {
            if (filename.match(/\.(jpg|jpeg|png|bmp)$/i)) return 'el-icon-picture';
            if (filename.match(/\.(mp4|avi|mov|mkv)$/i)) return 'el-icon-video-play';
            return 'el-icon-document';
        },
        handleTypeChange() { this.selectedFiles = []; },
        selectInferenceType(type) { this.inferenceConfig.type = type; this.handleTypeChange(); },
        handleFileSelect(file, fileList) {
            this.selectedFiles = fileList.map(f => ({ name: f.name, raw: f.raw }));
        },
        removeFile(index) { this.selectedFiles.splice(index, 1); },
        formatConfidence(value) { return (value * 100).toFixed(0) + '%'; },
        formatIOU(value) { return (value * 100).toFixed(0) + '%'; },

        // --- Core inference methods ---
        async handleStartInference() {
            if (this.selectedFiles.length === 0) {
                this.$message.warning('\u8bf7\u5148\u9009\u62e9\u8981\u63a8\u7406\u7684\u6587\u4ef6');
                return;
            }
            try {
                await this.$confirm('\u786e\u8ba4\u5f00\u59cb\u63a8\u7406\u5417\uff1f', '\u786e\u8ba4\u64cd\u4f5c', {
                    confirmButtonText: '\u786e\u5b9a', cancelButtonText: '\u53d6\u6d88', type: 'warning'
                });
            } catch (_) {
                return;
            }

            this.isInferencing = true;
            this.inferenceResults = [];
            this.selectedResultIndex = null;
            this.inferenceProgress = 0;

            try {
                const mvId = await this.resolveModelVersionId();
                if (!mvId) {
                    this.$message.error('\u672a\u627e\u5230\u6a21\u578b\u7248\u672c\uff0c\u8bf7\u786e\u4fdd\u8bad\u7ec3\u4efb\u52a1\u5df2\u5b8c\u6210');
                    this.isInferencing = false;
                    return;
                }

                const type = this.inferenceConfig.type;
                if (type === 'video') {
                    await this.runVideoInferenceFlow(mvId);
                } else {
                    await this.runImageBatchFlow(mvId);
                }

                if (this.inferenceResults.length > 0) this.selectedResultIndex = 0;
                this.$message.success('\u63a8\u7406\u5b8c\u6210');
            } catch (e) {
                this.$message.error('\u63a8\u7406\u5931\u8d25: ' + (e.message || e));
            } finally {
                this.isInferencing = false;
            }
        },

        async runImageBatchFlow(mvId) {
            // Upload all files first
            this.$message.info('\u6b63\u5728\u4e0a\u4f20\u6587\u4ef6...');
            const tokens = [];
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                try {
                    const res = await uploadInferenceFile(file.raw);
                    tokens.push({ name: file.name, token: res.token, path: res.path });
                } catch (e) {
                    this.inferenceResults.push({
                        name: file.name, type: 'image', detections: 0,
                        time: '-', status: '\u5931\u8d25', preview: '', classes: {},
                        error: '\u4e0a\u4f20\u5931\u8d25: ' + (e.message || e)
                    });
                }
                this.inferenceProgress = Math.round(((i + 1) / this.selectedFiles.length) * 30);
            }

            if (tokens.length === 0) return;

            if (tokens.length === 1) {
                // Single image
                const t = tokens[0];
                const startMs = Date.now();
                try {
                    const res = await runSingleInference({
                        model_version_id: mvId,
                        input_path: t.token,
                        conf: this.inferenceConfig.confidence,
                        iou: this.inferenceConfig.iou,
                    });
                    const elapsed = Date.now() - startMs;
                    this.inferenceResults.push(this.mapApiResult(t.name, 'image', res, elapsed, t.path));
                } catch (e) {
                    this.inferenceResults.push({
                        name: t.name, type: 'image', detections: 0,
                        time: '-', status: '\u5931\u8d25', preview: '', classes: {},
                        error: e.message || String(e)
                    });
                }
            } else {
                // Batch inference
                this.$message.info('\u6b63\u5728\u6279\u91cf\u63a8\u7406...');
                try {
                    const res = await runBatchInference({
                        model_version_id: mvId,
                        input_tokens: tokens.map(t => t.token),
                        conf: this.inferenceConfig.confidence,
                        iou: this.inferenceConfig.iou,
                    });
                    const tokenMap = {};
                    tokens.forEach(t => { tokenMap[t.token] = t; });
                    (res.results || []).forEach(item => {
                        const info = tokenMap[item.token] || { name: item.filename, path: '' };
                        this.inferenceResults.push(this.mapApiResult(
                            info.name, 'image', { output: item.output, error_message: item.error_message },
                            item.inference_time_ms, info.path
                        ));
                    });
                } catch (e) {
                    tokens.forEach(t => {
                        this.inferenceResults.push({
                            name: t.name, type: 'image', detections: 0,
                            time: '-', status: '\u5931\u8d25', preview: '', classes: {},
                            error: e.message || String(e)
                        });
                    });
                }
            }
            this.inferenceProgress = 100;
        },

        async runVideoInferenceFlow(mvId) {
            if (this.selectedFiles.length === 0) return;
            const file = this.selectedFiles[0];

            this.$message.info('\u6b63\u5728\u4e0a\u4f20\u89c6\u9891...');
            let uploaded;
            try {
                uploaded = await uploadInferenceFile(file.raw);
            } catch (e) {
                throw new Error('\u89c6\u9891\u4e0a\u4f20\u5931\u8d25: ' + (e.message || e));
            }
            this.inferenceProgress = 20;

            this.$message.info('\u6b63\u5728\u8fdb\u884c\u89c6\u9891\u63a8\u7406\uff0c\u8bf7\u7a0d\u7b49...');
            const res = await runVideoInference({
                model_version_id: mvId,
                video_token: uploaded.token,
                conf: this.inferenceConfig.confidence,
                iou: this.inferenceConfig.iou,
                frame_interval: 5, // process every 5th frame
            });
            this.inferenceProgress = 90;

            // Map frame results
            (res.results || []).forEach(frameResult => {
                const name = `${file.name} - \u5e27 ${frameResult.frame_index}`;
                this.inferenceResults.push(this.mapApiResult(
                    name, 'video',
                    { output: frameResult.output, error_message: frameResult.error_message },
                    0, ''
                ));
            });

            // Add summary info 
            if (res.total_time_ms) {
                const avg = Math.round(res.total_time_ms / Math.max(1, res.processed_frames));
                this.inferenceResults.forEach(r => {
                    if (r.time === '0ms') r.time = avg + 'ms';
                });
            }
            this.inferenceProgress = 100;
        },

        mapApiResult(name, type, apiRes, elapsedMs, previewPath) {
            const output = apiRes?.output || {};
            const predictions = output?.predictions || [];
            const errorMsg = apiRes?.error_message || null;

            const classes = {};
            let detections = predictions.length;
            predictions.forEach(p => {
                const cls = p.class_name || `class_${p.class_id}`;
                classes[cls] = (classes[cls] || 0) + 1;
            });

            return {
                name,
                type,
                detections,
                time: elapsedMs ? Math.round(elapsedMs) + 'ms' : '0ms',
                status: errorMsg ? '\u5931\u8d25' : '\u6210\u529f',
                preview: previewPath || '',
                classes,
                error: errorMsg || null,
                predictions
            };
        },

        // --- Result actions ---
        selectResult(index) { this.selectedResultIndex = index; },

        handleDownloadResult() {
            if (!this.currentResult) {
                this.$message.warning('\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u7ed3\u679c');
                return;
            }
            const r = this.currentResult;
            const data = {
                filename: r.name,
                type: r.type,
                detections: r.detections,
                inferenceTime: r.time,
                confidence: this.inferenceConfig.confidence,
                iou: this.inferenceConfig.iou,
                classes: r.classes,
                predictions: r.predictions || [],
                timestamp: new Date().toLocaleString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inference_result_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.$message.success('\u7ed3\u679c\u5df2\u4e0b\u8f7d');
        },

        handleExportReport() {
            if (this.inferenceResults.length === 0) {
                this.$message.warning('\u6682\u65e0\u7ed3\u679c\u53ef\u5bfc\u51fa');
                return;
            }

            // Build CSV
            const allClasses = new Set();
            this.inferenceResults.forEach(r => {
                Object.keys(r.classes || {}).forEach(c => allClasses.add(c));
            });
            const classArr = [...allClasses].sort();
            const header = ['\u6587\u4ef6\u540d', '\u72b6\u6001', '\u68c0\u6d4b\u5bf9\u8c61\u6570', '\u63a8\u7406\u8017\u65f6', ...classArr].join(',');
            const rows = [header];
            this.inferenceResults.forEach(r => {
                const cells = [
                    `"${r.name.replace(/"/g, '""')}"`,
                    r.status,
                    r.detections,
                    `"${r.time}"`,
                    ...classArr.map(c => (r.classes || {})[c] || 0)
                ];
                rows.push(cells.join(','));
            });

            // Add summary row
            rows.push('');
            rows.push(`"\u603b\u8ba1",,"${this.totalDetections}","${this.averageTime}"`);
            rows.push(`"\u6210\u529f\u7387","${this.successCount}/${this.inferenceResults.length}"`);

            const csvContent = "\uFEFF" + rows.join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inference_report_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            this.$message.success('\u62a5\u544a\u5df2\u5bfc\u51fa\u4e3a CSV');
        },

        handleClearResults() {
            this.$confirm('\u786e\u8ba4\u6e05\u7a7a\u6240\u6709\u7ed3\u679c\u5417\uff1f', '\u786e\u8ba4\u64cd\u4f5c', {
                confirmButtonText: '\u786e\u5b9a', cancelButtonText: '\u53d6\u6d88', type: 'warning'
            }).then(() => {
                this.inferenceResults = [];
                this.selectedResultIndex = null;
                this.$message.success('\u7ed3\u679c\u5df2\u6e05\u7a7a');
            });
        },

        handleReset() {
            this.selectedFiles = [];
            this.inferenceConfig = {
                type: 'image', model: '', confidence: 0.5, iou: 0.5,
                showLabels: true, showConfidence: true
            };
            this.$message.info('\u914d\u7f6e\u5df2\u91cd\u7f6e');
        }
    }
};
</script>

<style scoped>
.inference-test-container {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    padding: 0;
}

.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}

.top h3 {
    font-size: 18px;
    font-weight: 600;
    color: #111f68;
    margin: 0;
}

.top-actions {
    display: flex;
    gap: 8px;
}

.top-actions .el-button {
    border-radius: 6px;
    font-size: 12px;
    padding: 8px 12px;
}

/* 主内容区域 - 更紧凑 */
.content-wrapper {
    display: flex;
    gap: 16px;
    width: 100%;
    min-height: 0;
}

/* 左侧：配置 - 紧凑化 */
.config-section {
    flex: 0 0 320px;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 180px);
    overflow-y: auto;
}

/* 右侧：结果 - 更大空间 */
.right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    max-height: calc(100vh - 180px);
    overflow-y: auto;
}

/* 通用卡片样式 - 紧凑化 */
.section-card {
    background: #ffffff;
    border-radius: 10px;
    padding: 14px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
    border: 1px solid #e8ecef;
    flex-shrink: 0;
}

.section-title {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 6px;
}

.section-title i {
    font-size: 14px;
}

.result-count {
    font-size: 11px;
    color: #8e9aaf;
    font-weight: normal;
}

/* 配置内容 - 紧凑化 */
.config-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.config-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.group-label {
    font-size: 12px;
    font-weight: 500;
    color: #111f68;
}

/* 自定义Radio组 - 紧凑化 */
.radio-group-custom {
    display: flex;
    gap: 6px;
}

.radio-option-custom {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    gap: 6px;
    background: #f9fafb;
    border: 1px solid #e8ecef;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    flex: 1;
}

.radio-option-custom:hover {
    border-color: #111f68;
    background: #f0f3f9;
}

.radio-option-custom.active {
    border-color: #111f68;
    background: #e8ecf5;
}

/* Radio圆圈 - 紧凑化 */
.radio-circle {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid #dcdfe6;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s ease;
}

.radio-option-custom.active .radio-circle {
    border-color: #111f68;
}

.radio-inner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: transparent;
    transition: all 0.2s ease;
}

.radio-option-custom.active .radio-inner {
    background-color: #111f68;
}

/* 图标样式 */
.radio-option-custom i {
    font-size: 14px;
    color: #6c757d;
    flex-shrink: 0;
}

.radio-option-custom.active i {
    color: #111f68;
}

/* 文字样式 */
.radio-option-custom span {
    color: #606266;
    font-size: 12px;
}

.radio-option-custom.active span {
    color: #111f68;
    font-weight: 600;
}

/* 上传区域 - 紧凑化 */
.upload-area {
    background: transparent;
    border: none;
}

.upload-area >>> .el-upload {
    width: 100%;
}

.upload-area >>> .el-upload-dragger {
    background: #f9fafb;
    border: 2px dashed #111f68;
    border-radius: 8px;
    padding: 24px 16px;
    min-height: 100px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
}

.upload-area >>> .el-upload-dragger:hover {
    border-color: #111f68;
    background: #f0f3f9;
}

.upload-area i {
    font-size: 32px;
    color: #111f68;
}

.upload-text {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
}

.upload-tip {
    font-size: 11px;
    color: #8e9aaf;
}

/* 文件列表 */
.file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 6px;
    max-height: 120px;
    overflow-y: auto;
}

.file-list-title {
    font-size: 12px;
    font-weight: 500;
    color: #111f68;
    margin-bottom: 4px;
}

.file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background-color: #ffffff;
    border-radius: 4px;
    border: 1px solid #e8ecef;
    font-size: 12px;
}

.file-icon {
    color: #111f68;
    font-size: 14px;
    flex-shrink: 0;
}

.file-name {
    color: #6c757d;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 参数项 - 紧凑化 */
.param-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e8ecef;
    gap: 8px;
    transition: all 0.2s ease;
}

.param-item:hover {
    border-color: #111f68;
    background: #f0f3f9;
}

.param-name {
    font-size: 12px;
    font-weight: 500;
    color: #111f68;
    flex: 0 0 auto;
    min-width: 60px;
}

.param-item .el-select {
    flex: 1;
}

.confidence-slider {
    flex: 1;
}

/* 操作按钮 - 紧凑化 */
.action-buttons {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.action-buttons .el-button {
    flex: 1;
    border-radius: 6px;
    font-size: 12px;
    padding: 8px 12px;
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

.custom-primary-btn:disabled {
    background-color: #d5d5d5 !important;
    border-color: #d5d5d5 !important;
    color: #999 !important;
    box-shadow: none;
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

/* 统计区域 - 紧凑化 */
.stats-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.stat-cards-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
}

.stat-card {
    padding: 10px;
    background: #f9fafb;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #e8ecef;
    transition: all 0.2s ease;
}

.stat-card:hover {
    border-color: #111f68;
}

.stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    background: #111f68;
    color: #fff;
    flex-shrink: 0;
}

.stat-icon.success {
    background: #10b981;
}

.stat-icon.warning {
    background: #f59e0b;
}

.stat-icon.info {
    background: #06b6d4;
}

.stat-info {
    flex: 1;
    min-width: 0;
}

.stat-label {
    font-size: 10px;
    color: #8e9aaf;
    margin-bottom: 1px;
}

.stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

.empty-stats,
.empty-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 30px 20px;
    color: #8e9aaf;
    font-size: 14px;
}

.empty-stats i,
.empty-results i {
    font-size: 32px;
    color: #d5d5d5;
}

/* 结果过滤 */
.result-filters {
    margin-bottom: 12px;
}

.result-filters .el-input {
    width: 100%;
}

/* 结果列表 */
.results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
}

.result-item {
    padding: 12px;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-radius: 10px;
    border: 2px solid #e8ecef;
    display: flex;
    gap: 12px;
    cursor: pointer;
    transition: all 0.3s;
}

.result-item:hover {
    border-color: #111f68;
    background: linear-gradient(135deg, #f0f3f9 0%, #ffffff 100%);
    box-shadow: 0 4px 16px rgba(17, 31, 104, 0.1);
    transform: translateY(-2px);
}

.result-item.active {
    border-color: #111f68;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    box-shadow: 0 8px 24px rgba(17, 31, 104, 0.25);
}

.result-item.active .result-name,
.result-item.active .result-meta {
    color: #fff;
}

.result-item.active .result-name {
    font-weight: 600;
}

.result-thumbnail {
    width: 70px;
    height: 70px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    border: 2px solid #e8ecef;
    display: flex;
    align-items: center;
    justify-content: center;
}

.result-item.active .result-thumbnail {
    border-color: rgba(255, 255, 255, 0.3);
}

.video-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    color: #fff;
}

.result-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.result-name {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #8e9aaf;
}

.meta-item {
    flex: 0 0 auto;
}

/* 详情区域 */
.detail-section {
    flex: 1;
    min-height: 0;
}

.detail-content {
    display: flex;
    gap: 16px;
    overflow-y: auto;
    max-height: 350px;
}

.result-preview {
    flex: 0 0 180px;
    border-radius: 8px;
    overflow: hidden;
    background-color: #f9fafb;
    border: 1px solid #e8ecef;
}

.result-annotator {
    width: 100%;
    min-height: 150px;
}

.result-preview img {
    width: 100%;
    height: auto;
    display: block;
}

.video-preview {
    width: 100%;
    height: 150px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 24px;
    color: #8e9aaf;
}

.video-preview span {
    font-size: 12px;
    color: #6c757d;
    text-align: center;
    padding: 0 10px;
}

.detection-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
}

.detail-row {
    display: flex;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #e8ecef;
}

.detail-row .label {
    font-size: 13px;
    color: #6c757d;
    font-weight: 500;
    flex: 0 0 80px;
}

.detail-row .value {
    font-size: 13px;
    color: #111f68;
    flex: 1;
    word-break: break-word;
}

.detection-classes {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e8ecef;
}

.class-title {
    font-size: 13px;
    font-weight: 600;
    color: #111f68;
    margin-bottom: 8px;
}

.class-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 12px;
    border-bottom: 1px solid #e8ecef;
}

.class-item:last-child {
    border-bottom: none;
}

.class-name {
    color: #6c757d;
    font-weight: 500;
}

.class-count {
    color: #10b981;
    font-weight: 600;
}

.detail-actions {
    padding-top: 12px;
    border-top: 1px solid #e8ecef;
}

.detail-actions .el-button {
    width: 100%;
}

/* 滚动条样式 */
.config-content::-webkit-scrollbar,
.config-section::-webkit-scrollbar,
.right-section::-webkit-scrollbar,
.file-list::-webkit-scrollbar,
.results-list::-webkit-scrollbar,
.detail-content::-webkit-scrollbar {
    width: 6px;
}

.config-content::-webkit-scrollbar-track,
.config-section::-webkit-scrollbar-track,
.right-section::-webkit-scrollbar-track,
.file-list::-webkit-scrollbar-track,
.results-list::-webkit-scrollbar-track,
.detail-content::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb,
.config-section::-webkit-scrollbar-thumb,
.right-section::-webkit-scrollbar-thumb,
.file-list::-webkit-scrollbar-thumb,
.results-list::-webkit-scrollbar-thumb,
.detail-content::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb:hover,
.config-section::-webkit-scrollbar-thumb:hover,
.right-section::-webkit-scrollbar-thumb:hover,
.file-list::-webkit-scrollbar-thumb:hover,
.results-list::-webkit-scrollbar-thumb:hover,
.detail-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
}

/* 响应式设计 */
@media (max-width: 1400px) {
    .content-wrapper {
        height: auto;
        flex-direction: column;
    }

    .config-section {
        flex: 0 0 auto;
        max-width: none;
        max-height: 500px;
    }

    .right-section {
        flex: 1;
    }

    .stat-cards-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .detail-content {
        flex-direction: column;
        max-height: none;
    }

    .result-preview {
        flex: 1;
    }
}

@media (max-width: 1024px) {
    .inference-test-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .stat-cards-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .result-preview {
        width: 100%;
        height: 200px;
    }

    .results-list {
        max-height: none;
    }
}
</style>
