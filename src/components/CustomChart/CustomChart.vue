<template>
    <div class="customchart-container">
        <!-- 顶部标题 -->
        <div class="top">
            <h3>自定义图表</h3>
            <div class="top-actions">
                <el-button
                    class="custom-default-btn"
                    @click="handleRefresh"
                    :loading="isRefreshing"
                >
                    <i class="el-icon-refresh"></i> 刷新数据
                </el-button>
                <el-button
                    class="custom-default-btn"
                    @click="handleExport"
                >
                    <i class="el-icon-download"></i> 导出
                </el-button>
            </div>
        </div>

        <!-- 主内容区域 -->
        <div class="content-wrapper">
            <!-- 左侧：图表配置 -->
            <div class="config-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-setting"></i>
                    图表配置
                </h4>

                <div class="config-content">
                    <!-- 图表类型选择 -->
                    <div class="config-group">
                        <label class="group-label">图表类型</label>
                        <el-radio-group v-model="chartConfig.chartType" @change="handleChartTypeChange" class="radio-group">
                            <el-radio label="line">折线图</el-radio>
                            <el-radio label="bar">柱状图</el-radio>
                            <el-radio label="pie">饼图</el-radio>
                            <el-radio label="scatter">散点图</el-radio>
                            <el-radio label="area">面积图</el-radio>
                        </el-radio-group>
                    </div>

                    <!-- 数据源选择 -->
                    <div class="config-group">
                        <label class="group-label">数据源</label>
                        <el-select v-model="chartConfig.dataSource" @change="handleDataSourceChange" class="select-input">
                            <el-option label="训练指标" value="training"></el-option>
                            <el-option label="验证指标" value="validation"></el-option>
                            <el-option label="测试指标" value="testing"></el-option>
                            <el-option label="综合对比" value="combined"></el-option>
                        </el-select>
                    </div>

                    <!-- X轴配置 -->
                    <div class="config-group">
                        <label class="group-label">X轴</label>
                        <el-select v-model="chartConfig.xAxis" class="select-input">
                            <el-option label="Epoch" value="epoch"></el-option>
                            <el-option label="Batch" value="batch"></el-option>
                            <el-option label="时间" value="time"></el-option>
                        </el-select>
                    </div>

                    <!-- Y轴配置 -->
                    <div class="config-group">
                        <label class="group-label">Y轴</label>
                        <el-select v-model="chartConfig.yAxis" class="select-input">
                            <el-option label="Loss" value="loss"></el-option>
                            <el-option label="Accuracy" value="accuracy"></el-option>
                            <el-option label="mAP" value="mAP"></el-option>
                            <el-option label="F1-Score" value="f1"></el-option>
                            <el-option label="Precision" value="precision"></el-option>
                            <el-option label="Recall" value="recall"></el-option>
                        </el-select>
                    </div>

                    <!-- 显示选项 -->
                    <div class="config-group">
                        <label class="group-label">显示选项</label>
                        <div class="checkbox-group">
                            <el-checkbox v-model="chartConfig.showLegend">显示图例</el-checkbox>
                            <el-checkbox v-model="chartConfig.showGrid">显示网格</el-checkbox>
                            <el-checkbox v-model="chartConfig.showTooltip">显示提示</el-checkbox>
                            <el-checkbox v-model="chartConfig.smoothLine">平滑曲线</el-checkbox>
                        </div>
                    </div>

                    <!-- 数据更新 -->
                    <div class="config-group">
                        <label class="group-label">实时更新</label>
                        <el-switch v-model="isAutoUpdate" @change="handleAutoUpdateChange"></el-switch>
                        <span v-if="isAutoUpdate" class="update-interval">
                            每 {{ updateInterval }}s 更新一次
                        </span>
                    </div>

                    <!-- 操作按钮 -->
                    <div class="action-buttons">
                        <el-button 
                            type="primary"
                            class="custom-primary-btn"
                            @click="handleApplyConfig"
                        >
                            应用配置
                        </el-button>
                        <el-button 
                            class="custom-default-btn"
                            @click="handleResetConfig"
                        >
                            重置配置
                        </el-button>
                    </div>
                </div>
            </div>

            <!-- 右侧：图表显示 -->
            <div class="chart-section section-card">
                <h4 class="section-title">
                    <i class="el-icon-data-analysis"></i>
                    {{ getChartTypeLabel(chartConfig.chartType) }}
                </h4>

                <div class="chart-display">
                    <svg viewBox="0 0 800 400" class="chart-svg" ref="chartSvg">
                        <!-- 根据图表类型动态渲染 -->
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e8ecef" stroke-width="0.5"/>
                            </pattern>
                        </defs>

                        <!-- 背景网格 -->
                        <rect v-if="chartConfig.showGrid" width="800" height="400" fill="url(#grid)" />

                        <!-- 折线图 -->
                        <template v-if="chartConfig.chartType === 'line'">
                            <!-- Y轴标签 -->
                            <text x="30" y="20" font-size="12" fill="#8e9aaf">100</text>
                            <text x="30" y="210" font-size="12" fill="#8e9aaf">50</text>
                            <text x="35" y="400" font-size="12" fill="#8e9aaf">0</text>

                            <!-- 曲线1 -->
                            <polyline points="80,300 150,250 220,200 290,160 360,130 430,110 500,100 570,105 640,120 710,145" fill="none" stroke="#3b82f6" stroke-width="2" />
                            <circle cx="80" cy="300" r="3" fill="#3b82f6" />
                            <circle cx="150" cy="250" r="3" fill="#3b82f6" />
                            <circle cx="220" cy="200" r="3" fill="#3b82f6" />
                            <circle cx="290" cy="160" r="3" fill="#3b82f6" />
                            <circle cx="360" cy="130" r="3" fill="#3b82f6" />
                            <circle cx="430" cy="110" r="3" fill="#3b82f6" />
                            <circle cx="500" cy="100" r="3" fill="#3b82f6" />
                            <circle cx="570" cy="105" r="3" fill="#3b82f6" />
                            <circle cx="640" cy="120" r="3" fill="#3b82f6" />
                            <circle cx="710" cy="145" r="3" fill="#3b82f6" />

                            <!-- 曲线2 -->
                            <polyline points="80,320 150,280 220,240 290,200 360,170 430,150 500,140 570,145 640,160 710,185" fill="none" stroke="#10b981" stroke-width="2" />
                            <circle cx="80" cy="320" r="3" fill="#10b981" />
                            <circle cx="150" cy="280" r="3" fill="#10b981" />
                            <circle cx="220" cy="240" r="3" fill="#10b981" />
                            <circle cx="290" cy="200" r="3" fill="#10b981" />
                            <circle cx="360" cy="170" r="3" fill="#10b981" />
                            <circle cx="430" cy="150" r="3" fill="#10b981" />
                            <circle cx="500" cy="140" r="3" fill="#10b981" />
                            <circle cx="570" cy="145" r="3" fill="#10b981" />
                            <circle cx="640" cy="160" r="3" fill="#10b981" />
                            <circle cx="710" cy="185" r="3" fill="#10b981" />

                            <!-- 坐标轴 -->
                            <line x1="50" y1="350" x2="750" y2="350" stroke="#111f68" stroke-width="2" />
                            <line x1="50" y1="30" x2="50" y2="350" stroke="#111f68" stroke-width="2" />

                            <!-- 轴标签 -->
                            <text x="400" y="390" text-anchor="middle" font-size="12" fill="#111f68">{{ chartConfig.xAxis }}</text>
                            <text x="10" y="190" text-anchor="middle" font-size="12" fill="#111f68" transform="rotate(-90 10 190)">{{ chartConfig.yAxis }}</text>
                        </template>

                        <!-- 柱状图 -->
                        <template v-if="chartConfig.chartType === 'bar'">
                            <rect x="70" y="250" width="30" height="100" fill="#3b82f6" />
                            <rect x="110" y="200" width="30" height="150" fill="#3b82f6" />
                            <rect x="150" y="150" width="30" height="200" fill="#3b82f6" />
                            <rect x="190" y="100" width="30" height="250" fill="#3b82f6" />
                            <rect x="230" y="150" width="30" height="200" fill="#3b82f6" />
                            <rect x="270" y="200" width="30" height="150" fill="#3b82f6" />
                            <rect x="310" y="250" width="30" height="100" fill="#3b82f6" />

                            <rect x="360" y="220" width="30" height="130" fill="#10b981" />
                            <rect x="400" y="180" width="30" height="170" fill="#10b981" />
                            <rect x="440" y="130" width="30" height="220" fill="#10b981" />
                            <rect x="480" y="80" width="30" height="270" fill="#10b981" />
                            <rect x="520" y="140" width="30" height="210" fill="#10b981" />
                            <rect x="560" y="190" width="30" height="160" fill="#10b981" />
                            <rect x="600" y="240" width="30" height="110" fill="#10b981" />

                            <!-- 坐标轴 -->
                            <line x1="50" y1="350" x2="700" y2="350" stroke="#111f68" stroke-width="2" />
                            <line x1="50" y1="30" x2="50" y2="350" stroke="#111f68" stroke-width="2" />

                            <!-- Y轴标签 -->
                            <text x="30" y="40" font-size="12" fill="#8e9aaf">250</text>
                            <text x="30" y="195" font-size="12" fill="#8e9aaf">125</text>
                            <text x="35" y="360" font-size="12" fill="#8e9aaf">0</text>
                        </template>

                        <!-- 饼图 -->
                        <template v-if="chartConfig.chartType === 'pie'">
                            <!-- 饼图切片 -->
                            <circle cx="300" cy="200" r="120" fill="none" stroke="#3b82f6" stroke-width="60" stroke-dasharray="188.4 1256.6" />
                            <circle cx="300" cy="200" r="120" fill="none" stroke="#10b981" stroke-width="60" stroke-dasharray="314 1256.6" stroke-dashoffset="-188.4" />
                            <circle cx="300" cy="200" r="120" fill="none" stroke="#f59e0b" stroke-width="60" stroke-dasharray="188.4 1256.6" stroke-dashoffset="-502.4" />
                            <circle cx="300" cy="200" r="120" fill="none" stroke="#ef4444" stroke-width="60" stroke-dasharray="565.2 1256.6" stroke-dashoffset="-690.8" />

                            <!-- 中心圆 -->
                            <circle cx="300" cy="200" r="50" fill="#ffffff" stroke="#e8ecef" stroke-width="1" />
                            <text x="300" y="200" text-anchor="middle" dominant-baseline="middle" font-size="16" font-weight="600" fill="#111f68">数据分布</text>

                            <!-- 图例 -->
                            <rect x="550" y="80" width="16" height="16" fill="#3b82f6" />
                            <text x="575" y="95" font-size="12" fill="#111f68">类别A (15%)</text>

                            <rect x="550" y="120" width="16" height="16" fill="#10b981" />
                            <text x="575" y="135" font-size="12" fill="#111f68">类别B (25%)</text>

                            <rect x="550" y="160" width="16" height="16" fill="#f59e0b" />
                            <text x="575" y="175" font-size="12" fill="#111f68">类别C (15%)</text>

                            <rect x="550" y="200" width="16" height="16" fill="#ef4444" />
                            <text x="575" y="215" font-size="12" fill="#111f68">类别D (45%)</text>
                        </template>

                        <!-- 散点图 -->
                        <template v-if="chartConfig.chartType === 'scatter'">
                            <!-- Y轴标签 -->
                            <text x="30" y="20" font-size="12" fill="#8e9aaf">100</text>
                            <text x="30" y="210" font-size="12" fill="#8e9aaf">50</text>
                            <text x="35" y="400" font-size="12" fill="#8e9aaf">0</text>

                            <!-- 散点 -->
                            <circle cx="100" cy="280" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="150" cy="240" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="200" cy="200" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="250" cy="180" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="300" cy="150" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="350" cy="120" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="400" cy="100" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="450" cy="110" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="500" cy="130" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="550" cy="160" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="600" cy="200" r="5" fill="#3b82f6" opacity="0.6" />
                            <circle cx="650" cy="240" r="5" fill="#3b82f6" opacity="0.6" />

                            <!-- 坐标轴 -->
                            <line x1="50" y1="350" x2="750" y2="350" stroke="#111f68" stroke-width="2" />
                            <line x1="50" y1="30" x2="50" y2="350" stroke="#111f68" stroke-width="2" />

                            <!-- 轴标签 -->
                            <text x="400" y="390" text-anchor="middle" font-size="12" fill="#111f68">{{ chartConfig.xAxis }}</text>
                            <text x="10" y="190" text-anchor="middle" font-size="12" fill="#111f68" transform="rotate(-90 10 190)">{{ chartConfig.yAxis }}</text>
                        </template>

                        <!-- 面积图 -->
                        <template v-if="chartConfig.chartType === 'area'">
                            <!-- Y轴标签 -->
                            <text x="30" y="20" font-size="12" fill="#8e9aaf">100</text>
                            <text x="30" y="210" font-size="12" fill="#8e9aaf">50</text>
                            <text x="35" y="400" font-size="12" fill="#8e9aaf">0</text>

                            <!-- 面积1 -->
                            <polygon points="80,350 150,300 220,240 290,190 360,150 430,120 500,110 570,115 640,140 710,180 710,350" fill="#3b82f6" opacity="0.3" />
                            <polyline points="80,350 150,300 220,240 290,190 360,150 430,120 500,110 570,115 640,140 710,180" fill="none" stroke="#3b82f6" stroke-width="2" />

                            <!-- 面积2 -->
                            <polygon points="80,350 150,320 220,270 290,220 360,180 430,150 500,140 570,145 640,170 710,210 710,350" fill="#10b981" opacity="0.3" />
                            <polyline points="80,350 150,320 220,270 290,220 360,180 430,150 500,140 570,145 640,170 710,210" fill="none" stroke="#10b981" stroke-width="2" />

                            <!-- 坐标轴 -->
                            <line x1="50" y1="350" x2="750" y2="350" stroke="#111f68" stroke-width="2" />
                            <line x1="50" y1="30" x2="50" y2="350" stroke="#111f68" stroke-width="2" />

                            <!-- 轴标签 -->
                            <text x="400" y="390" text-anchor="middle" font-size="12" fill="#111f68">{{ chartConfig.xAxis }}</text>
                            <text x="10" y="190" text-anchor="middle" font-size="12" fill="#111f68" transform="rotate(-90 10 190)">{{ chartConfig.yAxis }}</text>
                        </template>
                    </svg>

                    <!-- 图表图例 -->
                    <div v-if="chartConfig.showLegend" class="chart-legend">
                        <div class="legend-item">
                            <span class="legend-color" style="background-color: #3b82f6;"></span>
                            <span class="legend-label">{{ chartConfig.dataSource === 'combined' ? '数据集1' : '主数据' }}</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background-color: #10b981;"></span>
                            <span class="legend-label">{{ chartConfig.dataSource === 'combined' ? '数据集2' : '对比数据' }}</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background-color: #f59e0b;"></span>
                            <span class="legend-label">{{ chartConfig.dataSource === 'combined' ? '数据集3' : '参考数据' }}</span>
                        </div>
                    </div>

                    <!-- 数据信息 -->
                    <div class="chart-info">
                        <span class="info-item">最后更新: {{ lastUpdateTime }}</span>
                        <span class="info-item" v-if="isAutoUpdate">
                            <i class="el-icon-loading"></i> 自动更新中
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 导出对话框 -->
        <el-dialog title="导出图表" :visible.sync="exportDialogVisible" width="500px">
            <div class="export-options">
                <div class="export-group">
                    <label>导出格式</label>
                    <el-radio-group v-model="exportFormat">
                        <el-radio label="png">PNG 图片</el-radio>
                        <el-radio label="svg">SVG 矢量</el-radio>
                        <el-radio label="json">JSON 数据</el-radio>
                        <el-radio label="csv">CSV 数据</el-radio>
                    </el-radio-group>
                </div>
                <div class="export-group">
                    <label>分辨率</label>
                    <el-select v-model="exportResolution" v-if="exportFormat === 'png'" class="select-input">
                        <el-option label="1920x1080" value="1920x1080"></el-option>
                        <el-option label="2560x1440" value="2560x1440"></el-option>
                        <el-option label="3840x2160" value="3840x2160"></el-option>
                    </el-select>
                </div>
            </div>
            <div slot="footer" class="dialog-footer">
                <el-button @click="exportDialogVisible = false">取 消</el-button>
                <el-button type="primary" @click="handleConfirmExport">导 出</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
export default {
    name: 'CustomChart',
    data() {
        return {
            chartConfig: {
                chartType: 'line',
                dataSource: 'training',
                xAxis: 'epoch',
                yAxis: 'loss',
                showLegend: true,
                showGrid: true,
                showTooltip: true,
                smoothLine: true
            },
            isAutoUpdate: true,
            updateInterval: 5,
            isRefreshing: false,
            lastUpdateTime: new Date().toLocaleTimeString(),
            exportDialogVisible: false,
            exportFormat: 'png',
            exportResolution: '1920x1080',
            updateTimer: null
        };
    },
    methods: {
        getChartTypeLabel(type) {
            const labels = {
                'line': '折线图',
                'bar': '柱状图',
                'pie': '饼图',
                'scatter': '散点图',
                'area': '面积图'
            };
            return labels[type] || type;
        },
        handleChartTypeChange() {
            this.$message.info(`已切换到${this.getChartTypeLabel(this.chartConfig.chartType)}`);
        },
        handleDataSourceChange() {
            this.$message.info('数据源已更改');
        },
        handleAutoUpdateChange(val) {
            if (val) {
                this.startAutoUpdate();
                this.$message.success('自动更新已启用');
            } else {
                this.stopAutoUpdate();
                this.$message.info('自动更新已禁用');
            }
        },
        handleApplyConfig() {
            this.$message.success('图表配置已应用');
        },
        handleResetConfig() {
            this.chartConfig = {
                chartType: 'line',
                dataSource: 'training',
                xAxis: 'epoch',
                yAxis: 'loss',
                showLegend: true,
                showGrid: true,
                showTooltip: true,
                smoothLine: true
            };
            this.$message.info('配置已重置');
        },
        handleRefresh() {
            this.isRefreshing = true;
            setTimeout(() => {
                this.lastUpdateTime = new Date().toLocaleTimeString();
                this.isRefreshing = false;
                this.$message.success('数据已更新');
            }, 1000);
        },
        handleExport() {
            this.exportDialogVisible = true;
        },
        handleConfirmExport() {
            const formats = {
                'png': 'PNG 图片',
                'svg': 'SVG 矢量',
                'json': 'JSON 数据',
                'csv': 'CSV 数据'
            };
            this.$message.success(`图表已导出为 ${formats[this.exportFormat]} 格式`);
            this.exportDialogVisible = false;
        },
        startAutoUpdate() {
            this.updateTimer = setInterval(() => {
                this.lastUpdateTime = new Date().toLocaleTimeString();
            }, this.updateInterval * 1000);
        },
        stopAutoUpdate() {
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
                this.updateTimer = null;
            }
        }
    },
    mounted() {
        if (this.isAutoUpdate) {
            this.startAutoUpdate();
        }
    },
    beforeDestroy() {
        this.stopAutoUpdate();
    }
};
</script>

<style scoped>
.customchart-container {
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
    flex: 0 0 30%;
    max-width: 350px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

/* 右侧：图表 */
.chart-section {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
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

.radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.radio-group .el-radio {
    font-size: 13px;
}

.select-input {
    width: 100%;
}

.checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.checkbox-group .el-checkbox {
    font-size: 13px;
}

.update-interval {
    font-size: 12px;
    color: #8e9aaf;
    margin-left: 12px;
}

.action-buttons {
    display: flex;
    gap: 10px;
    flex-direction: column;
    margin-top: 8px;
}

.action-buttons .el-button {
    width: 100%;
    border-radius: 6px;
    font-size: 13px;
    margin-left: 0px;
}

.custom-primary-btn {
    background-color: #111f68 !important;
    border-color: #111f68 !important;
    color: #fff !important;
}

.custom-primary-btn:hover {
    background-color: #0d1554 !important;
    border-color: #0d1554 !important;
}

.custom-default-btn {
    background-color: #ffffff !important;
    border-color: #111f68 !important;
    color: #111f68 !important;
}

.custom-default-btn:hover {
    background-color: #f0f3f9 !important;
}

/* 图表显示 */
.chart-display {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow-y: auto;
}

.chart-svg {
    width: 100%;
    height: 400px;
    background-color: #ffffff;
    border-radius: 8px;
    border: 1px solid #e8ecef;
}

.chart-legend {
    display: flex;
    gap: 20px;
    justify-content: center;
    padding: 12px;
    background-color: #f9fafb;
    border-radius: 6px;
    flex-wrap: wrap;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #4a5568;
}

.legend-color {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.legend-label {
    font-weight: 500;
}

.chart-info {
    display: flex;
    gap: 20px;
    padding: 10px;
    background-color: #f9fafb;
    border-radius: 6px;
    font-size: 12px;
    color: #8e9aaf;
    justify-content: center;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.info-item i {
    font-size: 12px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* 导出选项 */
.export-options {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.export-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.export-group label {
    font-size: 13px;
    font-weight: 500;
    color: #111f68;
}

.export-group .el-radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.export-group .el-radio {
    font-size: 13px;
}

/* 对话框样式 */
.el-dialog {
    width: 500px !important;
}

.dialog-footer {
    padding: 10px 20px !important;
}

/* 滚动条样式 */
.config-content::-webkit-scrollbar,
.config-section::-webkit-scrollbar,
.chart-section::-webkit-scrollbar,
.chart-display::-webkit-scrollbar {
    width: 6px;
}

.config-content::-webkit-scrollbar-track,
.config-section::-webkit-scrollbar-track,
.chart-section::-webkit-scrollbar-track,
.chart-display::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb,
.config-section::-webkit-scrollbar-thumb,
.chart-section::-webkit-scrollbar-thumb,
.chart-display::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
}

.config-content::-webkit-scrollbar-thumb:hover,
.config-section::-webkit-scrollbar-thumb:hover,
.chart-section::-webkit-scrollbar-thumb:hover,
.chart-display::-webkit-scrollbar-thumb:hover {
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
        max-height: 300px;
    }

    .chart-section {
        flex: 1;
    }
}

@media (max-width: 1024px) {
    .customchart-container {
        width: calc(100% - 10px);
        margin-left: 5px;
    }

    .chart-svg {
        height: 300px;
    }

    .top-actions {
        flex-direction: column;
        width: 100%;
    }

    .top-actions .el-button {
        width: 100%;
    }
}
</style>