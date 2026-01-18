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
                                <img v-if="result.type === 'image'" :src="result.preview" :alt="result.name">
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
                            <img v-if="currentResult.type === 'image'" :src="currentResult.preview" :alt="currentResult.name">
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
export default {
    name: 'ModelInferenceTest',
    data() {
        return {
            selectedFiles: [],
            isInferencing: false,
            resultFilter: '',
            selectedResultIndex: null,
            inferenceConfig: {
                type: 'image',
                model: 'yolov8m',
                confidence: 0.5,
                iou: 0.5,
                showLabels: true,
                showConfidence: true
            },
            inferenceResults: []
        };
    },
    computed: {
        successCount() {
            return this.inferenceResults.filter(r => r.status === '成功').length;
        },
        totalDetections() {
            return this.inferenceResults.reduce((sum, r) => sum + r.detections, 0);
        },
        averageTime() {
            if (this.inferenceResults.length === 0) return '0ms';
            const total = this.inferenceResults.reduce((sum, r) => {
                const ms = parseInt(r.time);
                return sum + ms;
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
    methods: {
        getAcceptTypes() {
            const types = {
                image: '.jpg,.jpeg,.png,.bmp',
                folder: '*',
                video: '.mp4,.avi,.mov,.mkv'
            };
            return types[this.inferenceConfig.type] || '.*';
        },
        getUploadIcon() {
            const icons = {
                image: 'el-icon-picture',
                folder: 'el-icon-folder-add',
                video: 'el-icon-video-play'
            };
            return icons[this.inferenceConfig.type] || 'el-icon-upload';
        },
        getUploadText() {
            const texts = {
                image: '点击上传或拖拽图片到此处',
                folder: '点击选择或拖拽文件夹到此处',
                video: '点击上传或拖拽视频到此处'
            };
            return texts[this.inferenceConfig.type] || '点击上传文件';
        },
        getUploadTip() {
            const tips = {
                image: '支持 JPG, PNG, BMP 等格式，每个文件最大 50MB',
                folder: '支持整个文件夹的推理',
                video: '支持 MP4, AVI, MOV 等格式，每个文件最大 500MB'
            };
            return tips[this.inferenceConfig.type] || '支持多种格式';
        },
        getFileIcon(filename) {
            if (filename.match(/\.(jpg|jpeg|png|bmp)$/i)) {
                return 'el-icon-picture';
            } else if (filename.match(/\.(mp4|avi|mov|mkv)$/i)) {
                return 'el-icon-video-play';
            }
            return 'el-icon-document';
        },
        handleTypeChange() {
            this.selectedFiles = [];
        },
        selectInferenceType(type) {
            this.inferenceConfig.type = type;
            this.handleTypeChange();
        },
        handleFileSelect(file, fileList) {
            this.selectedFiles = fileList.map(f => ({
                name: f.name,
                raw: f.raw
            }));
        },
        removeFile(index) {
            this.selectedFiles.splice(index, 1);
        },
        formatConfidence(value) {
            return (value * 100).toFixed(0) + '%';
        },
        formatIOU(value) {
            return (value * 100).toFixed(0) + '%';
        },
        handleStartInference() {
            if (this.selectedFiles.length === 0) {
                this.$message.warning('请先选择要推理的文件');
                return;
            }

            this.$confirm('确认开始推理吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.isInferencing = true;
                this.inferenceResults = [];
                this.selectedResultIndex = null;

                this.$message.success('推理已启动');

                // 模拟推理过程
                this.simulateInference();
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },
        simulateInference() {
            let currentIndex = 0;
            const interval = setInterval(() => {
                if (currentIndex < this.selectedFiles.length) {
                    const file = this.selectedFiles[currentIndex];
                    const isSuccess = Math.random() > 0.05; // 95% 成功率
                    
                    if (isSuccess) {
                        const detections = Math.floor(Math.random() * 15) + 1;
                        const time = Math.floor(Math.random() * 200) + 50;
                        
                        const classes = {};
                        const classNames = ['person', 'car', 'dog', 'cat', 'bicycle', 'truck'];
                        let remaining = detections;
                        for (let i = 0; i < classNames.length && remaining > 0; i++) {
                            const count = Math.floor(Math.random() * remaining) + 1;
                            classes[classNames[i]] = count;
                            remaining -= count;
                        }

                        this.inferenceResults.push({
                            name: file.name,
                            type: this.inferenceConfig.type,
                            detections: detections,
                            time: time + 'ms',
                            status: '成功',
                            preview: this.generatePreview(detections),
                            classes: classes
                        });
                    } else {
                        this.inferenceResults.push({
                            name: file.name,
                            type: this.inferenceConfig.type,
                            detections: 0,
                            time: '-',
                            status: '失败',
                            preview: '',
                            classes: {}
                        });
                    }
                    currentIndex++;
                } else {
                    clearInterval(interval);
                    this.isInferencing = false;
                    if (this.inferenceResults.length > 0) {
                        this.selectedResultIndex = 0;
                    }
                    this.$message.success('推理完成');
                }
            }, 500);
        },
        generatePreview(detections) {
            // 生成一个简单的 SVG 预览
            const svg = `<svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="150" fill="#f0f0f0"/>
                <text x="100" y="75" text-anchor="middle" font-size="14" fill="#666">
                    检测 ${detections} 个对象
                </text>
            </svg>`;
            return 'data:image/svg+xml;base64,' + btoa(svg);
        },
        selectResult(index) {
            this.selectedResultIndex = index;
        },
        handleDownloadResult() {
            if (!this.currentResult) {
                this.$message.warning('请先选择一个结果');
                return;
            }

            const resultData = {
                filename: this.currentResult.name,
                type: this.currentResult.type,
                detections: this.currentResult.detections,
                inferenceTime: this.currentResult.time,
                model: this.inferenceConfig.model,
                confidence: this.inferenceConfig.confidence,
                classes: this.currentResult.classes,
                timestamp: new Date().toLocaleString()
            };

            const blob = new Blob([JSON.stringify(resultData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `inference_result_${Date.now()}.json`;
            link.click();

            this.$message.success('结果已下载');
        },
        handleExportReport() {
            if (this.inferenceResults.length === 0) {
                this.$message.warning('暂无结果可导出');
                return;
            }

            const report = {
                timestamp: new Date().toLocaleString(),
                inferenceType: this.inferenceConfig.type,
                model: this.inferenceConfig.model,
                parameters: {
                    confidence: this.inferenceConfig.confidence,
                    iou: this.inferenceConfig.iou
                },
                summary: {
                    totalProcessed: this.inferenceResults.length,
                    successful: this.successCount,
                    totalDetections: this.totalDetections,
                    averageTime: this.averageTime
                },
                results: this.inferenceResults.map(r => ({
                    filename: r.name,
                    status: r.status,
                    detections: r.detections,
                    time: r.time,
                    classes: r.classes
                }))
            };

            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `inference_report_${Date.now()}.json`;
            link.click();

            this.$message.success('报告已导出');
        },
        handleClearResults() {
            this.$confirm('确认清空所有结果吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.inferenceResults = [];
                this.selectedResultIndex = null;
                this.$message.success('结果已清空');
            });
        },
        handleReset() {
            this.selectedFiles = [];
            this.inferenceConfig = {
                type: 'image',
                model: 'yolov8m',
                confidence: 0.5,
                iou: 0.5,
                showLabels: true,
                showConfidence: true
            };
            this.$message.info('配置已重置');
        }
    }
};
</script>

<style scoped>
.inference-test-container {
    display: flex;
    flex-direction: column;
    margin-left: 10px;
    box-sizing: border-box;
    width: calc(100% - 20px);
    min-width: 800px;
}

.top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
}

.top h3 {
    font-size: 24px;
    font-weight: bolder;
    color: #111f68;
}

.top-actions {
    display: flex;
    gap: 10px;
}

.top-actions .el-button {
    border-radius: 6px;
}

/* 主内容区域 */
.content-wrapper {
    display: flex;
    gap: 20px;
    width: 100%;
    height: calc(100vh - 150px);
}

/* 左侧：配置 */
.config-section {
    flex: 0 0 35%;
    max-width: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 右侧：结果 */
.right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 0;
    overflow-y: auto;
}

/* 通用卡片样式 */
.section-card {
    background: #ffffff;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e8ecef;
    flex-shrink: 0;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #111f68;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-title i {
    font-size: 18px;
}

.result-count {
    font-size: 12px;
    color: #8e9aaf;
    font-weight: normal;
}

/* 配置内容 */
.config-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
}

.config-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.group-label {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
}

/* 自定义Radio组 */
.radio-group-custom {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.radio-option-custom {
    display: flex;
    align-items: center;
    padding: 12px;
    gap: 12px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    border: 2px solid #e8ecef;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.radio-option-custom:hover {
    border-color: #111f68;
    background: linear-gradient(135deg, #f0f3f9 0%, #ffffff 100%);
}

.radio-option-custom.active {
    border-color: #111f68 !important;
    background: linear-gradient(135deg, #e8ecf5 0%, #ffffff 100%) !important;
    box-shadow: 0 2px 8px rgba(17, 31, 104, 0.15);
}

/* Radio圆圈 */
.radio-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #dcdfe6;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.3s ease;
}

.radio-option-custom.active .radio-circle {
    border-color: #111f68;
}

.radio-inner {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: transparent;
    transition: all 0.3s ease;
}

.radio-option-custom.active .radio-inner {
    background-color: #111f68;
}

/* 图标样式 */
.radio-option-custom i {
    font-size: 18px;
    color: #6c757d;
    transition: color 0.3s ease;
    flex-shrink: 0;
}

.radio-option-custom.active i {
    color: #111f68;
}

/* 文字样式 */
.radio-option-custom span {
    color: #606266;
    transition: all 0.3s ease;
    flex: 1;
}

.radio-option-custom.active span {
    color: #111f68;
    font-weight: 600;
}

/* 上传区域 */
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
    padding: 50px 30px;
    min-height: 200px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
}

.upload-area >>> .el-upload-dragger::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at top right, rgba(17, 31, 104, 0.05), transparent);
    pointer-events: none;
}

.upload-area >>> .el-upload-dragger:hover {
    border-color: #111f68;
    background: linear-gradient(135deg, #e8ecf5 0%, #ffffff 100%);
    box-shadow: 0 8px 24px rgba(17, 31, 104, 0.15);
}

.upload-area i {
    font-size: 50px;
    color: #111f68;
    display: block;
    margin: 0;
}

.upload-text {
    font-size: 16px;
    font-weight: 600;
    color: #111f68;
    margin: 0;
    line-height: 1.4;
}

.upload-tip {
    font-size: 13px;
    color: #6c757d;
    margin: 0;
    line-height: 1.4;
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

/* 参数项 */
.param-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    border-radius: 8px;
    border: 1.5px solid #e8ecef;
    gap: 12px;
    transition: all 0.3s ease;
}

.param-item:hover {
    border-color: #111f68;
    background: linear-gradient(135deg, #f0f3f9 0%, #ffffff 100%);
}

.param-name {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
    flex: 0 0 auto;
    min-width: 80px;
}

.param-item .el-select {
    flex: 1;
}

.confidence-slider {
    flex: 1;
}

/* 操作按钮 */
.action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.action-buttons .el-button {
    flex: 1;
    min-width: 120px;
    border-radius: 6px;
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

/* 统计区域 */
.stats-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.stat-cards-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
}

.stat-card {
    padding: 14px;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1.5px solid #e8ecef;
    transition: all 0.3s ease;
}

.stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(17, 31, 104, 0.1);
    border-color: #111f68;
}

.stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    background: linear-gradient(135deg, #111f68 0%, #0d1554 100%);
    color: #fff;
    flex-shrink: 0;
}

.stat-icon.success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
}

.stat-icon.warning {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: #fff;
}

.stat-icon.info {
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    color: #fff;
}

.stat-info {
    flex: 1;
}

.stat-label {
    font-size: 11px;
    color: #8e9aaf;
    margin-bottom: 2px;
}

.stat-value {
    font-size: 18px;
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