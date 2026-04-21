<template>
  <div class="dataset-detail-page page-container">
    <header class="detail-hero">
      <div class="hero-left">
        <button class="back-link" type="button" @click="goBack">
          <i class="el-icon-arrow-left"></i> 返回数据集列表
        </button>
        <div class="hero-content">
            <div class="hero-kicker">非法数据集概览</div>
            <h1 class="hero-title">{{ datasetName || '未命名数据集' }}</h1>
            <div class="hero-meta">
            <span class="meta-pill">{{ getDatasetTypeLabel(datasetType) }}</span>
            <span class="meta-id">ID: {{ datasetId || '-' }}</span>
            </div>
        </div>
      </div>
      <div class="hero-right">
        <div class="stat-card">
          <div class="stat-label">图片数</div>
          <div class="stat-value">{{ formatImageCount(numImages) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">类别数</div>
          <div class="stat-value">{{ numClasses || 0 }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">大小</div>
          <div class="stat-value">{{ formatDatasetSize(datasetSize) }}</div>
        </div>
      </div>
    </header>

    <section class="detail-body glass-panel">
      <div v-if="detailLoading" class="loading-state">
        <i class="el-icon-loading"></i>
        <span>正在加载数据集详情...</span>
      </div>
      <template v-else>
        <div class="illegal-section">
          <div class="illegal-banner glass-panel warning-theme">
            <div class="illegal-icon">
              <i class="el-icon-warning"></i>
            </div>
            <div class="illegal-content">
              <div class="illegal-title">非法数据集 ({{ datasetType }})</div>
              <div class="illegal-desc" v-if="illegalReason === 'labelme_json'">检测到 LabelMe JSON 标注，请配置标签映射后进行转换</div>
              <div class="illegal-desc" v-else-if="illegalReason === 'unsupported_json'">检测到不支持的 JSON 格式，暂不支持转换</div>
              <div class="illegal-desc" v-else>检测到非 YOLO 标注，请配置标签映射后进行转换</div>
              <div v-if="conversionStatusText" class="illegal-badge">
                <span class="badge-dot"></span> 转换状态：{{ conversionStatusText }}
              </div>
              <div v-if="conversionError" class="illegal-error">
                <i class="el-icon-error"></i> {{ conversionError }}
              </div>
              <div v-if="showConversionProgress" class="conversion-progress">
                <div class="conversion-progress-row">
                  <div class="conversion-progress-label">
                    总进度：{{ conversionOverallProgress.processed }}/{{ conversionOverallProgress.total || '-' }}
                  </div>
                  <el-progress
                    :stroke-width="10"
                    :percentage="conversionOverallProgress.percent"
                    :show-text="true"
                  />
                </div>
                <div class="conversion-progress-row">
                  <div class="conversion-progress-label">
                    单图进度（{{ conversionPhaseLabel }}）：{{ conversionImageProgress.processed }}/{{ conversionImageProgress.total || '-' }}
                  </div>
                  <el-progress
                    :stroke-width="10"
                    :percentage="conversionImageProgress.percent"
                    :show-text="true"
                    status="success"
                  />
                </div>
                <div v-if="conversionRealtimeHint" class="conversion-reconnect-hint">
                  <i class="el-icon-loading"></i> {{ conversionRealtimeHint }}
                </div>
              </div>
            </div>
            <div class="illegal-actions" v-if="!conversionSupported">
              <el-button size="medium" disabled>暂不支持转换</el-button>
            </div>
          </div>

          <div
            v-if="conversionSupported && !(conversionStatus === 'queued' || conversionStatus === 'running')"
            class="preset-toolbar"
          >
            <div class="preset-toolbar-left">
              <el-select v-model="presetApplyMode" size="small" class="preset-mode-select">
                <el-option
                  v-for="opt in presetApplyOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-button
                size="small"
                :loading="mappingPresetsLoading"
                @click="applyPresetToCurrentMapping"
              >
                应用预设到当前映射
              </el-button>
              <el-button
                size="small"
                type="primary"
                plain
                @click="openPresetDialog"
              >
                预设映射表管理
              </el-button>
            </div>
            <div class="preset-toolbar-right">
              <span>检测: {{ presetDetectionCount }}</span>
              <span>分类: {{ presetClassificationCount }}</span>
              <span>更新时间: {{ presetUpdatedAtText }}</span>
            </div>
          </div>
          
          <LabelMappingPanel
            ref="labelMappingPanel"
            v-if="conversionSupported && !(conversionStatus === 'queued' || conversionStatus === 'running')"
            :labels="illegalLabels"
            :loading="loadingLabels"
            :saving="savingLabels"
            :converting="convertingDataset"
            @save="handleLabelMappingSave"
            @save-and-convert="handleSaveAndConvert"
          />

          <div v-if="isDatasetEmpty" class="empty-state">
            <div class="empty-content">
              <div class="empty-title">{{ emptyStateTitle }}</div>
              <div class="empty-desc">{{ emptyStateDesc }}</div>
              <div class="empty-tips">
                <span class="tip-item"><i class="el-icon-check"></i> 仅支持 .zip 文件</span>
                <span class="tip-item"><i class="el-icon-check"></i> 请保持文件夹结构</span>
              </div>
              <div v-if="zipUploading" class="empty-processing-tip">
                {{ emptyProcessingTip }}
              </div>
            </div>
            <div class="empty-action">
              <UploadZip
                :dataset-id="datasetId"
                :external-file.sync="zipUploadFile"
                :external-uploading.sync="zipUploading"
                :external-progress.sync="zipUploadProgress"
                @upload-success="handleUploadSuccess"
                @upload-fail="handleUploadFail"
              ></UploadZip>
              <el-button
                v-if="zipUploading"
                type="text"
                class="upload-reset-btn"
                @click="resetRecoveredZipUploadState"
              >
                清除当前处理状态
              </el-button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <el-dialog
      title="标签层级转换 (非法转标准)"
      :visible.sync="showConvertDialog"
      width="420px"
      :close-on-click-modal="!convertingDataset"
      :close-on-press-escape="!convertingDataset"
      :append-to-body="true"
      class="convert-dialog"
    >
      <div class="convert-body">
        <div class="convert-row">
          <label class="convert-label">标签策略</label>
          <el-radio-group v-model="convertForm.labelStrategy" size="small">
            <el-radio label="full">完整层级</el-radio>
            <el-radio label="leaf">叶子节点</el-radio>
            <el-radio label="root">根节点</el-radio>
            <el-radio label="level">指定层级</el-radio>
          </el-radio-group>
        </div>
        <div class="convert-row" v-if="convertForm.labelStrategy === 'level'">
          <label class="convert-label">取前N级</label>
          <el-input-number v-model="convertForm.labelLevel" :min="1" size="small"></el-input-number>
        </div>
        <div class="convert-hint">层级分隔符: {{ convertForm.labelSeparator }}</div>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button :disabled="convertingDataset" @click="showConvertDialog = false">取消</el-button>
        <el-button type="primary" :loading="convertingDataset" @click="submitConvert">开始转换</el-button>
      </div>
    </el-dialog>

    <el-dialog
      title="非法标签映射预设管理"
      :visible.sync="showPresetDialog"
      width="980px"
      :append-to-body="true"
      class="preset-dialog"
    >
      <div class="preset-dialog-toolbar">
        <div class="preset-dialog-stats">
          <span>检测映射 {{ presetDetectionCount }} 条</span>
          <span>分类映射 {{ presetClassificationCount }} 条</span>
          <span>更新时间 {{ presetUpdatedAtText }}</span>
        </div>
        <div class="preset-dialog-actions">
          <input
            ref="presetFileInput"
            type="file"
            accept=".xlsx,.xls"
            style="display: none;"
            @change="handlePresetFileChange"
          />
          <el-button size="small" @click="triggerPresetFileUpload">导入 XLSX</el-button>
          <el-button size="small" @click="addDetectionPresetRow">新增检测行</el-button>
          <el-button size="small" @click="addClassificationPresetRow">新增分类行</el-button>
        </div>
      </div>

      <el-tabs>
        <el-tab-pane :label="`检测映射 (${presetDetectionCount})`">
          <el-table :data="presetData.detection" border height="280" size="mini">
            <el-table-column label="原始标签路径" min-width="340">
              <template slot-scope="scope">
                <el-input v-model="scope.row.source_label" size="mini" placeholder="例如：A%B%C" />
              </template>
            </el-table-column>
            <el-table-column label="映射标签" min-width="200">
              <template slot-scope="scope">
                <el-input v-model="scope.row.target_label" size="mini" placeholder="例如：轿车" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template slot-scope="scope">
                <el-button type="text" size="mini" @click="removeDetectionPresetRow(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="`分类映射 (${presetClassificationCount})`">
          <el-table :data="presetData.classification" border height="280" size="mini">
            <el-table-column label="分类组" min-width="160">
              <template slot-scope="scope">
                <el-input v-model="scope.row.category" size="mini" placeholder="例如：小型车辆" />
              </template>
            </el-table-column>
            <el-table-column label="原始标签路径" min-width="280">
              <template slot-scope="scope">
                <el-input v-model="scope.row.source_label" size="mini" placeholder="例如：A%B%C" />
              </template>
            </el-table-column>
            <el-table-column label="映射标签(可选)" min-width="180">
              <template slot-scope="scope">
                <el-input v-model="scope.row.target_label" size="mini" placeholder="默认同分类组" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template slot-scope="scope">
                <el-button type="text" size="mini" @click="removeClassificationPresetRow(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>

      <div slot="footer" class="dialog-footer">
        <el-button :disabled="mappingPresetsSaving" @click="showPresetDialog = false">关闭</el-button>
        <el-button type="primary" :loading="mappingPresetsSaving" @click="savePresetDialogData">保存预设</el-button>
      </div>
    </el-dialog>

  </div>
</template>

<script>
import * as XLSX from 'xlsx';
import {
  fetchIllegalDataset,
  fetchIllegalDatasetLabels,
  updateIllegalDatasetLabels,
  fetchIllegalLabelPresets,
  saveIllegalLabelPresets,
  convertIllegalDataset,
  openIllegalConversionStream
} from '@/api/illegalDatasets';
import UploadZip from '@/components/Upload/index.vue';
import LabelMappingPanel from '@/components/LabelMappingPanel.vue';

export default {
  name: 'IllegalDatasetDetail',
  components: { UploadZip, LabelMappingPanel },
  data() {
    return {
      datasetId: '',
      datasetName: '',
      datasetType: '',
      numClasses: 0,
      numImages: 0,
      datasetSize: '',
      detailLoading: false,

      // Illegal state
      illegalReason: '',
      conversionStatus: '',
      conversionError: '',
      conversionOverallProgress: { total: 0, processed: 0, percent: 0 },
      conversionImageProgress: { total: 0, processed: 0, percent: 0 },
      conversionPhaseLabel: '处理中',
      conversionRealtimeHint: '',
      conversionStream: null,
      convertingDataset: false,
      showConvertDialog: false,
      convertForm: {
        labelStrategy: 'leaf',
        labelLevel: 2,
        labelSeparator: '%',
      },

      // ZIP Upload state
      zipUploadFile: null,
      zipUploading: false,
      zipUploadProgress: 0,
      
      // Labels state
      illegalLabels: [],
      loadingLabels: false,
      savingLabels: false,

      // Presets
      showPresetDialog: false,
      mappingPresetsLoading: false,
      mappingPresetsSaving: false,
      presetApplyMode: 'skip_existing',
      presetApplyOptions: [
        { label: '跳过已有映射（安全）', value: 'skip_existing' },
        { label: '覆盖当前映射（强制）', value: 'overwrite' }
      ],
      presetData: {
        detection: [],
        classification: [],
        updated_at: null,
      },
      presetDatasetId: null
    };
  },
  computed: {
    conversionSupported() {
      return this.illegalReason === 'labelme_json' || this.illegalReason === 'not_yolo' || this.illegalReason === 'other';
    },
    conversionStatusText() {
      const map = {
        'queued': '等待转换...',
        'running': '转换中...',
        'completed': '转换成功 (可前往标准数据集查看)',
        'failed': '转换失败'
      };
      return map[this.conversionStatus] || this.conversionStatus || '未开始';
    },
    showConversionProgress() {
      return this.conversionStatus === 'queued' || this.conversionStatus === 'running';
    },
    isDatasetEmpty() {
      return this.numImages === 0 && !this.showConversionProgress && this.conversionStatus !== 'completed';
    },
    emptyStateTitle() {
      if (this.zipUploadInterrupted) return "上传已中断";
      if (this.zipUploadRestored) return "发现未完成的上传";
      return "数据集为空";
    },
    emptyStateDesc() {
      if (this.zipUploadInterrupted) return "您可以刷新页面尝试恢复，或清除状态重新上传。";
      if (this.zipUploadRestored) return "是否继续上传此ZIP包？";
      return "请上传ZIP压缩包。包含图像和非YOLO格式的标注文件。";
    },
    emptyProcessingTip() {
      if (this.zipUploadProgress >= 100) return "正在服务器端解压并处理数据，这可能需要几分钟...";
      return `正在上传... ${this.zipUploadProgress}%`;
    },
    presetDetectionCount() { return this.presetData?.detection?.length || 0; },
    presetClassificationCount() { return this.presetData?.classification?.length || 0; },
    presetUpdatedAtText() {
      if (!this.presetData?.updated_at) return '从不';
      return new Date(this.presetData.updated_at).toLocaleString();
    }
  },
  methods: {
    goBack() {
      this.$router.push('/datasets');
    },
    formatImageCount(count) {
      if (!count) return '0';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
      return count.toString();
    },
    formatDatasetSize(sizeStr) {
      if (!sizeStr) return '0MB';
      if (typeof sizeStr === 'string' && sizeStr.includes('MB')) return sizeStr;
      if (typeof sizeStr === 'number') return sizeStr.toFixed(1) + 'MB';
      return sizeStr;
    },
    getDatasetTypeLabel(type) {
      const map = { 'detection': '目标检测', 'segmentation': '图像分割', 'classification': '图像分类' };
      return map[type] || type || '未知';
    },
    async loadDetail() {
      try {
        this.detailLoading = true;
        const data = await fetchIllegalDataset(this.datasetId);
        if (!data) throw new Error("Dataset not found");
        
        this.datasetName = data.dataset_name;
        this.datasetType = data.dataset_type;
        this.numClasses = data.num_classes || 0;
        this.numImages = data.num_images || 0;
        this.datasetSize = data.dataset_size_mb || '0MB';
        
        this.illegalReason = data.illegal_reason || 'other';
        this.conversionStatus = data.conversion_status || 'idle';
        this.conversionError = data.conversion_error || '';

        // If running, open stream
        if (this.conversionStatus === 'queued' || this.conversionStatus === 'running') {
            this.listenToConversionStream();
        }

        // Load labels
        if (this.conversionSupported && this.numImages > 0) {
            this.loadLabels();
        }
      } catch (e) {
        this.$message.error("Failed to load illegal dataset details: " + e.message);
      } finally {
        this.detailLoading = false;
      }
    },
    async loadLabels() {
      try {
        this.loadingLabels = true;
        const res = await fetchIllegalDatasetLabels(this.datasetId);
        this.illegalLabels = res.labels || [];
      } catch (e) {
        this.$message.error("Failed to load labels: " + e.message);
      } finally {
        this.loadingLabels = false;
      }
    },
    async handleLabelMappingSave(mappedLabels) {
      if (this.savingLabels) return;
      try {
        this.savingLabels = true;
        await updateIllegalDatasetLabels(this.datasetId, { labels: mappedLabels });
        this.illegalLabels = mappedLabels;
        this.$message.success("标签映射保存成功");
      } catch (e) {
        this.$message.error("标签映射保存失败: " + e.message);
      } finally {
        this.savingLabels = false;
      }
    },
    async handleSaveAndConvert(mappedLabels) {
      await this.handleLabelMappingSave(mappedLabels);
      this.showConvertDialog = true;
    },
    async submitConvert() {
      try {
        this.convertingDataset = true;
        await convertIllegalDataset(this.datasetId, this.convertForm);
        this.showConvertDialog = false;
        this.$message.success("已提交转换任务");
        this.loadDetail();
      } catch (e) {
        this.$message.error("提交转换任务失败: " + e.message);
      } finally {
        this.convertingDataset = false;
      }
    },
    listenToConversionStream() {
      if (this.conversionStream) return;
      let reconnectAttempts = 0;
      const MAX_RECONNECT = 5;
      
      const connect = () => {
        this.conversionRealtimeHint = "正在连接转换流...";
        this.conversionStream = openIllegalConversionStream(this.datasetId, {
          onMessage: (data) => {
            reconnectAttempts = 0;
            this.conversionRealtimeHint = "";
            this.conversionStatus = data.status || this.conversionStatus;
            
            if (data.overall_progress) {
                this.conversionOverallProgress = data.overall_progress;
            }
            if (data.image_progress) {
                this.conversionImageProgress = data.image_progress;
            }
            if (data.phase_label) {
                this.conversionPhaseLabel = data.phase_label;
            }

            if (data.status === 'completed' || data.status === 'failed') {
                this.conversionError = data.error || '';
                if (this.conversionStream) {
                    this.conversionStream.close();
                    this.conversionStream = null;
                }
                setTimeout(() => this.loadDetail(), 1000);
            }
          },
          onError: (e) => {
             console.error("Stream error", e);
             this.conversionRealtimeHint = "流连接错误，尝试重连...";
             if (this.conversionStream) this.conversionStream.close();
             this.conversionStream = null;
             
             if (this.conversionStatus === 'running' || this.conversionStatus === 'queued') {
                reconnectAttempts++;
                if (reconnectAttempts <= MAX_RECONNECT) {
                    setTimeout(connect, 2000 * reconnectAttempts);
                } else {
                    this.conversionRealtimeHint = "实时连接丢失，请刷新页面查看进度";
                }
             }
          },
          onClose: () => {
             if (this.conversionStatus === 'running' || this.conversionStatus === 'queued') {
                reconnectAttempts++;
                if (reconnectAttempts <= MAX_RECONNECT) {
                    setTimeout(connect, 2000 * reconnectAttempts);
                }
             }
          }
        });
      };
      
      connect();
    },
    handleUploadSuccess() {
      this.zipUploading = false;
      this.zipUploadProgress = 0;
      this.zipUploadFile = null;
      this.$message.success("上传并解压成功，数据已入库！");
      this.loadDetail();
    },
    handleUploadFail(err) {
      this.zipUploading = false;
      this.zipUploadProgress = 0;
      this.zipUploadFile = null;
      this.$message.error("上传失败：" + (err.message || String(err)));
      this.loadDetail();
    },
    resetRecoveredZipUploadState() {
      this.zipUploadFile = null;
      this.zipUploading = false;
      this.zipUploadProgress = 0;
      this.$message.info("已清除未完成的上传状态。");
    },
    
    // Preset Methods
    async openPresetDialog() {
      try {
        this.mappingPresetsLoading = true;
        const res = await fetchIllegalLabelPresets(this.datasetId);
        this.presetData = {
           detection: Array.isArray(res.detection) ? res.detection : [],
           classification: Array.isArray(res.classification) ? res.classification : [],
           updated_at: res.updated_at
        };
        this.presetDatasetId = this.datasetId;
        this.showPresetDialog = true;
      } catch (e) {
        this.$message.error("加载预设失败: " + e.message);
      } finally {
        this.mappingPresetsLoading = false;
      }
    },
    async savePresetDialogData() {
      try {
        this.mappingPresetsSaving = true;
        const payload = {
            detection: this.presetData.detection.filter(d => d.source_label),
            classification: this.presetData.classification.filter(c => c.category && c.source_label)
        };
        const res = await saveIllegalLabelPresets(this.presetDatasetId, payload);
        this.presetData.updated_at = res.updated_at;
        this.$message.success("预设保存成功");
        this.showPresetDialog = false;
      } catch (e) {
        this.$message.error("保存预设失败: " + e.message);
      } finally {
        this.mappingPresetsSaving = false;
      }
    },
    addDetectionPresetRow() {
        this.presetData.detection.push({ source_label: '', target_label: '' });
    },
    removeDetectionPresetRow(index) {
        this.presetData.detection.splice(index, 1);
    },
    addClassificationPresetRow() {
        this.presetData.classification.push({ category: '', source_label: '', target_label: '' });
    },
    removeClassificationPresetRow(index) {
        this.presetData.classification.splice(index, 1);
    },
    triggerPresetFileUpload() {
        if (this.$refs.presetFileInput) {
            this.$refs.presetFileInput.value = '';
            this.$refs.presetFileInput.click();
        }
    },
    handlePresetFileChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const detSheetName = workbook.SheetNames.find(n => n.includes('检测') || n.toLowerCase().includes('detection'));
                if (detSheetName) {
                    const detSheet = workbook.Sheets[detSheetName];
                    const detData = XLSX.utils.sheet_to_json(detSheet, { header: 1 });
                    const parsedDet = [];
                    for (let i = 1; i < detData.length; i++) {
                        const row = detData[i];
                        if (row[0]) {
                            parsedDet.push({ source_label: String(row[0]), target_label: String(row[1] || '') });
                        }
                    }
                    if (parsedDet.length) {
                        this.presetData.detection = parsedDet;
                    }
                }
                
                const clsSheetName = workbook.SheetNames.find(n => n.includes('分类') || n.toLowerCase().includes('classification'));
                if (clsSheetName) {
                    const clsSheet = workbook.Sheets[clsSheetName];
                    const clsData = XLSX.utils.sheet_to_json(clsSheet, { header: 1 });
                    const parsedCls = [];
                    for (let i = 1; i < clsData.length; i++) {
                        const row = clsData[i];
                        if (row[0] && row[1]) {
                            parsedCls.push({ category: String(row[0]), source_label: String(row[1]), target_label: String(row[2] || '') });
                        }
                    }
                    if (parsedCls.length) {
                        this.presetData.classification = parsedCls;
                    }
                }
                this.$message.success("成功导入 Excel 解析预设内容");
            } catch (err) {
                this.$message.error("解析 Excel 失败: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    },
    async applyPresetToCurrentMapping() {
        if (!this.$refs.labelMappingPanel) return;
        try {
            this.mappingPresetsLoading = true;
            const res = await fetchIllegalLabelPresets(this.datasetId);
            const appliedCount = this.$refs.labelMappingPanel.applyPresets(res, this.presetApplyMode);
            this.$message.success(`应用预设成功，共更新 ${appliedCount} 条映射（请手动点击保存生效）`);
        } catch (e) {
            this.$message.error("应用预设失败: " + e.message);
        } finally {
            this.mappingPresetsLoading = false;
        }
    }
  },
  mounted() {
    this.datasetId = this.$route.query.id;
    if (this.datasetId) {
        this.loadDetail();
    } else {
        this.$message.error("未找到数据集ID");
    }
  },
  beforeDestroy() {
    if (this.conversionStream) {
        this.conversionStream.close();
        this.conversionStream = null;
    }
  }
};
</script>

<style scoped>
.dataset-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Hero Section */
.detail-hero {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.hero-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.back-link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--color-primary);
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero-kicker {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
  font-weight: 700;
}

.hero-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  line-height: 1.2;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.meta-pill {
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.meta-id {
  font-size: 0.85rem;
  color: var(--text-light);
  font-family: monospace;
}

.hero-right {
  display: flex;
  gap: 24px;
}

.stat-card {
  text-align: center;
  background: var(--bg-body);
  padding: 16px 24px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  min-width: 100px;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
}

.detail-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.loading-state i {
  font-size: 2rem;
  color: var(--color-primary);
}

.illegal-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
}

.illegal-banner {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px;
  border-left: 4px solid var(--color-warning);
}

.illegal-icon {
  font-size: 2rem;
  color: var(--color-warning);
}

.illegal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.illegal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.illegal-desc {
  color: var(--text-secondary);
  line-height: 1.5;
}

.illegal-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 500;
  margin-top: 4px;
  width: fit-content;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.illegal-error {
  color: var(--color-danger);
  font-size: 0.9rem;
  margin-top: 4px;
}

.conversion-progress {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--bg-body);
  padding: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.conversion-progress-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversion-progress-label {
  font-size: 0.85rem;
  color: var(--text-main);
  font-weight: 500;
}

.conversion-reconnect-hint {
  font-size: 0.85rem;
  color: var(--color-warning);
  display: flex;
  align-items: center;
  gap: 6px;
}

.illegal-actions {
  display: flex;
  align-items: center;
}

.preset-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preset-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.preset-mode-select {
  width: 200px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  background: var(--bg-body);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border-color);
  gap: 32px;
}

.empty-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
}

.empty-desc {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

.empty-tips {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 8px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--color-success);
  background: var(--color-success-light);
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

.empty-processing-tip {
  margin-top: 16px;
  font-weight: 600;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-action {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-reset-btn {
  font-size: 0.85rem;
}

.convert-dialog ::v-deep .el-dialog__body {
  padding: 24px;
}

.convert-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.convert-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.convert-label {
  font-weight: 600;
  color: var(--text-main);
  width: 70px;
}

.convert-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 8px;
  padding: 8px;
  background: var(--bg-body);
  border-radius: var(--radius-sm);
}

.preset-dialog-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.preset-dialog-stats {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.preset-dialog-actions {
  display: flex;
  gap: 8px;
}
</style>
