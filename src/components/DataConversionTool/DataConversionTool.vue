<template>
    <div class="conversion-tool-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>数据集格式转换</h3>
            <div class="top-actions">
                <el-button
                    class="custom-default-btn"
                    @click="handleClearAll"
                    :disabled="isConverting"
                >
                    <i class="el-icon-delete"></i> 清空
                </el-button>
                <el-button
                    class="custom-default-btn"
                    @click="handleExportReport"
                    :disabled="conversionReport.total === 0"
                >
                    <i class="el-icon-download"></i> 导出报告
                </el-button>
            </div>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：转换配置 -->
            <div class="config-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-setting"></i>
                    转换配置
                </h4>

                <div class="config-content">
                    <!-- 源格式选择 -->
                    <div class="config-group">
                        <label class="group-label">源数据格式</label>
                        <el-radio-group v-model="conversionConfig.sourceFormat" @change="handleSourceFormatChange">
                            <el-radio label="coco" class="format-radio">
                                <span class="format-name">COCO</span>
                                <span class="format-desc">JSON 格式</span>
                            </el-radio>
                            <el-radio label="voc" class="format-radio">
                                <span class="format-name">VOC</span>
                                <span class="format-desc">XML 格式</span>
                            </el-radio>
                            <el-radio label="yolo" class="format-radio">
                                <span class="format-name">YOLO</span>
                                <span class="format-desc">TXT 格式</span>
                            </el-radio>
                        </el-radio-group>
                    </div>

                    <!-- 目标格式选择 -->
                    <div class="config-group">
                        <label class="group-label">目标数据格式</label>
                        <el-radio-group v-model="conversionConfig.targetFormat" @change="handleTargetFormatChange">
                            <el-radio 
                                v-for="format in availableTargetFormats" 
                                :key="format"
                                :label="format"
                                class="format-radio"
                            >
                                <span class="format-name">{{ format.toUpperCase() }}</span>
                                <span class="format-desc">{{ getFormatDesc(format) }}</span>
                            </el-radio>
                        </el-radio-group>
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
                            :multiple="true"
                            accept=".json,.xml,.txt"
                        >
                            <i class="el-icon-upload"></i>
                            <div class="upload-text">点击上传或拖拽文件到此处</div>
                            <div class="upload-tip">
                                支持 {{ uploadSupportTypes }} 格式，每个文件最大 100MB
                            </div>
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
                                    <i class="el-icon-document"></i>
                                </span>
                                <span class="file-name">{{ file.name }}</span>
                                <span class="file-size">{{ formatFileSize(file.size) }}</span>
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

                    <!-- 转换参数 -->
                    <div class="config-group">
                        <label class="group-label">转换参数</label>
                        <div class="param-item">
                            <span class="param-name">保留原始类别ID</span>
                            <el-switch
                                v-model="conversionConfig.keepOriginalIds"
                                :active-color="'#10b981'"
                                :inactive-color="'#ccc'"
                            ></el-switch>
                        </div>
                        <div class="param-item">
                            <span class="param-name">自动创建输出目录</span>
                            <el-switch
                                v-model="conversionConfig.createOutputDir"
                                :active-color="'#10b981'"
                                :inactive-color="'#ccc'"
                            ></el-switch>
                        </div>
                        <div class="param-item">
                            <span class="param-name">验证转换后数据</span>
                            <el-switch
                                v-model="conversionConfig.validateOutput"
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
                            @click="handleStartConversion"
                            :loading="isConverting"
                            :disabled="selectedFiles.length === 0 || !conversionConfig.targetFormat"
                        >
                            <i class="el-icon-video-play"></i>
                            {{ isConverting ? '转换中...' : '开始转换' }}
                        </el-button>
                        <el-button
                            @click="handleReset"
                            :disabled="isConverting"
                        >
                            重置配置
                        </el-button>
                    </div>
                </div>
            </div>

            <!-- 右侧：转换结果 -->
            <div class="right-section">
                <!-- 转换进度 -->
                <div class="progress-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-loading"></i>
                        转换进度
                    </h4>

                    <div v-if="isConverting" class="progress-content">
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="label">整体进度</span>
                                <span class="percentage">{{ conversionProgress.percentage }}%</span>
                            </div>
                            <el-progress
                                :percentage="conversionProgress.percentage"
                                :color="progressColor"
                            ></el-progress>
                        </div>

                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-label">已处理</div>
                                <div class="stat-value">{{ conversionProgress.processed }} / {{ conversionProgress.total }}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">成功</div>
                                <div class="stat-value success">{{ conversionProgress.success }}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">失败</div>
                                <div class="stat-value danger">{{ conversionProgress.failed }}</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-label">耗时</div>
                                <div class="stat-value">{{ conversionProgress.duration }}</div>
                            </div>
                        </div>
                    </div>

                    <div v-else class="empty-progress">
                        <i class="el-icon-document-copy"></i>
                        <p>等待开始转换</p>
                    </div>
                </div>

                <!-- 转换报告 -->
                <div class="report-section section-card">
                    <h4 class="section-title">
                        <i class="el-icon-document"></i>
                        转换报告
                    </h4>

                    <div v-if="conversionReport.total > 0" class="report-content">
                        <!-- 统计摘要 -->
                        <div class="summary-cards">
                            <div class="summary-card total">
                                <div class="card-icon">
                                    <i class="el-icon-document"></i>
                                </div>
                                <div class="card-content">
                                    <div class="card-label">总数</div>
                                    <div class="card-value">{{ conversionReport.total }}</div>
                                </div>
                            </div>
                            <div class="summary-card success">
                                <div class="card-icon">
                                    <i class="el-icon-success"></i>
                                </div>
                                <div class="card-content">
                                    <div class="card-label">成功</div>
                                    <div class="card-value">{{ conversionReport.successful }}</div>
                                </div>
                            </div>
                            <div class="summary-card failed">
                                <div class="card-icon">
                                    <i class="el-icon-close"></i>
                                </div>
                                <div class="card-content">
                                    <div class="card-label">失败</div>
                                    <div class="card-value">{{ conversionReport.failed }}</div>
                                </div>
                            </div>
                            <div class="summary-card rate">
                                <div class="card-icon">
                                    <i class="el-icon-data-analysis"></i>
                                </div>
                                <div class="card-content">
                                    <div class="card-label">成功率</div>
                                    <div class="card-value">{{ conversionReport.successRate }}%</div>
                                </div>
                            </div>
                        </div>

                        <!-- 详情列表 -->
                        <el-tabs v-model="activeTab" class="report-tabs">
                            <el-tab-pane label="成功项" name="success">
                                <div class="detail-list">
                                    <div
                                        v-for="item in conversionReport.successItems"
                                        :key="item.id"
                                        class="detail-item success"
                                    >
                                        <span class="item-icon">
                                            <i class="el-icon-success"></i>
                                        </span>
                                        <span class="item-name">{{ item.name }}</span>
                                        <span class="item-meta">
                                            <span class="info">{{ item.categories }} 个类别</span>
                                            <span class="info">{{ item.annotations }} 个注解</span>
                                        </span>
                                        <span class="item-time">{{ item.time }}</span>
                                    </div>
                                </div>
                            </el-tab-pane>
                            <el-tab-pane label="失败项" name="failed">
                                <div class="detail-list">
                                    <div
                                        v-for="item in conversionReport.failedItems"
                                        :key="item.id"
                                        class="detail-item failed"
                                    >
                                        <span class="item-icon">
                                            <i class="el-icon-close"></i>
                                        </span>
                                        <span class="item-name">{{ item.name }}</span>
                                        <span class="item-error">
                                            <i class="el-icon-warning"></i>
                                            {{ item.error }}
                                        </span>
                                        <span class="item-time">{{ item.time }}</span>
                                    </div>
                                </div>
                            </el-tab-pane>
                        </el-tabs>
                    </div>

                    <div v-else class="empty-report">
                        <i class="el-icon-document-copy"></i>
                        <p>暂无转换报告</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'DataConversionTool',
    data() {
        return {
            isConverting: false,
            activeTab: 'success',
            selectedFiles: [],
            conversionConfig: {
                sourceFormat: 'coco',
                targetFormat: '',
                keepOriginalIds: true,
                createOutputDir: true,
                validateOutput: true
            },
            conversionProgress: {
                percentage: 0,
                processed: 0,
                total: 0,
                success: 0,
                failed: 0,
                duration: '0s'
            },
            conversionReport: {
                total: 0,
                successful: 0,
                failed: 0,
                successRate: 0,
                successItems: [],
                failedItems: []
            },
            conversionTimer: null,
            startTime: null
        };
    },
    computed: {
        availableTargetFormats() {
            const formats = {
                coco: ['voc', 'yolo'],
                voc: ['coco', 'yolo'],
                yolo: ['coco', 'voc']
            };
            return formats[this.conversionConfig.sourceFormat] || [];
        },
        uploadSupportTypes() {
            const types = {
                coco: 'JSON',
                voc: 'XML',
                yolo: 'TXT'
            };
            return types[this.conversionConfig.sourceFormat] || 'JSON';
        },
        progressColor() {
            const percentage = this.conversionProgress.percentage;
            if (percentage < 50) return '#3b82f6';
            if (percentage < 80) return '#f59e0b';
            return '#10b981';
        }
    },
    methods: {
        getFormatDesc(format) {
            const descs = {
                coco: 'JSON 格式',
                voc: 'XML 格式',
                yolo: 'TXT 格式'
            };
            return descs[format] || '';
        },
        handleSourceFormatChange() {
            this.conversionConfig.targetFormat = '';
        },
        handleTargetFormatChange() {
            // 处理目标格式变更
        },
        handleFileSelect(file, fileList) {
            this.selectedFiles = fileList.map(f => ({
                name: f.name,
                size: f.size,
                raw: f.raw
            }));
        },
        removeFile(index) {
            this.selectedFiles.splice(index, 1);
        },
        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        handleStartConversion() {
            if (this.selectedFiles.length === 0) {
                this.$message.warning('请先选择要转换的文件');
                return;
            }

            this.$confirm('确认开始转换吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.isConverting = true;
                this.startTime = new Date();
                this.conversionProgress.total = this.selectedFiles.length;
                this.conversionProgress.processed = 0;
                this.conversionProgress.success = 0;
                this.conversionProgress.failed = 0;
                this.conversionProgress.percentage = 0;

                this.$message.success('转换已启动');

                // 模拟转换过程
                this.simulateConversion();
            }).catch(() => {
                this.$message.info('已取消操作');
            });
        },
        simulateConversion() {
            let currentIndex = 0;
            const successItems = [];
            const failedItems = [];

            this.conversionTimer = setInterval(() => {
                if (currentIndex < this.selectedFiles.length) {
                    const isSuccess = Math.random() > 0.15; // 85% 成功率
                    const file = this.selectedFiles[currentIndex];

                    if (isSuccess) {
                        this.conversionProgress.success++;
                        successItems.push({
                            id: currentIndex,
                            name: file.name,
                            categories: Math.floor(Math.random() * 20) + 5,
                            annotations: Math.floor(Math.random() * 500) + 100,
                            time: new Date().toLocaleTimeString()
                        });
                    } else {
                        this.conversionProgress.failed++;
                        const errors = [
                            '文件格式错误',
                            '缺少必需字段',
                            '类别ID重复',
                            '坐标值无效',
                            '文件损坏'
                        ];
                        failedItems.push({
                            id: currentIndex,
                            name: file.name,
                            error: errors[Math.floor(Math.random() * errors.length)],
                            time: new Date().toLocaleTimeString()
                        });
                    }

                    currentIndex++;
                    this.conversionProgress.processed = currentIndex;
                    this.conversionProgress.percentage = Math.floor((currentIndex / this.selectedFiles.length) * 100);

                    const elapsed = Math.floor((new Date() - this.startTime) / 1000);
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    this.conversionProgress.duration = minutes > 0 
                        ? `${minutes}m ${seconds}s` 
                        : `${seconds}s`;
                } else {
                    clearInterval(this.conversionTimer);
                    this.isConverting = false;
                    this.conversionProgress.percentage = 100;

                    // 生成报告
                    this.conversionReport.total = this.selectedFiles.length;
                    this.conversionReport.successful = this.conversionProgress.success;
                    this.conversionReport.failed = this.conversionProgress.failed;
                    this.conversionReport.successRate = Math.round(
                        (this.conversionProgress.success / this.selectedFiles.length) * 100
                    );
                    this.conversionReport.successItems = successItems;
                    this.conversionReport.failedItems = failedItems;

                    this.$message.success(`转换完成！成功 ${this.conversionProgress.success} 个，失败 ${this.conversionProgress.failed} 个`);
                }
            }, 500);
        },
        handleClearAll() {
            this.$confirm('确认清空所有数据吗？', '确认操作', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.selectedFiles = [];
                this.conversionReport = {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    successRate: 0,
                    successItems: [],
                    failedItems: []
                };
                this.conversionProgress = {
                    percentage: 0,
                    processed: 0,
                    total: 0,
                    success: 0,
                    failed: 0,
                    duration: '0s'
                };
                this.$message.success('已清空');
            });
        },
        handleReset() {
            this.conversionConfig = {
                sourceFormat: 'coco',
                targetFormat: '',
                keepOriginalIds: true,
                createOutputDir: true,
                validateOutput: true
            };
            this.$message.info('配置已重置');
        },
        handleExportReport() {
            if (this.conversionReport.total === 0) {
                this.$message.warning('暂无报告可导出');
                return;
            }

            const reportData = {
                timestamp: new Date().toLocaleString(),
                sourceFormat: this.conversionConfig.sourceFormat.toUpperCase(),
                targetFormat: this.conversionConfig.targetFormat.toUpperCase(),
                summary: {
                    total: this.conversionReport.total,
                    successful: this.conversionReport.successful,
                    failed: this.conversionReport.failed,
                    successRate: `${this.conversionReport.successRate}%`
                },
                successItems: this.conversionReport.successItems,
                failedItems: this.conversionReport.failedItems
            };

            const reportJson = JSON.stringify(reportData, null, 2);
            const blob = new Blob([reportJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `conversion_report_${new Date().getTime()}.json`;
            link.click();

            this.$message.success('报告已导出');
        }
    },
    beforeDestroy() {
        if (this.conversionTimer) {
            clearInterval(this.conversionTimer);
        }
    }
};
</script>

<style scoped>
.conversion-tool-container {
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
    max-width: 420px;
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

.format-radio {
    display: flex !important;
    align-items: flex-start !important;
    padding: 10px;
    margin-bottom: 8px;
    background-color: #f9fafb;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.5;
}

.format-radio /deep/ .el-radio__label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 8px;
}

.format-name {
    font-weight: 600;
    color: #111f68;
    font-size: 14px;
    display: block;
}

.format-desc {
    font-size: 12px;
    color: #8e9aaf;
    display: block;
    margin-top: 2px;
}

/* 上传区域 */
.upload-area {
    background-color: #f9fafb;
    border: 2px dashed #d5d5d5;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
}

.upload-area:hover {
    border-color: #111f68;
    background-color: #f0f3f9;
}

.upload-area i {
    font-size: 32px;
    color: #111f68;
    margin-bottom: 8px;
}

.upload-text {
    font-size: 14px;
    color: #111f68;
    margin-bottom: 4px;
}

.upload-tip {
    font-size: 12px;
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
    max-height: 150px;
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

.file-size {
    color: #8e9aaf;
    font-size: 11px;
}

/* 参数项 */
.param-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background-color: #f9fafb;
    border-radius: 4px;
    border: 1px solid #e8ecef;
}

.param-name {
    font-size: 13px;
    color: #6c757d;
}

/* 操作按钮 */
.action-buttons {
    display: flex;
    gap: 10px;
    flex-direction: column;
}

.action-buttons .el-button {
    width: 100%;
    border-radius: 6px;
    font-size: 13px;
}

.custom-primary-btn {
    background-color: #111f68 !important;
    border-color: #111f68 !important;
    color: #fff !important;
}

.custom-primary-btn:hover:not(:disabled) {
    background-color: #0d1554 !important;
    border-color: #0d1554 !important;
}

.custom-primary-btn:disabled {
    background-color: #d5d5d5 !important;
    border-color: #d5d5d5 !important;
    color: #999 !important;
}

.custom-default-btn {
    background-color: #ffffff !important;
    border-color: #111f68 !important;
    color: #111f68 !important;
}

.custom-default-btn:hover {
    background-color: #f0f3f9 !important;
}

/* 进度内容 */
.progress-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.progress-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.progress-header .label {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
}

.progress-header .percentage {
    font-size: 14px;
    font-weight: 600;
    color: #111f68;
}

/* 统计网格 */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.stat-card {
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e8ecef;
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: center;
}

.stat-label {
    font-size: 12px;
    color: #8e9aaf;
}

.stat-value {
    font-size: 16px;
    font-weight: 600;
    color: #111f68;
}

.stat-value.success {
    color: #10b981;
}

.stat-value.danger {
    color: #f43f5e;
}

/* 空状态 */
.empty-progress,
.empty-report {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 20px;
    color: #8e9aaf;
    font-size: 14px;
}

.empty-progress i,
.empty-report i {
    font-size: 32px;
    color: #d5d5d5;
}

/* 报告内容 */
.report-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* 摘要卡片 */
.summary-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}

.summary-card {
    padding: 12px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-left: 4px solid #8e9aaf;
    background-color: #f9fafb;
}

.summary-card.total {
    border-left-color: #111f68;
}

.summary-card.success {
    border-left-color: #10b981;
}

.summary-card.failed {
    border-left-color: #f43f5e;
}

.summary-card.rate {
    border-left-color: #f59e0b;
}

.card-icon {
    font-size: 24px;
    color: #111f68;
    flex-shrink: 0;
}

.summary-card.success .card-icon {
    color: #10b981;
}

.summary-card.failed .card-icon {
    color: #f43f5e;
}

.summary-card.rate .card-icon {
    color: #f59e0b;
}

.card-content {
    flex: 1;
}

.card-label {
    font-size: 11px;
    color: #8e9aaf;
    margin-bottom: 2px;
}

.card-value {
    font-size: 18px;
    font-weight: 700;
    color: #111f68;
}

.summary-card.success .card-value {
    color: #10b981;
}

.summary-card.failed .card-value {
    color: #f43f5e;
}

.summary-card.rate .card-value {
    color: #f59e0b;
}

/* 报告选项卡 */
.report-tabs {
    margin-top: 12px;
}

.report-tabs /deep/ .el-tabs__header {
    margin: 0;
    border-bottom: 1px solid #e8ecef;
}

.report-tabs /deep/ .el-tabs__nav {
    margin-left: 0;
}

/* 详情列表 */
.detail-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 250px;
    overflow-y: auto;
    padding-right: 6px;
}

.detail-item {
    padding: 10px;
    border-radius: 6px;
    background-color: #f9fafb;
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 4px solid #10b981;
}

.detail-item.failed {
    border-left-color: #f43f5e;
    background-color: #fef2f2;
}

.item-icon {
    font-size: 16px;
    color: #10b981;
    flex-shrink: 0;
}

.detail-item.failed .item-icon {
    color: #f43f5e;
}

.item-name {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
    flex: 0 0 auto;
    min-width: 120px;
}

.item-meta,
.item-error {
    font-size: 12px;
    color: #8e9aaf;
    flex: 1;
}

.item-error {
    color: #f43f5e;
}

.item-error i {
    margin-right: 4px;
}

.item-time {
    font-size: 12px;
    color: #8e9aaf;
    flex-shrink: 0;
    min-width: 80px;
    text-align: right;
}

.info {
    margin-right: 12px;
}

/* 滚动条样式 */
.config-content::-webkit-scrollbar,
.config-section::-webkit-scrollbar,
.right-section::-webkit-scrollbar,
.file-list::-webkit-scrollbar,
.detail-list::-webkit-scrollbar {
    width: 6px;
}

.config-content::-webkit-scrollbar-track,
.config-section::-webkit-scrollbar-track,
.right-section::-webkit-scrollbar-track,
.file-list::-webkit-scrollbar-track,
.detail-list::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb,
.config-section::-webkit-scrollbar-thumb,
.right-section::-webkit-scrollbar-thumb,
.file-list::-webkit-scrollbar-thumb,
.detail-list::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb:hover,
.config-section::-webkit-scrollbar-thumb:hover,
.right-section::-webkit-scrollbar-thumb:hover,
.file-list::-webkit-scrollbar-thumb:hover,
.detail-list::-webkit-scrollbar-thumb:hover {
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

    .summary-cards {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 1024px) {
    .conversion-tool-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .summary-cards {
        grid-template-columns: repeat(2, 1fr);
    }

    .stats-grid {
        grid-template-columns: 1fr;
    }

    .detail-item {
        flex-wrap: wrap;
    }

    .item-name {
        min-width: auto;
    }
}
</style>