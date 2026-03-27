<template>
  <div class="dataset-detail-page page-container">
    <header class="detail-hero">
      <div class="hero-left">
        <button class="back-link" type="button" @click="goBack">
          <i class="el-icon-arrow-left"></i> 返回数据集列表
        </button>
        <div class="hero-content">
            <div class="hero-kicker">数据集概览</div>
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
        <div v-if="isIllegalDataset" class="illegal-section">
          <div class="illegal-banner glass-panel warning-theme">
            <div class="illegal-icon">
              <i class="el-icon-warning"></i>
            </div>
            <div class="illegal-content">
              <div class="illegal-title">非法数据集</div>
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

          <!-- Inline Label Mapping Panel -->
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
        </div>

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

        <div v-else-if="!isIllegalDataset" class="gallery-layout">
          <aside class="sidebar-panel glass-panel-sm">
            <div class="panel-head">
              <div class="panel-title">类别</div>
              <div class="panel-sub">按类别筛选图片 · 双击编辑名称</div>
            </div>
            
            <div class="search-box">
              <el-input
                v-model="input"
                placeholder="搜索类别..."
                prefix-icon="el-icon-search"
                class="glass-input"
                clearable
                @input="handleSearchInput"
                @clear="clearSearch"
              ></el-input>
            </div>

            <ul class="class-list" v-if="filteredClassList.length || !input.trim()">
              <li
                class="all-option"
                :class="{ 'selected': selectedClass === null }"
                @click="selectClass(null)"
              >
                <div class="class-info">
                    <span class="dot all"></span>
                    <span class="class-name">全部类别</span>
                </div>
                <span class="class-count">{{ datasetDetail ? datasetDetail.total_images : 0 }}</span>
              </li>
              <li
                v-for="(classInfo, idx) in filteredClassList"
                :key="getClassId(classInfo, idx)"
                :class="{ 'selected': isSelectedClass(classInfo) }"
                @click="selectClass(classInfo)"
                @dblclick.stop="startEditClass(classInfo, idx)"
              >
                <template v-if="editingClassIdx === idx">
                  <div class="class-info editing">
                    <span class="dot"></span>
                    <input
                      ref="classEditInput"
                      v-model="editingClassName"
                      class="class-edit-input"
                      :class="{ 'is-saving': renameSaving }"
                      :disabled="renameSaving"
                      @click.stop
                      @keyup.enter="confirmEditClass(classInfo)"
                      @keyup.esc="cancelEditClass"
                      @blur="confirmEditClass(classInfo)"
                    />
                  </div>
                  <span v-if="renameSaving" class="class-edit-status"><i class="el-icon-loading"></i></span>
                  <span v-else class="class-edit-actions" @click.stop>
                    <i class="el-icon-check class-edit-btn confirm" @click="confirmEditClass(classInfo)"></i>
                    <i class="el-icon-close class-edit-btn cancel" @click="cancelEditClass"></i>
                  </span>
                </template>
                <template v-else>
                  <div class="class-info">
                    <span class="dot"></span>
                    <span class="class-name" v-html="input.trim() ? highlightText(getClassName(classInfo), input) : getClassName(classInfo)"></span>
                  </div>
                  <span class="class-count">{{ classInfo && classInfo.image_count ? classInfo.image_count : 0 }}</span>
                </template>
              </li>
            </ul>
            <div v-else class="no-results">
              <div class="no-desc">未找到类别 "{{ input }}"</div>
              <el-button type="text" @click="clearSearch">清除搜索 box</el-button>
            </div>
          </aside>

          <main class="images-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">图片列表 <span class="count-badge">{{ selectedImages.length }}</span></div>
                <div v-if="viewStatusText" class="panel-subtitle">{{ viewStatusText }}</div>
              </div>
              <div v-if="showPanelActions" class="panel-actions">
                <el-button
                  v-if="showSplitButton"
                  size="small"
                  type="primary"
                  plain
                  :loading="splitSubmitting"
                  @click="openSplitDialog"
                >
                  数据集划分
                </el-button>
                <el-button
                  v-if="showAugmentationButton"
                  size="small"
                  type="success"
                  plain
                  @click="openAugmentationDialog"
                >
                  <i class="el-icon-magic-stick"></i> 样本扩增
                </el-button>
                <div v-if="allowAppendUpload" class="action-card">
                    <el-select
                      v-model="selectedVersionId"
                      placeholder="版本"
                      class="card-select"
                      size="small"
                      :loading="versionLoading"
                      :disabled="versionOptions.length === 0"
                      @change="handleVersionChange"
                    >
                      <el-option
                        v-for="item in versionOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value">
                      </el-option>
                    </el-select>
                    <div class="action-divider"></div>
                    <div class="card-btn" :class="{ 'is-loading': isUploading }" @click="handleAddImage">
                      <i :class="isUploading ? 'el-icon-loading' : 'el-icon-plus'"></i> {{ isUploading ? '上传中' : '添加' }}
                    </div>
                </div>
                <input
                  v-if="allowAppendUpload"
                  ref="imageFileInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none;"
                  @change="handleFilesSelected"
                />
              </div>
            </div>
            
            <div v-if="selectedImages.length === 0" class="no-images">
              <i class="el-icon-picture-outline"></i>
              <span>暂无图片显示</span>
            </div>
            <div v-else class="image-grid">
                <div
                class="image-card"
                v-for="(image, index) in selectedImages"
                :key="`${image.image_name}-${index}`"
                @click="openImagePreview(image)"
                >
                <div class="image-wrapper">
                    <img
                    :src="image.thumbnail_url || image.image_url"
                    :alt="image.image_name"
                    loading="lazy"
                    @error="handleImageError($event, image)"
                    />
                </div>
                <div class="image-overlay">
                    <div class="image-name">{{ image.image_name }}</div>
                    <div class="image-meta">{{ image.objects_count }} 个对象</div>
                </div>
                </div>
            </div>
          </main>
        </div>
      </template>
    </section>

    <!-- Preview Modal -->
    <div v-if="showImagePreview" class="preview-modal" @click="closeImagePreview">
      <div class="modal-card glass-panel" @click.stop>
        <button class="close-btn" @click="closeImagePreview"><i class="el-icon-close"></i></button>
        <div class="modal-image-wrapper">
          <div ref="previewCanvasWrap" class="modal-canvas-wrap">
            <img
            ref="previewModalImage"
            :src="previewImage.image_url"
            :alt="previewImage.image_name"
            class="modal-image"
            @load="handlePreviewImageLoad"
            @error="handleModalImageError"
            />
            <canvas ref="previewCanvas" class="modal-overlay-canvas"></canvas>
          </div>
        </div>
        <div class="modal-info">
          <h3>{{ previewImage.image_name }}</h3>
          <div class="modal-meta-row">
              <span class="label">对象数:</span> 
              <span class="value">{{ previewImage.objects_count }}</span>
          </div>
          <div class="modal-meta-row" v-if="previewImage.classes_in_image?.length">
            <span class="label">包含类别:</span>
            <span class="value">{{ getClassNames(previewImage.classes_in_image) }}</span>
          </div>
          <div class="modal-meta-row" v-if="isDetectionDataset">
            <span class="label">标注显示:</span>
            <span class="value" v-if="previewAnnotationsLoading">加载中...</span>
            <span class="value error" v-else-if="previewAnnotationsError">{{ previewAnnotationsError }}</span>
            <span class="value" v-else-if="previewBoxCount > 0">已显示 {{ previewBoxCount }} 个标注框</span>
            <span class="value muted" v-else>无标注 / 负样本</span>
          </div>
        </div>
      </div>
    </div>



    <el-dialog
      title="标签层级转换"
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

    <el-dialog
      title="数据集划分"
      :visible.sync="showSplitDialog"
      width="420px"
      :close-on-click-modal="!splitSubmitting"
      :close-on-press-escape="!splitSubmitting"
      :append-to-body="true"
      class="split-dialog"
    >
      <div class="split-body">
        <div class="convert-row">
          <label class="convert-label">训练</label>
          <el-input-number v-model="splitForm.train" :min="1" :max="98" size="small"></el-input-number>
          <span class="split-suffix">%</span>
        </div>
        <div class="convert-row">
          <label class="convert-label">验证</label>
          <el-input-number v-model="splitForm.val" :min="1" :max="98" size="small"></el-input-number>
          <span class="split-suffix">%</span>
        </div>
        <div class="convert-row">
          <label class="convert-label">测试</label>
          <el-input-number v-model="splitForm.test" :min="1" :max="98" size="small"></el-input-number>
          <span class="split-suffix">%</span>
        </div>
        <div class="split-sum" :class="{ invalid: !splitValid }">总和：{{ splitSum }}%</div>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button :disabled="splitSubmitting" @click="showSplitDialog = false">取消</el-button>
        <el-button type="primary" :loading="splitSubmitting" :disabled="!splitValid" @click="submitSplit">开始划分</el-button>
      </div>
    </el-dialog>

    <el-dialog
      title="样本扩增"
      :visible.sync="showAugmentationDialog"
      width="1000px"
      :append-to-body="true"
      class="augmentation-dialog preview-enabled"
    >
      <ManualAugmentationPanel
        v-if="showAugmentationDialog"
        :dataset-id="datasetId"
        :default-version-id="selectedVersionId"
        :version-options="versionOptions"
        @published="handleAugmentationPublished"
      />
    </el-dialog>

    <!-- Upload Dialog -->
    <el-dialog
      v-if="allowAppendUpload"
      title="添加图片和标注"
      :visible="showUploadDialog"
      @close="handleDialogClose"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!isUploading"
      :show-close="!isUploading"
      :append-to-body="true"
      class="upload-dialog"
    >
      <!-- Upload Mode Switcher -->
      <div class="upload-mode-switcher">
        <el-radio-group v-model="uploadMode" size="small">
          <el-radio-button label="files">单文件上传</el-radio-button>
          <el-radio-button label="zip">ZIP包上传</el-radio-button>
        </el-radio-group>
      </div>

      <!-- Files Upload Mode -->
      <div class="upload-sections" v-if="uploadMode === 'files'">
        <!-- Images Section -->
        <div class="upload-section">
          <div class="section-header">
            <span class="section-title">图片文件</span>
            <span class="section-count" v-if="pendingImages.length">{{ pendingImages.length }} 个文件</span>
          </div>
          <div 
            class="file-drop-area" 
            :class="{ 'drag-over': imageDragOver }"
            @click="$refs.dialogImageInput.click()"
            @dragover.prevent="imageDragOver = true"
            @dragleave.prevent="imageDragOver = false"
            @drop.prevent="onImagesDrop"
          >
            <i class="el-icon-picture-outline"></i>
            <span>点击或拖拽图片文件到此处</span>
            <span class="hint">支持 jpg, png, webp 等格式</span>
          </div>
          <div class="file-list" v-if="pendingImages.length">
            <div class="file-item" v-for="(file, idx) in pendingImages.slice(0, 5)" :key="'img-' + idx">
              <i class="el-icon-picture"></i>
              <span class="file-name">{{ file.name }}</span>
              <i class="el-icon-close remove-btn" @click.stop="removeImage(idx)"></i>
            </div>
            <div class="file-item more" v-if="pendingImages.length > 5">
              <span>... 还有 {{ pendingImages.length - 5 }} 个文件</span>
            </div>
          </div>
          <input
            ref="dialogImageInput"
            type="file"
            accept="image/*"
            multiple
            style="display: none;"
            @change="onDialogImagesSelected"
          />
        </div>

        <!-- Labels Section -->
        <div class="upload-section">
          <div class="section-header">
            <span class="section-title">标注文件</span>
            <span class="section-count" v-if="pendingLabels.length">{{ pendingLabels.length }} 个文件</span>
          </div>
          <div 
            class="file-drop-area" 
            :class="{ 'drag-over': labelDragOver }"
            @click="$refs.dialogLabelInput.click()"
            @dragover.prevent="labelDragOver = true"
            @dragleave.prevent="labelDragOver = false"
            @drop.prevent="onLabelsDrop"
          >
            <i class="el-icon-document"></i>
            <span>点击或拖拽标注文件到此处</span>
            <span class="hint">支持 txt, xml, json 等格式</span>
          </div>
          <div class="file-list" v-if="pendingLabels.length">
            <div class="file-item" v-for="(file, idx) in pendingLabels.slice(0, 5)" :key="'lbl-' + idx">
              <i class="el-icon-document"></i>
              <span class="file-name">{{ file.name }}</span>
              <i class="el-icon-close remove-btn" @click.stop="removeLabel(idx)"></i>
            </div>
            <div class="file-item more" v-if="pendingLabels.length > 5">
              <span>... 还有 {{ pendingLabels.length - 5 }} 个文件</span>
            </div>
          </div>
          <input
            ref="dialogLabelInput"
            type="file"
            accept=".txt,.xml,.json"
            multiple
            style="display: none;"
            @change="onDialogLabelsSelected"
          />
        </div>
      </div>

      <!-- ZIP Upload Mode -->
      <div class="upload-sections" v-else>
        <div class="upload-section zip-section">
          <div class="section-header">
            <span class="section-title">ZIP压缩包</span>
            <span class="section-count" v-if="pendingZipFile">已选择</span>
          </div>
          <div 
            class="file-drop-area zip-drop-area" 
            :class="{ 'drag-over': zipDragOver, 'has-file': pendingZipFile }"
            @click="$refs.dialogZipInput.click()"
            @dragover.prevent="zipDragOver = true"
            @dragleave.prevent="zipDragOver = false"
            @drop.prevent="onZipDrop"
          >
            <template v-if="!pendingZipFile">
              <i class="el-icon-folder-opened"></i>
              <span>点击或拖拽ZIP文件到此处</span>
              <span class="hint">压缩包应包含 images、labels 文件夹</span>
            </template>
            <template v-else>
              <i class="el-icon-document-checked"></i>
              <span class="zip-file-name">{{ pendingZipFile.name }}</span>
              <span class="zip-file-size">{{ formatFileSize(pendingZipFile.size) }}</span>
              <i class="el-icon-close remove-zip-btn" @click.stop="removeZipFile"></i>
            </template>
          </div>
          <div class="zip-structure-hint">
            <div class="hint-title">推荐的压缩包结构：</div>
            <pre class="hint-tree">├── images/
│   ├── image1.jpg
│   └── image2.jpg
├── labels/
│   ├── image1.txt
│   └── image2.txt
└── classnames.txt (可选)</pre>
          </div>
          <input
            ref="dialogZipInput"
            type="file"
            accept=".zip"
            style="display: none;"
            @change="onDialogZipSelected"
          />
        </div>
      </div>

      <div v-if="isUploading" class="upload-progress">
        <el-progress :percentage="uploadPercent" :stroke-width="8"></el-progress>
        <div class="upload-progress-meta">
          <span class="stage">{{ uploadStage === 'processing' ? '服务器处理中...' : '上传中...' }}</span>
          <span class="bytes" v-if="uploadTotal">{{ formatFileSize(uploadLoaded) }} / {{ formatFileSize(uploadTotal) }}</span>
          <span class="files">
            {{ uploadMode === 'files'
              ? `文件: ${pendingImages.length + pendingLabels.length}`
              : '文件: 1' }}
          </span>
        </div>
      </div>

      <div slot="footer" class="dialog-footer">
        <el-button :disabled="isUploading" @click="closeUploadDialog">取消</el-button>
        <el-button v-if="isUploading" type="danger" plain @click="cancelUpload">取消上传</el-button>
        <el-button
          v-else
          type="primary"
          :disabled="uploadMode === 'files' ? pendingImages.length === 0 : !pendingZipFile"
          @click="uploadMode === 'files' ? submitUpload() : submitZipUpload()"
        >
          上传
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import {
  buildDatasetThumbnailApiUrl,
  FetchDatasetDetail,
  FetchDatasetView,
  fetchDatasetImageAnnotations,
  fetchDatasetVersions,
  uploadDatasetImages,
  appendDatasetArchive,
  convertIllegalDataset,
  openIllegalConversionStream,
  fetchDatasetSplitSummary,
  splitDataset,
  fetchIllegalDatasetLabels,
  updateIllegalDatasetLabels,
  fetchIllegalLabelPresets,
  saveIllegalLabelPresets,
  renameDatasetClasses,
} from '@/api/datasets';
import UploadZip from '@/components/Upload/index.vue';
import LabelMappingPanel from '@/components/LabelMappingPanel.vue';
import ManualAugmentationPanel from '@/views/Datasets/components/ManualAugmentationPanel.vue';
export default {
    name: 'DataDetail',
    components: { UploadZip, LabelMappingPanel, ManualAugmentationPanel },
    data() {
        return {
            datasetId: '',
            datasetName: '',
            datasetType: '',
            numClasses: 0,
            numImages: 0,
            datasetSize: '',
            datasetDetail: null,
            detailLoading: false,
            input: '',
            selectedClass: null,
            selectedImages: [],
            showImagePreview: false,
            previewImage: null,
            previewAnnotationsLoading: false,
            previewAnnotationsError: '',
            previewAnnotationData: null,
            previewRequestToken: 0,
            viewRequestToken: 0,
            viewStatusRetryTimer: null,
            viewStatusRetryCount: 0,
            searchTimeout: null,
            debouncedSearch: null,
            selectedVersionId: null,
            versionOptions: [],
            versionLoading: false,
            allowAppendUpload: false,
            isUploading: false,
            uploadPercent: 0,
            uploadLoaded: 0,
            uploadTotal: 0,
            uploadStage: 'idle', // idle | uploading | processing
            cancelUploadRequest: null,
            showUploadDialog: false,
            pendingImages: [],
            pendingLabels: [],
            imageDragOver: false,
            labelDragOver: false,
            // ZIP上传相关
            uploadMode: 'files',
            pendingZipFile: null,
            zipDragOver: false,

            zipUploadFile: null,
            zipUploading: false,
            zipUploadProgress: 0,
            zipUploadRestored: false,
            zipUploadInterrupted: false,
            zipUploadPollTimer: null,
            zipUploadPollAttempts: 0,
            // Illegal dataset conversion
            showConvertDialog: false,
            convertingDataset: false,
            conversionStream: null,
            conversionStreamJobId: '',
            conversionStreamHint: '',
            convertForm: {
                labelStrategy: 'leaf',
                labelLevel: 2,
                labelSeparator: '%',
            },
            sliceParams: null,
            showSplitDialog: false,
            showAugmentationDialog: false,
            splitSubmitting: false,
            splitSummary: null,
            splitLoading: false,
            splitForm: {
                train: 90,
                val: 7,
                test: 3,
            },

            // 标签映射相关
            loadingLabels: false,
            savingLabels: false,
            illegalLabels: [],
            hasSavedMapping: false,
            savedLabelMapping: null,
            mappingPresetsLoading: false,
            mappingPresetsSaving: false,
            showPresetDialog: false,
            presetApplyMode: 'detection',
            presetData: {
              detection: [],
              classification: [],
              updated_at: null,
            },

            // 类别重命名
            editingClassIdx: null,
            editingClassName: '',
            renameSaving: false,
        }
    },
    mounted() {
        document.addEventListener('keydown', this.handleKeydown);
        window.addEventListener('resize', this.handlePreviewResize);
        this.debouncedSearch = this.debounce(() => {}, 300);
    },
    activated() {
        // 从缓存中激活时，如果正在上传则保持对话框打开
        if (this.isUploading && !this.showUploadDialog) {
            this.showUploadDialog = true;
        }
    },
    deactivated() {
        // 组件被缓存时，不做任何清理，保持上传状态
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('resize', this.handlePreviewResize);
        this.clearZipUploadPolling();
        this.clearPendingViewRefresh();
        this.stopConversionStream();
    },
    computed: {
        classList() {
            // Use categories from view API (class_id, name, count format)
            if (!this.datasetDetail || !this.datasetDetail.categories) return [];
            // Map to legacy format for compatibility with template
            return this.datasetDetail.categories.map(cat => ({
                class_id: cat.class_id,
                class_name: cat.name,
                image_count: cat.count,
            }));
        },
        imagesList() {
            if (!this.datasetDetail || !this.datasetDetail.images) return [];
            return this.datasetDetail.images;
        },
        filteredClassList() {
            if (!this.input.trim()) return this.classList;
            return this.classList.filter(cls =>
                cls.class_name.toLowerCase().includes(this.input.toLowerCase())
            );
        },
        isDatasetEmpty() {
            if (!this.datasetDetail) return false;
            const total = Number(this.datasetDetail.total_images ?? this.datasetDetail.num_images ?? this.imagesList.length ?? 0) || 0;
            return total === 0;
        },
        emptyStateTitle() {
            if (this.zipUploadInterrupted) {
                return '上传已中断';
            }
            return this.zipUploading ? '数据集处理中' : '数据集为空';
        },
        emptyStateDesc() {
            if (this.zipUploading) {
                return '检测到上传后的后端处理仍在进行中，请耐心等待，页面会自动刷新结果。';
            }
            if (this.zipUploadInterrupted) {
                return '上次上传在页面刷新时已中断，当前无法继续续传，请重新选择 ZIP 文件上传。';
            }
            return '上传 ZIP 文件以初始化此数据集。';
        },
        emptyProcessingTip() {
            if ((Number(this.zipUploadProgress || 0) || 0) >= 100 || this.zipUploadRestored) {
                return '检测到该数据集有未完成的上传任务，已自动恢复处理状态并持续轮询后端结果。';
            }
            return 'ZIP 文件正在上传中，请勿刷新或离开页面。';
        },
        isIllegalDataset() {
            const ver = this.datasetDetail && this.datasetDetail.active_version;
            const meta = ver && ver.meta;
            return !!(ver && ver.status === 'failed' && meta && meta.illegal);
        },
        isDetectionDataset() {
            return String(this.datasetType || '').toLowerCase() === 'detection';
        },
        illegalReason() {
            const ver = this.datasetDetail && this.datasetDetail.active_version;
            const meta = ver && ver.meta;
            return meta && meta.illegal_reason ? String(meta.illegal_reason) : '';
        },
        conversionMeta() {
            const ver = this.datasetDetail && this.datasetDetail.active_version;
            const meta = ver && ver.meta;
            const conv = meta && meta.conversion;
            return conv && typeof conv === 'object' ? conv : null;
        },
        conversionJobId() {
            const conv = this.conversionMeta;
            return conv && conv.job_id ? String(conv.job_id) : '';
        },
        conversionStatus() {
            const conv = this.conversionMeta;
            return conv ? (conv.status || '') : '';
        },
        conversionSupported() {
            const ver = this.datasetDetail && this.datasetDetail.active_version;
            const meta = ver && ver.meta;
            const conv = meta && meta.conversion;
            if (conv && typeof conv.supported === 'boolean') {
                return conv.supported;
            }
            return this.illegalReason === 'labelme_json';
        },
        presetApplyOptions() {
            return [
              { value: 'detection', label: '检测映射预设' },
              { value: 'classification', label: '分类映射预设' },
            ];
        },
        presetDetectionCount() {
            return Array.isArray(this.presetData && this.presetData.detection) ? this.presetData.detection.length : 0;
        },
        presetClassificationCount() {
            return Array.isArray(this.presetData && this.presetData.classification) ? this.presetData.classification.length : 0;
        },
        presetUpdatedAtText() {
            const raw = this.presetData && this.presetData.updated_at;
            if (!raw) return '未保存';
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return String(raw);
            return d.toLocaleString();
        },
        splitSum() {
            const t = Number(this.splitForm.train) || 0;
            const v = Number(this.splitForm.val) || 0;
            const s = Number(this.splitForm.test) || 0;
            return Math.round((t + v + s) * 100) / 100;
        },
        splitValid() {
            return Math.abs(this.splitSum - 100) < 0.0001;
        },
        hasSplit() {
            const s = this.splitSummary;
            if (!s) return false;
            const total = (Number(s.train_count) || 0) + (Number(s.val_count) || 0) + (Number(s.test_count) || 0);
            return total > 0;
        },
        showSplitButton() {
            if (!this.isDetectionDataset) return false;
            if (this.isIllegalDataset || this.isDatasetEmpty) return false;
            if (this.splitSummary && this.hasSplit) return false;
            return true;
        },
        showAugmentationButton() {
            if (!this.isDetectionDataset) return false;
            if (this.isIllegalDataset || this.isDatasetEmpty) return false;
            return true;
        },
        showPanelActions() {
            return this.showSplitButton || this.showAugmentationButton || this.allowAppendUpload;
        },
        currentViewMeta() {
            return this.datasetDetail && this.datasetDetail.view_meta ? this.datasetDetail.view_meta : null;
        },
        viewStatusText() {
            const meta = this.currentViewMeta;
            if (!meta || this.selectedClass) return '';
            const thumbStatus = String(meta.thumbnail_status || '').toLowerCase();
            const indexStatus = String(meta.view_index_status || '').toLowerCase();
            const thumbProgress = Number(meta.thumbnail_progress);
            if (indexStatus === 'running' || indexStatus === 'queued' || indexStatus === 'building') {
                return '标注统计生成中，图片会先显示';
            }
            if (thumbStatus === 'running' || thumbStatus === 'queued' || thumbStatus === 'generating') {
                if (Number.isFinite(thumbProgress) && thumbProgress > 0) {
                    return `缩略图生成中（${Math.max(0, Math.min(100, Math.round(thumbProgress)))}%）`;
                }
                return '缩略图生成中，正在逐步补齐';
            }
            return '';
        },
        previewBoxCount() {
            return Array.isArray(this.previewAnnotationData && this.previewAnnotationData.boxes)
              ? this.previewAnnotationData.boxes.length
              : 0;
        },
        conversionStatusText() {
            const status = this.conversionStatus;
            const map = { queued: '排队中', running: '转换中', completed: '已完成', failed: '失败', pending: '待转换' };
            return status ? (map[status] || status) : '';
        },
        conversionError() {
            const conv = this.conversionMeta;
            return conv && conv.error_message ? conv.error_message : '';
        },
        conversionOverallProgress() {
            const conv = this.conversionMeta;
            const progress = conv && conv.progress && typeof conv.progress === 'object' ? conv.progress : {};
            const overall = progress && progress.overall && typeof progress.overall === 'object' ? progress.overall : {};
            return {
                processed: Math.max(0, Number(overall.processed_images) || 0),
                total: Math.max(0, Number(overall.total_images) || 0),
                currentImageIndex: Math.max(0, Number(overall.current_image_index) || 0),
                currentImageName: overall.current_image_name ? String(overall.current_image_name) : '',
                percent: Math.max(0, Math.min(100, Number(overall.percent) || 0)),
            };
        },
        conversionImageProgress() {
            const conv = this.conversionMeta;
            const progress = conv && conv.progress && typeof conv.progress === 'object' ? conv.progress : {};
            const image = progress && progress.image && typeof progress.image === 'object' ? progress.image : {};
            return {
                phase: image.phase ? String(image.phase) : (conv && conv.phase ? String(conv.phase) : 'scanning'),
                processed: Math.max(0, Number(image.processed_slices) || 0),
                total: Math.max(0, Number(image.total_slices) || 0),
                percent: Math.max(0, Math.min(100, Number(image.percent) || 0)),
            };
        },
        conversionPhaseLabel() {
            const phase = String(this.conversionImageProgress.phase || '').toLowerCase();
            const map = {
                scanning: '扫描中',
                assign_labels: '标注分配',
                save_slices: '切片保存',
                finalizing: '收尾中',
                skipped: '已跳过',
                done: '已完成',
                failed: '已失败',
            };
            return map[phase] || phase || '扫描中';
        },
        showConversionProgress() {
            if (!this.conversionSupported) return false;
            const status = String(this.conversionStatus || '').toLowerCase();
            if (status === 'queued' || status === 'running') return true;
            const overall = this.conversionOverallProgress;
            const image = this.conversionImageProgress;
            return overall.total > 0 || image.total > 0;
        },
        conversionRealtimeHint() {
            return this.conversionStreamHint || '';
        },

    },
    watch: {
        '$route': {
            handler(to, from) {
                const oldQuery = from ? from.query : {};
                const newQuery = to.query;
                const keyParams = ['datasetId', 'datasetName', 'datasetType', 'numClasses', 'numImages', 'datasetSize'];
                const hasChanged = keyParams.some(key => oldQuery[key] !== newQuery[key]);
                
                if (hasChanged || !from) {
                    this.loadDataFromRoute();
                }
            },
            immediate: true
        },
        datasetDetail: {
            handler(newDetail) {
                if (!newDetail) return;
                if (!this.selectedClass) {
                    this.selectedImages = this.imagesList.slice();
                    return;
                }
                const current = this.classList.find(c => c.class_id === this.selectedClass.class_id);
                if (!current) {
                    this.selectedClass = null;
                    this.selectedImages = this.imagesList.slice();
                    return;
                }
                this.selectedClass = current;
                this.selectClass(current, { silent: true, background: true });
            },
            immediate: true
        },
        zipUploadFile: {
            handler(val) {
                if (val) {
                    this.zipUploadInterrupted = false;
                }
                this.persistZipUploadState();
            },
            deep: true,
        },
        zipUploading(val) {
            if (val) {
                this.zipUploadInterrupted = false;
            }
            this.persistZipUploadState();
            if (val && (Number(this.zipUploadProgress || 0) || 0) >= 100) {
                this.scheduleZipUploadPolling();
            } else {
                this.clearZipUploadPolling();
            }
        },
        zipUploadProgress(val) {
            if (this.zipUploading) {
                this.persistZipUploadState();
                if ((Number(val || 0) || 0) >= 100) {
                    this.scheduleZipUploadPolling();
                }
            }
        }
    },
    methods: {
      getResolvedDatasetVersionId(detail = this.datasetDetail, preferredVersionId = undefined) {
            const candidate = preferredVersionId !== undefined ? preferredVersionId : this.selectedVersionId;
            if (candidate !== null && candidate !== undefined && candidate !== '') {
                return candidate;
            }
            const activeVersionId = detail && detail.active_version && detail.active_version.version_id;
            if (activeVersionId !== null && activeVersionId !== undefined && activeVersionId !== '') {
                return activeVersionId;
            }
            return null;
        },
      getZipUploadStateKey() {
            const id = String(this.datasetId || '').trim();
            return id ? `dataset_zip_upload_state:${id}` : '';
        },
        serializeZipUploadFile(fileLike) {
            if (!fileLike || typeof fileLike !== 'object') return null;
            const name = String(fileLike.name || '').trim();
            if (!name) return null;
            return {
                name,
                size: Number(fileLike.size || 0) || 0,
                type: String(fileLike.type || ''),
                lastModified: Number(fileLike.lastModified || 0) || 0,
                __persisted: true,
            };
        },
        readPersistedZipUploadState() {
            const key = this.getZipUploadStateKey();
            if (!key || typeof window === 'undefined' || !window.sessionStorage) return null;
            try {
                const raw = window.sessionStorage.getItem(key);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return null;
                const savedAt = Number(parsed.savedAt || 0) || 0;
                if (savedAt && (Date.now() - savedAt) > 2 * 60 * 60 * 1000) {
                    window.sessionStorage.removeItem(key);
                    return null;
                }
                return {
                    uploading: !!parsed.uploading,
                    progress: Math.max(0, Math.min(100, Number(parsed.progress || 0) || 0)),
                    file: this.serializeZipUploadFile(parsed.file),
                };
            } catch (_) {
                return null;
            }
        },
        persistZipUploadState() {
            const key = this.getZipUploadStateKey();
            if (!key || typeof window === 'undefined' || !window.sessionStorage) return;
            const isUploading = !!this.zipUploading;
            const fileMeta = this.serializeZipUploadFile(this.zipUploadFile);
            if (!isUploading) {
                window.sessionStorage.removeItem(key);
                return;
            }
            try {
                window.sessionStorage.setItem(
                    key,
                    JSON.stringify({
                        uploading: isUploading,
                        progress: Math.max(0, Math.min(100, Number(this.zipUploadProgress || 0) || 0)),
                        file: fileMeta,
                        savedAt: Date.now(),
                    })
                );
            } catch (_) {
                // ignore persistence failures
            }
        },
        clearPersistedZipUploadState({ resetLocal = false, keepInterrupted = false } = {}) {
            const key = this.getZipUploadStateKey();
            if (key && typeof window !== 'undefined' && window.sessionStorage) {
                try {
                    window.sessionStorage.removeItem(key);
                } catch (_) {
                    // ignore remove failures
                }
            }
            if (resetLocal) {
                this.zipUploadFile = null;
                this.zipUploading = false;
                this.zipUploadProgress = 0;
                this.zipUploadRestored = false;
                this.zipUploadPollAttempts = 0;
                if (!keepInterrupted) {
                    this.zipUploadInterrupted = false;
                }
            }
        },
        clearZipUploadPolling() {
            if (this.zipUploadPollTimer) {
                clearTimeout(this.zipUploadPollTimer);
                this.zipUploadPollTimer = null;
            }
        },
        scheduleZipUploadPolling() {
            this.clearZipUploadPolling();
            if (!this.datasetId || !this.zipUploading || !this.isDatasetEmpty) return;
            if ((Number(this.zipUploadProgress || 0) || 0) < 100) return;
            if (this.zipUploadPollAttempts >= 240) return;
            this.zipUploadPollAttempts += 1;
            this.zipUploadPollTimer = setTimeout(async () => {
                this.zipUploadPollTimer = null;
                try {
                    await this.fetchDatasetDetail({ silent: true });
                } catch (_) {
                    // ignore polling failures
                }
            }, 2000);
        },
        restorePersistedZipUploadState() {
            const state = this.readPersistedZipUploadState();
            this.zipUploadInterrupted = false;
            if (!state) {
                this.zipUploadFile = null;
                this.zipUploading = false;
                this.zipUploadProgress = 0;
                this.zipUploadRestored = false;
                this.zipUploadPollAttempts = 0;
                return false;
            }
            const progress = Math.max(0, Math.min(100, Number(state.progress || 0) || 0));
            const recoverable = !!state.uploading && progress >= 100;
            if (!recoverable) {
                const hadInterruptedUpload = !!state.uploading;
                this.clearPersistedZipUploadState({ resetLocal: true, keepInterrupted: true });
                this.zipUploadInterrupted = hadInterruptedUpload;
                if (hadInterruptedUpload && this.$message && typeof this.$message.warning === 'function') {
                    this.$message.warning('上次上传在刷新时已中断，请重新上传 ZIP 文件。');
                }
                return false;
            }
            this.zipUploadFile = state.file || {
                name: 'dataset.zip',
                size: 0,
                type: 'application/zip',
                lastModified: 0,
                __persisted: true,
            };
            this.zipUploadProgress = progress;
            this.zipUploadRestored = true;
            this.zipUploadPollAttempts = 0;
            this.zipUploading = true;
            return true;
        },
        resetRecoveredZipUploadState() {
            this.clearZipUploadPolling();
            this.clearPersistedZipUploadState({ resetLocal: true });
            this.$message.info('已清除当前上传处理状态');
        },
      async autoLoadIllegalLabels() {
            if (this.illegalLabels.length > 0) return; // already loaded
            this.loadingLabels = true;
            try {
                const res = await fetchIllegalDatasetLabels(this.datasetId);
                this.illegalLabels = res.labels || [];
            } catch (e) {
                console.error('Auto-load illegal labels failed:', e);
            } finally {
                this.loadingLabels = false;
            }
        },
        normalizePresetDetectionRows(rows) {
            const list = Array.isArray(rows) ? rows : [];
            const out = [];
            const dedup = new Map();
            list.forEach((item) => {
              if (!item || typeof item !== 'object') return;
              const source = String(item.source_label || item.source || '').trim();
              if (!source) return;
              const target = String(item.target_label || item.target || '').trim() || this.getLeafLabel(source);
              dedup.set(source, target);
            });
            dedup.forEach((target, source) => {
              out.push({ source_label: source, target_label: target });
            });
            return out;
        },
        normalizePresetClassificationRows(rows) {
            const list = Array.isArray(rows) ? rows : [];
            const out = [];
            const dedup = new Map();
            list.forEach((item) => {
              if (!item || typeof item !== 'object') return;
              const category = String(item.category || item.group || '').trim();
              const source = String(item.source_label || item.source || '').trim();
              if (!category || !source) return;
              const target = String(item.target_label || item.target || '').trim() || category;
              dedup.set(`${category}::${source}`, { category, source_label: source, target_label: target });
            });
            dedup.forEach((row) => out.push(row));
            return out;
        },
        normalizePresetPayload(payload) {
            const data = payload && typeof payload === 'object' ? payload : {};
            return {
              detection: this.normalizePresetDetectionRows(data.detection),
              classification: this.normalizePresetClassificationRows(data.classification),
              updated_at: data.updated_at ? String(data.updated_at) : null,
            };
        },
        getLeafLabel(label) {
            const parts = String(label || '').split('%').map((p) => p.trim()).filter(Boolean);
            return parts.length ? parts[parts.length - 1] : String(label || '').trim();
        },
        async loadIllegalLabelPresets() {
            this.mappingPresetsLoading = true;
            try {
              const data = await fetchIllegalLabelPresets();
              this.presetData = this.normalizePresetPayload(data);
            } catch (e) {
              console.error('Failed to load illegal label presets:', e);
              this.$message.warning(`预设映射加载失败: ${e && e.message ? e.message : e}`);
            } finally {
              this.mappingPresetsLoading = false;
            }
        },
        openPresetDialog() {
            this.showPresetDialog = true;
            if (!this.presetDetectionCount && !this.presetClassificationCount) {
              this.loadIllegalLabelPresets();
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
        async handlePresetFileChange(event) {
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) return;
            try {
              const parsed = await this.parsePresetWorkbook(file);
              const hasDetection = parsed.detection && parsed.detection.length > 0;
              const hasClassification = parsed.classification && parsed.classification.length > 0;
              if (!hasDetection && !hasClassification) {
                this.$message.warning('未从 XLSX 中识别到检测/分类映射数据');
                return;
              }
              if (hasDetection) this.presetData.detection = parsed.detection;
              if (hasClassification) this.presetData.classification = parsed.classification;
              this.$message.success('XLSX 导入成功，请检查后保存');
            } catch (e) {
              this.$message.error(`XLSX 导入失败: ${e && e.message ? e.message : e}`);
            } finally {
              if (event && event.target) event.target.value = '';
            }
        },
        async parsePresetWorkbook(file) {
            const xlsxModule = await import('xlsx');
            const XLSX = xlsxModule.default || xlsxModule;
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheets = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
            if (!sheets.length) throw new Error('工作簿为空');

            const findSheetName = (keywords) => {
              return sheets.find((name) => {
                const n = String(name || '').toLowerCase();
                return keywords.some((k) => n.includes(String(k).toLowerCase()));
              });
            };

            const detectionSheetName = findSheetName(['检测', 'detection', 'det']) || sheets[0] || null;
            const classificationSheetName = findSheetName(['分类', 'classification', 'class']) || sheets[1] || null;

            const readSheetRows = (sheetName) => {
              if (!sheetName) return [];
              const sheet = workbook.Sheets[sheetName];
              if (!sheet) return [];
              const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
              return Array.isArray(matrix) ? matrix : [];
            };

            const detectionRows = this.parseDetectionPresetSheet(readSheetRows(detectionSheetName));
            const classificationRows = this.parseClassificationPresetSheet(readSheetRows(classificationSheetName));

            return {
              detection: this.normalizePresetDetectionRows(detectionRows),
              classification: this.normalizePresetClassificationRows(classificationRows),
            };
        },
        parseDetectionPresetSheet(matrix) {
            const rows = Array.isArray(matrix) ? matrix : [];
            if (!rows.length) return [];
            const normalizedHeader = (rows[0] || []).map((x) => String(x || '').trim().toLowerCase());
            const sourceHeaderTokens = ['source', 'source_label', '原始标签', '源标签', '标签路径'];
            const targetHeaderTokens = ['target', 'target_label', '映射标签', '目标标签', '分类'];
            const findHeaderIndex = (tokens) => normalizedHeader.findIndex((h) => tokens.some((t) => h.includes(t)));
            const sourceIdx = findHeaderIndex(sourceHeaderTokens);
            const targetIdx = findHeaderIndex(targetHeaderTokens);
            const hasHeader = sourceIdx >= 0 || targetIdx >= 0;
            const srcCol = sourceIdx >= 0 ? sourceIdx : 0;
            const tgtCol = targetIdx >= 0 ? targetIdx : (rows[0].length > 1 ? 1 : -1);
            const startIndex = hasHeader ? 1 : 0;
            const out = [];
            for (let i = startIndex; i < rows.length; i += 1) {
              const row = Array.isArray(rows[i]) ? rows[i] : [];
              const source = String(row[srcCol] || '').trim();
              if (!source) continue;
              const targetRaw = tgtCol >= 0 ? row[tgtCol] : '';
              const target = String(targetRaw || '').trim() || this.getLeafLabel(source);
              out.push({ source_label: source, target_label: target });
            }
            return out;
        },
        parseClassificationPresetSheet(matrix) {
            const rows = Array.isArray(matrix) ? matrix : [];
            if (!rows.length) return [];

            const normalizedHeader = (rows[0] || []).map((x) => String(x || '').trim().toLowerCase());
            const categoryHeaderTokens = ['category', 'group', '分类', '类别'];
            const sourceHeaderTokens = ['source', 'source_label', '原始标签', '源标签', '标签路径'];
            const targetHeaderTokens = ['target', 'target_label', '映射标签', '目标标签'];
            const findHeaderIndex = (tokens) => normalizedHeader.findIndex((h) => tokens.some((t) => h.includes(t)));

            const categoryIdx = findHeaderIndex(categoryHeaderTokens);
            const sourceIdx = findHeaderIndex(sourceHeaderTokens);
            const targetIdx = findHeaderIndex(targetHeaderTokens);

            const out = [];
            if (sourceIdx >= 0 && categoryIdx >= 0) {
              for (let i = 1; i < rows.length; i += 1) {
                const row = Array.isArray(rows[i]) ? rows[i] : [];
                const category = String(row[categoryIdx] || '').trim();
                const source = String(row[sourceIdx] || '').trim();
                if (!category || !source) continue;
                const target = targetIdx >= 0 ? String(row[targetIdx] || '').trim() : '';
                out.push({ category, source_label: source, target_label: target || category });
              }
              return out;
            }

            // Fallback: first row as category columns, each subsequent row contains sources.
            const categoryColumns = (rows[0] || []).map((cell) => String(cell || '').trim());
            const validColumns = categoryColumns
              .map((name, idx) => ({ name, idx }))
              .filter((item) => !!item.name);
            if (!validColumns.length) return out;

            for (let r = 1; r < rows.length; r += 1) {
              const row = Array.isArray(rows[r]) ? rows[r] : [];
              validColumns.forEach((column) => {
                const source = String(row[column.idx] || '').trim();
                if (!source) return;
                out.push({ category: column.name, source_label: source, target_label: column.name });
              });
            }

            return out;
        },
        buildPresetMapping(mode) {
            const key = mode === 'classification' ? 'classification' : 'detection';
            if (key === 'detection') {
              const rows = this.normalizePresetDetectionRows(this.presetData.detection);
              return rows.reduce((acc, row) => {
                acc[row.source_label] = row.target_label || this.getLeafLabel(row.source_label);
                return acc;
              }, {});
            }
            const rows = this.normalizePresetClassificationRows(this.presetData.classification);
            return rows.reduce((acc, row) => {
              const target = String(row.target_label || '').trim() || String(row.category || '').trim();
              if (!row.source_label || !target) return acc;
              acc[row.source_label] = target;
              return acc;
            }, {});
        },
        async applyPresetToCurrentMapping() {
            if (!this.isIllegalDataset) return;
            if (!this.presetDetectionCount && !this.presetClassificationCount) {
              await this.loadIllegalLabelPresets();
            }
            const map = this.buildPresetMapping(this.presetApplyMode);
            if (!map || Object.keys(map).length === 0) {
              this.$message.warning('当前预设为空，请先编辑并保存预设映射');
              return;
            }
            this.$nextTick(() => {
              const panel = this.$refs.labelMappingPanel;
              if (!panel || typeof panel.applyExternalMapping !== 'function') {
                this.$message.warning('当前映射面板未就绪，请稍后重试');
                return;
              }
              const result = panel.applyExternalMapping(map);
              const matched = Number(result && result.matched) || 0;
              const total = Number(result && result.total) || 0;
              this.$message.success(`已应用预设映射，匹配 ${matched}/${total} 条标签`);
            });
        },
        async savePresetDialogData() {
            this.mappingPresetsSaving = true;
            try {
              const payload = {
                detection: this.normalizePresetDetectionRows(this.presetData.detection),
                classification: this.normalizePresetClassificationRows(this.presetData.classification),
              };
              const saved = await saveIllegalLabelPresets(payload);
              this.presetData = this.normalizePresetPayload(saved);
              this.$message.success('预设映射保存成功');
              this.showPresetDialog = false;
            } catch (e) {
              this.$message.error(`保存预设失败: ${e && e.message ? e.message : e}`);
            } finally {
              this.mappingPresetsSaving = false;
            }
        },
        async handleLabelMappingSave(mapping) {
            this.savingLabels = true;
            try {
                const expanded = { ...mapping };
                Object.keys(mapping || {}).forEach((key) => {
                  const val = mapping[key];
                  if (val && val !== '__DISCARD__') {
                    expanded[val] = val;
                  }
                });
                await updateIllegalDatasetLabels(this.datasetId, expanded);
                this.$message.success('映射保存成功');
                this.hasSavedMapping = true;
                this.savedLabelMapping = expanded;
                this.saveLocalLabelMapping(expanded);
            } catch(e) {
                this.$message.error('保存失败: ' + e.message);
            } finally {
                this.savingLabels = false;
            }
        },
        async handleSaveAndConvert(mapping, sliceParams) {
            this.sliceParams = sliceParams || null;
            await this.handleLabelMappingSave(mapping);
            if (!this.hasSavedMapping) return; // save failed
            await this.submitConvertWithMapping();
        },
      getLabelMappingStorageKey() {
        const id = this.datasetId || '';
        return `illegal_label_mapping_${id}`;
      },
      loadLocalLabelMapping() {
        const key = this.getLabelMappingStorageKey();
        if (!key) return null;
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) return obj;
        } catch (_) {
          // ignore malformed storage
        }
        return null;
      },
      saveLocalLabelMapping(mapping) {
        const key = this.getLabelMappingStorageKey();
        if (!key) return;
        try {
          if (mapping && typeof mapping === 'object' && Object.keys(mapping).length > 0) {
            localStorage.setItem(key, JSON.stringify(mapping));
          } else {
            localStorage.removeItem(key);
          }
        } catch (_) {
          // ignore storage errors
        }
      },
      syncIllegalLabelMapping(detail) {
        const ver = detail && detail.active_version;
        const meta = ver && ver.meta;
        const isIllegal = !!(ver && ver.status === 'failed' && meta && meta.illegal);
        if (!isIllegal) {
          this.savedLabelMapping = null;
          this.hasSavedMapping = false;
          return;
        }
        const serverMapping = meta && meta.illegal_label_mapping;
        if (serverMapping && typeof serverMapping === 'object' && Object.keys(serverMapping).length > 0) {
          this.savedLabelMapping = serverMapping;
          this.hasSavedMapping = true;
          this.saveLocalLabelMapping(serverMapping);
          return;
        }
        const localMapping = this.loadLocalLabelMapping();
        if (localMapping && typeof localMapping === 'object' && Object.keys(localMapping).length > 0) {
          this.savedLabelMapping = localMapping;
          this.hasSavedMapping = true;
          return;
        }
        this.savedLabelMapping = null;
        this.hasSavedMapping = false;
      },
      // Helpers for class list rendering/selection
      getClassName(item) {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return item.class_name || item.name || '';
        return String(item);
      },
      getClassId(item, idx) {
        if (item && typeof item === 'object') {
          const id = item.class_id !== undefined ? item.class_id : item.id;
          if (id !== undefined && id !== null) return id;
          const n = item.class_name || item.name;
          if (n) return `name:${n}`;
        }
        if (typeof item === 'string') return `name:${item}`;
        return idx;
      },
      isSelectedClass(item) {
        if (this.selectedClass === null) return false; // handled by the "全部类别" row
        const sel = this.selectedClass;
        const itemId = (item && typeof item === 'object') ? (item.class_id ?? item.id) : null;
        const selId = (sel && typeof sel === 'object') ? (sel.class_id ?? sel.id) : null;
        if (itemId !== null && selId !== null) return String(itemId) === String(selId);
        // Fallback to name comparison
        return this.getClassName(item) === this.getClassName(sel);
      },

      // --- 类别重命名 ---
      startEditClass(classInfo, idx) {
        if (this.renameSaving) return;
        this.editingClassIdx = idx;
        this.editingClassName = this.getClassName(classInfo);
        this.$nextTick(() => {
          const inputs = this.$refs.classEditInput;
          if (inputs) {
            const el = Array.isArray(inputs) ? inputs[0] : inputs;
            if (el) el.focus();
          }
        });
      },
      cancelEditClass() {
        this.editingClassIdx = null;
        this.editingClassName = '';
      },
      async confirmEditClass(classInfo) {
        const oldName = this.getClassName(classInfo);
        const newName = (this.editingClassName || '').trim();
        // 未改动或为空 → 取消
        if (!newName || newName === oldName) {
          this.cancelEditClass();
          return;
        }
        // 检查是否与其他类别重名
        const existing = this.classList.find(c => this.getClassName(c) === newName);
        if (existing) {
          this.$message.warning(`类别名 "${newName}" 已存在`);
          return;
        }
        this.renameSaving = true;
        try {
          await renameDatasetClasses(this.datasetId, { [oldName]: newName });
          this.$message.success(`已重命名: ${oldName} → ${newName}`);
          this.cancelEditClass();
          // 刷新数据集详情以反映新的类别名
          await this.fetchDatasetDetail();
        } catch (e) {
          this.$message.error('重命名失败: ' + (e.message || e));
        } finally {
          this.renameSaving = false;
        }
      },

        async loadDataFromRoute() {
            this.stopConversionStream();
            this.clearPendingViewRefresh();
            this.clearZipUploadPolling();
            this.datasetId = this.$route.query.datasetId || '';
            this.datasetName = this.$route.query.datasetName || '';
            this.datasetType = this.$route.query.datasetType || '';
            this.numClasses = parseInt(this.$route.query.numClasses) || 0;
            this.numImages = parseInt(this.$route.query.numImages) || 0;
            this.datasetSize = this.$route.query.datasetSize || '0MB';
            this.selectedVersionId = null;
            this.versionOptions = [];
            this.splitSummary = null;
            this.splitLoading = false;
            this.showAugmentationDialog = false;
            this.viewStatusRetryCount = 0;
            this.zipUploadInterrupted = false;
            this.restorePersistedZipUploadState();
            this.savedLabelMapping = this.loadLocalLabelMapping();
            this.hasSavedMapping = !!(this.savedLabelMapping && Object.keys(this.savedLabelMapping).length > 0);
            await this.refreshVersionsAndDetail({ forceLatest: true });
        },
        async refreshVersionsAndDetail({ forceLatest = false } = {}) {
            if (!this.datasetId) return;
            if (forceLatest) {
                this.selectedVersionId = null;
            }
            const requestedVersionId = forceLatest ? null : this.selectedVersionId;
            await Promise.all([
                this.loadDatasetVersions({ forceLatest }),
                this.fetchDatasetDetail({ versionIdOverride: requestedVersionId }),
            ]);
        },
        getInitialViewPageSize() {
            return 100;
        },
        getBufferedViewLimit() {
            return 500;
        },
        getBufferedViewPageSize() {
            return 200;
        },
        mergeImageItems(existingItems, incomingItems, maxItems = 500) {
            const merged = [];
            const seen = new Set();
            const pushOne = (item) => {
                if (!item || typeof item !== 'object') return;
                const key = String(item.image_name || item.image_path || item.name || '').trim();
                if (!key || seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            };
            (Array.isArray(existingItems) ? existingItems : []).forEach(pushOne);
            (Array.isArray(incomingItems) ? incomingItems : []).forEach(pushOne);
            if (maxItems > 0 && merged.length > maxItems) {
                return merged.slice(0, maxItems);
            }
            return merged;
        },
        clearPendingViewRefresh() {
            if (this.viewStatusRetryTimer) {
                clearTimeout(this.viewStatusRetryTimer);
                this.viewStatusRetryTimer = null;
            }
        },
        scheduleViewRefreshIfPending(meta = null) {
            this.clearPendingViewRefresh();
            if (this.selectedClass) return;
            const currentMeta = meta || this.currentViewMeta;
            if (!currentMeta) {
                this.viewStatusRetryCount = 0;
                return;
            }
            const thumbStatus = String(currentMeta.thumbnail_status || '').toLowerCase();
            const indexStatus = String(currentMeta.view_index_status || '').toLowerCase();
            const pending = ['queued', 'running', 'generating', 'building'].includes(thumbStatus)
                || ['queued', 'running', 'building'].includes(indexStatus);
            if (!pending) {
                this.viewStatusRetryCount = 0;
                return;
            }
            if (this.viewStatusRetryCount >= 8) return;
            this.viewStatusRetryCount += 1;
            this.viewStatusRetryTimer = setTimeout(async () => {
                this.viewStatusRetryTimer = null;
                try {
                    await this.fetchDatasetDetail({ silent: true });
                } catch (_) {
                    // ignore background refresh errors
                }
            }, 1500);
        },
        async loadRemainingViewPages({
            token,
            versionId,
            classId = null,
            startPage = 2,
            totalPages = 1,
            maxItems = 500,
        } = {}) {
            if (!this.datasetId || !totalPages || startPage > totalPages) return;
            const bufferedPageSize = this.getBufferedViewPageSize();
            for (let page = startPage; page <= totalPages; page += 1) {
                if (token !== this.viewRequestToken) return;
                const currentCount = classId === null
                    ? (((this.datasetDetail && this.datasetDetail.images) || []).length)
                    : this.selectedImages.length;
                if (maxItems > 0 && currentCount >= maxItems) return;
                const remainingSlots = maxItems > 0 ? Math.max(1, maxItems - currentCount) : bufferedPageSize;
                const viewData = await FetchDatasetView(this.datasetId, {
                    versionId,
                    classId,
                    page,
                    pageSize: Math.min(bufferedPageSize, remainingSlots),
                });
                if (token !== this.viewRequestToken) return;
                const incomingItems = Array.isArray(viewData.items) ? viewData.items : [];
                if (!incomingItems.length) return;

                if (classId === null) {
                    const mergedImages = this.mergeImageItems(
                        this.datasetDetail && this.datasetDetail.images,
                        incomingItems,
                        maxItems,
                    );
                    if (this.datasetDetail) {
                        this.$set(this.datasetDetail, 'images', mergedImages);
                        this.$set(this.datasetDetail, 'view_meta', viewData.meta || (this.datasetDetail.view_meta || null));
                    }
                    if (!this.selectedClass) {
                        this.selectedImages = mergedImages.slice();
                    }
                } else if (this.selectedClass && Number(this.selectedClass.class_id) === Number(classId)) {
                    this.selectedImages = this.mergeImageItems(this.selectedImages, incomingItems, maxItems);
                }

                if (incomingItems.length < Math.min(bufferedPageSize, remainingSlots)) {
                    return;
                }
            }
        },
        async loadDatasetVersions({ forceLatest = false } = {}) {
            if (!this.datasetId) return;
            this.versionLoading = true;
            try {
                const pageSize = 200;
                let page = 1;
                let all = [];
                for (;;) {
                    const res = await fetchDatasetVersions(this.datasetId, { page, pageSize });
                    const items = (res && Array.isArray(res.items) && res.items) || [];
                    const metaTotal = Number(res?.meta?.total ?? 0) || 0;
                    all = all.concat(items);
                    if (metaTotal && all.length >= metaTotal) break;
                    if (!items.length) break;
                    page += 1;
                }

                this.versionOptions = all.map(v => ({
                    value: v.version_id,
                    label: this.formatVersionLabel(v),
                    raw: v,
                }));

                const currentId = this.selectedVersionId;
                const hasCurrent = currentId && this.versionOptions.some(o => String(o.value) === String(currentId));
                if (hasCurrent && !forceLatest) return;

                const latest = all[0];
                this.selectedVersionId = latest ? latest.version_id : null;
            } catch (error) {
                console.error('Failed to fetch dataset versions:', error);
                this.versionOptions = [];
                if (forceLatest) this.selectedVersionId = null;
            } finally {
                this.versionLoading = false;
            }
        },
        formatVersionLabel(version) {
            if (!version) return '未命名版本';
            const parts = [];
            if (version.version !== undefined && version.version !== null) {
                parts.push(`v${version.version}`);
            } else if (version.version_id !== undefined && version.version_id !== null) {
                parts.push(`#${version.version_id}`);
            }
            if (version.status) {
                const statusMap = { created: '已创建', finalized: '已完成', failed: '失败' };
                parts.push(statusMap[version.status] || version.status);
            }
            const message = String(version.message || '').trim();
            if (message) parts.push(message);
            return parts.join(' · ') || '版本';
        },
        handleSearchInput() {
            if (this.debouncedSearch) this.debouncedSearch();
        },
        clearSearch() {
            this.input = '';
        },
        highlightText(text, query) {
            console.log("Highlighting text called with:", text, query);
            if (!query || !query.trim()) return text;
            try {
                const regex = new RegExp(`(${query.trim()})`, 'gi');
                console.log("Highlighting text:", text, "with query:", query);
                return text.replace(regex, '<span class="highlight-text">$1</span>');
            } catch (e) {
                return text;
            }
        },
        async selectClass(classInfo, { silent = false, background = false } = {}) {
            this.selectedClass = classInfo;
            if (!classInfo || classInfo.class_id === undefined || classInfo.class_id === null) {
                this.selectedImages = this.imagesList.slice();
                if (!background) {
                    this.scheduleViewRefreshIfPending();
                }
                return;
            }
            const versionId = this.getResolvedDatasetVersionId();
            if (versionId === null) {
                this.selectedImages = [];
                return;
            }
            
            // Use server-side filtering via the view API
            try {
                const token = ++this.viewRequestToken;
                const classId = classInfo && classInfo.class_id !== undefined ? classInfo.class_id : null;
                const viewData = await FetchDatasetView(this.datasetId, {
                    versionId,
                    classId: classId,
                    page: 1,
                    pageSize: this.getInitialViewPageSize(),
                });
                if (token !== this.viewRequestToken) return;
                this.selectedImages = viewData.items || [];
                const totalPages = Number(viewData?.meta?.total_pages || 0) || 0;
                if (totalPages > 1) {
                    this.loadRemainingViewPages({
                        token,
                        versionId,
                        classId,
                        startPage: 2,
                        totalPages,
                        maxItems: this.getBufferedViewLimit(),
                    });
                }
            } catch (error) {
                console.error('Failed to filter images by class:', error);
                // Fallback to client-side filtering
                if (classInfo && classInfo.class_id !== undefined) {
                    this.selectedImages = this.imagesList.filter(img =>
                        img.classes_in_image && img.classes_in_image.includes(classInfo.class_id)
                    );
                } else {
                    this.selectedImages = [...this.imagesList];
                }
                if (!silent) {
                    this.$message.warning('按类别筛选失败，已回退为本地过滤结果');
                }
            }
        },
        handleImageError(event, image) {
            const img = event.target;
            if (!img) return;
            const currentSrc = img.src || '';
            const fallbackStage = String(img.dataset.fallback || '');
            const relPath = image && (image.image_path || image.image_name) ? String(image.image_path || image.image_name) : '';
            const originalUrl = image && image.image_url ? String(image.image_url) : '';

            if (!fallbackStage && relPath) {
                const apiUrl = buildDatasetThumbnailApiUrl(this.datasetId, relPath, {
                    versionId: this.selectedVersionId,
                });
                if (apiUrl && apiUrl !== currentSrc) {
                    img.dataset.fallback = 'api';
                    img.src = apiUrl;
                    return;
                }
            }

            if (fallbackStage !== 'original' && originalUrl && originalUrl !== currentSrc) {
                img.dataset.fallback = 'original';
                img.src = originalUrl;
                return;
            }

            img.dataset.fallback = 'failed';
            img.alt = `${image && image.image_name ? image.image_name : '图片'} 预览加载失败`;
        },
        async openImagePreview(image) {
            this.previewImage = image ? { ...image } : null;
            this.showImagePreview = true;
            this.previewAnnotationsLoading = !!this.isDetectionDataset;
            this.previewAnnotationsError = '';
            this.previewAnnotationData = null;
            const token = ++this.previewRequestToken;

            this.$nextTick(() => {
                const img = this.$refs.previewModalImage;
                if (img && img.complete) this.handlePreviewImageLoad();
            });

            if (!this.isDetectionDataset || !image || !image.image_name) {
                this.previewAnnotationsLoading = false;
                return;
            }

            try {
                const data = await fetchDatasetImageAnnotations(this.datasetId, image.image_name, {
                    versionId: this.selectedVersionId,
                });
                if (token !== this.previewRequestToken) return;
                this.previewAnnotationData = data;
                this.previewAnnotationsLoading = false;
                this.previewImage = {
                    ...this.previewImage,
                    objects_count: Number(data && data.object_count) || 0,
                };
                this.$nextTick(() => this.redrawPreviewAnnotations());
            } catch (e) {
                if (token !== this.previewRequestToken) return;
                this.previewAnnotationsLoading = false;
                this.previewAnnotationsError = e && e.message ? String(e.message) : '标注加载失败';
                this.$nextTick(() => this.redrawPreviewAnnotations());
            }
        },
        closeImagePreview() {
            this.showImagePreview = false;
            this.previewImage = null;
            this.previewAnnotationsLoading = false;
            this.previewAnnotationsError = '';
            this.previewAnnotationData = null;
            this.previewRequestToken += 1;
            this.clearPreviewCanvas();
        },
        handleModalImageError(event) {
            event.target.style.display = 'none';
            this.clearPreviewCanvas();
        },
        handlePreviewImageLoad() {
            this.fitPreviewCanvasToImage();
            this.redrawPreviewAnnotations();
        },
        handlePreviewResize() {
            if (!this.showImagePreview) return;
            this.$nextTick(() => {
                this.fitPreviewCanvasToImage();
                this.redrawPreviewAnnotations();
            });
        },
        fitPreviewCanvasToImage() {
            const canvas = this.$refs.previewCanvas;
            const wrap = this.$refs.previewCanvasWrap;
            if (!canvas || !wrap) return;
            const width = wrap.clientWidth || 0;
            const height = wrap.clientHeight || 0;
            if (!width || !height) return;
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;
        },
        clearPreviewCanvas() {
            const canvas = this.$refs.previewCanvas;
            const ctx = canvas ? canvas.getContext('2d') : null;
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        },
        getPreviewRenderedImageRect() {
            const wrap = this.$refs.previewCanvasWrap;
            const img = this.$refs.previewModalImage;
            if (!wrap || !img) return null;

            const wrapRect = wrap.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();
            if (!wrapRect.width || !wrapRect.height || !imgRect.width || !imgRect.height) return null;

            return {
                offsetX: imgRect.left - wrapRect.left,
                offsetY: imgRect.top - wrapRect.top,
                drawW: imgRect.width,
                drawH: imgRect.height,
                naturalW: img.naturalWidth || Number(this.previewAnnotationData && this.previewAnnotationData.width) || 0,
                naturalH: img.naturalHeight || Number(this.previewAnnotationData && this.previewAnnotationData.height) || 0,
            };
        },
        getAnnotationColor(classId = 0) {
            const palette = [
                '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
                '#0891b2', '#db2777', '#4f46e5', '#ea580c', '#059669'
            ];
            const idx = Math.abs(Number(classId) || 0) % palette.length;
            return palette[idx];
        },
        redrawPreviewAnnotations() {
            const canvas = this.$refs.previewCanvas;
            const ctx = canvas ? canvas.getContext('2d') : null;
            if (!ctx || !canvas) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const boxes = Array.isArray(this.previewAnnotationData && this.previewAnnotationData.boxes)
              ? this.previewAnnotationData.boxes
              : [];
            if (!boxes.length) return;

            const rect = this.getPreviewRenderedImageRect();
            if (!rect || !rect.naturalW || !rect.naturalH) return;
            const { offsetX, offsetY, drawW, drawH, naturalW, naturalH } = rect;

            ctx.lineWidth = 2;
            ctx.font = '13px sans-serif';
            ctx.textBaseline = 'top';

            boxes.forEach((box) => {
                const color = this.getAnnotationColor(box.class_id);
                const x = offsetX + (Number(box.x1) || 0) * drawW / naturalW;
                const y = offsetY + (Number(box.y1) || 0) * drawH / naturalH;
                const w = Math.max(0, ((Number(box.x2) || 0) - (Number(box.x1) || 0)) * drawW / naturalW);
                const h = Math.max(0, ((Number(box.y2) || 0) - (Number(box.y1) || 0)) * drawH / naturalH);

                ctx.strokeStyle = color;
                ctx.strokeRect(x, y, w, h);

                const label = String(box.class_name || `class_${box.class_id ?? 0}`);
                const textW = ctx.measureText(label).width + 10;
                const textH = 20;
                const textX = x;
                const textY = Math.max(offsetY, y - textH);

                ctx.fillStyle = color;
                ctx.fillRect(textX, textY, textW, textH);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, textX + 5, textY + 3);
            });
        },
        getClassNames(classIds) {
            if (!this.classList || !classIds) return '';
            return classIds.map(id => {
                const classInfo = this.classList.find(cls => cls.class_id === id);
                return classInfo ? classInfo.class_name : `class_${id}`;
            }).join(', ');
        },
        handleKeydown(event) {
            if (event.key === 'Escape' && this.showImagePreview) {
                this.closeImagePreview();
            }
        },
        debounce(func, wait) {
            return () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => { func(); }, wait);
            };
        },
        goBack() {
            this.$router.push('/datasets');
        },
        async handleUploadSuccess() {
            this.$message.success('上传成功，正在刷新数据集。');
            this.clearZipUploadPolling();
            this.clearPersistedZipUploadState({ resetLocal: true });
            await this.refreshVersionsAndDetail({ forceLatest: true });
        },
        openSplitDialog() {
          if (!this.showSplitButton) return;
          this.splitForm = { train: 90, val: 7, test: 3 };
          this.showSplitDialog = true;
        },
        openAugmentationDialog() {
          if (!this.showAugmentationButton) return;
          this.showAugmentationDialog = true;
        },
        async handleAugmentationPublished(out) {
          const v = out && out.version ? `v${out.version}` : '';
          this.$message.success(`扩增结果已发布 ${v}`.trim());
          this.showAugmentationDialog = false;
          await this.refreshVersionsAndDetail({ forceLatest: true });
        },
        handleConvertClick() {
          if (this.hasSavedMapping) {
            // Mapping already saved, convert directly using it
            this.submitConvertWithMapping();
          } else {
            this.openConvertDialog();
          }
        },
        openConvertDialog() {
          if (!this.conversionSupported) {
            this.$message.warning('该数据集不支持转换');
            return;
          }
          this.showConvertDialog = true;
        },
        openLabelEditor() {
          this.$nextTick(() => {
            const panel = this.$refs.labelMappingPanel;
            const el = panel && panel.$el ? panel.$el : null;
            if (el && typeof el.scrollIntoView === 'function') {
              try {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } catch (_) {
                el.scrollIntoView();
              }
            }
          });
        },
        async submitConvertWithMapping() {
          if (!this.datasetId) return;
          const mapping = this.savedLabelMapping || this.loadLocalLabelMapping();
          if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).length === 0) {
            this.$message.warning('未找到已保存的映射，请先保存映射');
            this.openLabelEditor();
            return;
          }
          this.convertingDataset = true;
          try {
            const opts = {
              labelStrategy: 'mapping',
              labelSeparator: '%',
              labelMapping: mapping,
            };
            if (this.sliceParams && typeof this.sliceParams === 'object') {
              Object.assign(opts, this.sliceParams);
            }
            const result = await convertIllegalDataset(this.datasetId, opts);
            this.$message.success('转换任务已提交');
            const jobId = result && result.job_id ? String(result.job_id) : this.conversionJobId;
            if (jobId) this.startConversionStream(jobId);
          } catch (e) {
            const msg = e && e.message ? String(e.message) : '转换失败';
            this.$message.error(`转换失败: ${msg}`);
          } finally {
            this.convertingDataset = false;
          }
        },
        async submitSplit() {
          if (!this.datasetId) return;
          if (!this.splitValid) {
            this.$message.warning('训练/验证/测试比例总和需为100%');
            return;
          }
          this.splitSubmitting = true;
          try {
            const payload = {
              version_id: this.selectedVersionId ? Number(this.selectedVersionId) : null,
              train_ratio: (Number(this.splitForm.train) || 0) / 100,
              val_ratio: (Number(this.splitForm.val) || 0) / 100,
              test_ratio: (Number(this.splitForm.test) || 0) / 100,
            };
            const summary = await splitDataset(this.datasetId, payload);
            this.splitSummary = summary;
            this.$message.success('数据集划分完成');
            this.showSplitDialog = false;
            await this.fetchDatasetDetail();
          } catch (e) {
            const msg = e && e.message ? String(e.message) : '划分失败';
            this.$message.error(`划分失败: ${msg}`);
          } finally {
            this.splitSubmitting = false;
          }
        },
        async submitConvert() {
          if (!this.datasetId) return;
          const strategy = this.convertForm.labelStrategy;
          if (strategy === 'level') {
            const lvl = Number(this.convertForm.labelLevel);
            if (!lvl || lvl < 1) {
              this.$message.warning('请输入正确的层级');
              return;
            }
          }
          this.convertingDataset = true;
          try {
            const result = await convertIllegalDataset(this.datasetId, {
              labelStrategy: strategy,
              labelLevel: this.convertForm.labelLevel,
              labelSeparator: this.convertForm.labelSeparator,
            });
            this.$message.success('转换任务已提交');
            this.showConvertDialog = false;
            const jobId = result && result.job_id ? String(result.job_id) : this.conversionJobId;
            if (jobId) this.startConversionStream(jobId);
          } catch (e) {
            const msg = e && e.message ? String(e.message) : '转换失败';
            this.$message.error(`转换失败: ${msg}`);
          } finally {
            this.convertingDataset = false;
          }
        },
        _emptyConversionProgress() {
          return {
            overall: {
              processed_images: 0,
              total_images: 0,
              current_image_index: 0,
              current_image_name: '',
              percent: 0,
            },
            image: {
              phase: 'scanning',
              processed_slices: 0,
              total_slices: 0,
              percent: 0,
            },
          };
        },
        _applyConversionPayload(payload) {
          if (!this.datasetDetail || !this.datasetDetail.active_version) return;

          const activeVersion = this.datasetDetail.active_version;
          if (!activeVersion.meta || typeof activeVersion.meta !== 'object') {
            this.$set(activeVersion, 'meta', {});
          }
          const meta = activeVersion.meta;
          const current = meta.conversion && typeof meta.conversion === 'object' ? meta.conversion : {};
          const next = { ...current };

          if (payload && typeof payload === 'object') {
            ['job_id', 'status', 'seq', 'updated_at', 'phase', 'error_message', 'output_version_id', 'message'].forEach((key) => {
              if (payload[key] !== undefined && payload[key] !== null) {
                next[key] = payload[key];
              }
            });

            if (payload.progress && typeof payload.progress === 'object') {
              const currentProgress = current.progress && typeof current.progress === 'object'
                ? current.progress
                : this._emptyConversionProgress();
              const incomingOverall = payload.progress.overall && typeof payload.progress.overall === 'object'
                ? payload.progress.overall
                : {};
              const incomingImage = payload.progress.image && typeof payload.progress.image === 'object'
                ? payload.progress.image
                : {};

              next.progress = {
                overall: { ...(currentProgress.overall || {}), ...incomingOverall },
                image: { ...(currentProgress.image || {}), ...incomingImage },
              };
            }
          }

          if (!next.progress || typeof next.progress !== 'object') {
            next.progress = this._emptyConversionProgress();
          }
          if (!next.phase) {
            const image = next.progress.image && typeof next.progress.image === 'object' ? next.progress.image : {};
            if (image.phase) next.phase = image.phase;
          }
          this.$set(meta, 'conversion', next);
        },
        startConversionStream(jobId) {
          const normalizedJobId = String(jobId || '').trim();
          if (!this.datasetId || !normalizedJobId) return;
          if (this.conversionStream && this.conversionStreamJobId === normalizedJobId) return;

          this.stopConversionStream({ clearHint: true });
          this.conversionStreamJobId = normalizedJobId;

          this.conversionStream = openIllegalConversionStream(
            this.datasetId,
            normalizedJobId,
            {
              onOpen: () => {
                this.conversionStreamHint = '';
              },
              onSnapshot: (payload) => {
                this._applyConversionPayload(payload || {});
              },
              onProgress: (payload) => {
                this._applyConversionPayload(payload || {});
              },
              onDone: async (payload) => {
                this._applyConversionPayload(payload || {});
                const status = String(payload?.status || '').toLowerCase();
                const errorMessage = payload?.error_message || '';
                this.stopConversionStream({ clearHint: true });
                if (status === 'completed') {
                  this.$message.success('Conversion completed');
                  await this.refreshVersionsAndDetail({ forceLatest: true });
                } else if (status === 'failed') {
                  this.$message.error(`Conversion failed: ${errorMessage || 'unknown error'}`);
                }
              },
              onError: (err) => {
                if (err && typeof err === 'string') {
                  this.conversionStreamHint = `Realtime stream error: ${err}`;
                }
              },
              onClose: () => {
                if (this.conversionStatus === 'queued' || this.conversionStatus === 'running') {
                  this.conversionStreamHint = 'Realtime stream disconnected, reconnecting...';
                }
              },
              onReconnect: ({ attempt, delayMs } = {}) => {
                const sec = Math.max(1, Math.round((Number(delayMs) || 0) / 1000));
                this.conversionStreamHint = `Realtime stream reconnecting (attempt ${attempt || 1}, ~${sec}s)`;
              },
            },
            {
              minDelayMs: 1000,
              maxDelayMs: 15000,
              reconnectFactor: 2,
            }
          );
        },
        stopConversionStream({ clearHint = true } = {}) {
          if (this.conversionStream) {
            try { this.conversionStream.close(); } catch (_) { /* ignore */ }
            this.conversionStream = null;
          }
          this.conversionStreamJobId = '';
          if (clearHint) this.conversionStreamHint = '';
        },

        formatUploadErrorMessage(errorMsg) {
            const msg = errorMsg ? String(errorMsg) : '';
            if (msg.toLowerCase().includes('no image files found')) {
                return `${msg}（请检查是否为 .tif/.tiff 或后端未开启支持）`;
            }
            if (msg.toLowerCase().includes('no label files found')) {
                return `${msg}（检测数据集必须包含标注：YOLO txt 或 LabelMe JSON）`;
            }
            if (msg.toLowerCase().includes('append upload disabled')) {
                return '追加上传已禁用';
            }
            return msg;
        },
        handleUploadFail(errorMsg) {
            this.clearZipUploadPolling();
            this.clearPersistedZipUploadState({ resetLocal: true });
            const msg = this.formatUploadErrorMessage(errorMsg);
            this.$message.error(`上传失败: ${msg}`);
        },
        formatImageCount(count) {
            if (!count) return '0';
            if (count >= 1000) {
                return (count / 1000).toFixed(1) + 'K';
            }
            return count.toString();
        },
        formatDatasetSize(sizeStr) {
            if (!sizeStr) return '0MB';
            if (typeof sizeStr === 'string' && sizeStr.includes('MB')) {
                return sizeStr;
            }
            if (typeof sizeStr === 'number') {
                return sizeStr.toFixed(1) + 'MB';
            }
            return sizeStr;
        },
        getDatasetTypeLabel(type) {
            const typeMap = {
                'detection': '目标检测',
                'segmentation': '图像分割',
                'classification': '图像分类',
            };
            return typeMap[type] || type || '图像分类';
        },
        async fetchDatasetDetail({ versionIdOverride = undefined, silent = false } = {}) {
            if (!this.datasetId) return;

            const token = ++this.viewRequestToken;
            this.clearPendingViewRefresh();
            if (!silent) this.detailLoading = true;
            try {
                const requestedVersionId = versionIdOverride !== undefined ? versionIdOverride : this.selectedVersionId;
                // First get basic detail for dataset info
                const detail = await FetchDatasetDetail(this.datasetId, {
                    versionId: requestedVersionId,
                    filesLimit: 10, // Minimal for basic info
                    includeFiles: false,
                });
                if (token !== this.viewRequestToken) return;
                
                if (detail.dataset_name) this.datasetName = detail.dataset_name;
                if (detail.dataset_type) this.datasetType = detail.dataset_type;
                if (detail.dataset_size_mb) this.datasetSize = detail.dataset_size_mb;
                if ((this.selectedVersionId === null || requestedVersionId === null) && detail && detail.active_version && detail.active_version.version_id) {
                    this.selectedVersionId = detail.active_version.version_id;
                }
                
                const ver = detail && detail.active_version;
                const meta = ver && ver.meta;
                const isIllegal = !!(ver && ver.status === 'failed' && meta && meta.illegal);
                const resolvedVersionId = this.getResolvedDatasetVersionId(detail, requestedVersionId);
                const hasResolvableVersion = resolvedVersionId !== null;

                if (isIllegal) {
                    this.datasetDetail = detail;
                    this.numClasses = detail.num_classes || 0;
                    this.numImages = detail.total_images || 0;
                    this.selectedImages = [];
                    // Auto-load illegal labels for inline mapping panel
                    this.autoLoadIllegalLabels();
                    this.loadIllegalLabelPresets();
                } else if (!hasResolvableVersion) {
                    this.datasetDetail = detail;
                    this.numClasses = detail.num_classes || 0;
                    this.numImages = detail.total_images || 0;
                    this.selectedImages = [];
                } else {
                    // Then get view data with categories and images
                    try {
                        const viewData = await FetchDatasetView(this.datasetId, {
                            versionId: resolvedVersionId,
                            classId: null, // No filter initially
                            page: 1,
                            pageSize: this.getInitialViewPageSize(),
                        });
                        if (token !== this.viewRequestToken) return;
                        
                        // Merge view data into detail object
                        this.datasetDetail = {
                            ...detail,
                            categories: viewData.categories || [],
                            images: viewData.items || [],
                            total_images: viewData.meta?.total_items || viewData.items?.length || 0,
                            view_meta: viewData.meta || null,
                        };
                        
                        // Update stats from view data
                        this.numClasses = (viewData.categories || []).length || detail.num_classes || 0;
                        this.numImages = viewData.meta?.total_items || detail.total_images || 0;
                        
                        // Set selected images initially
                        this.selectedImages = viewData.items || [];

                        const totalPages = Number(viewData?.meta?.total_pages || 0) || 0;
                        if (totalPages > 1) {
                            this.loadRemainingViewPages({
                                token,
                                versionId: resolvedVersionId,
                                classId: null,
                                startPage: 2,
                                totalPages,
                                maxItems: this.getBufferedViewLimit(),
                            });
                        }
                        this.scheduleViewRefreshIfPending(viewData.meta || null);
                    } catch (viewError) {
                        console.warn('View API failed, falling back to detail:', viewError);
                        if (token !== this.viewRequestToken) return;
                        this.datasetDetail = detail;
                        if (detail.num_classes !== undefined) this.numClasses = detail.num_classes;
                        if (detail.total_images !== undefined) this.numImages = detail.total_images;
                        this.selectedImages = detail.images || [];
                    }
                }

                if (this.zipUploading) {
                    if (isIllegal || !this.isDatasetEmpty) {
                        this.clearZipUploadPolling();
                        this.clearPersistedZipUploadState({ resetLocal: true });
                    } else {
                        this.scheduleZipUploadPolling();
                    }
                }

                this.syncIllegalLabelMapping(detail);

                await this.fetchSplitSummary();

                const status = this.conversionStatus;
                const jobId = this.conversionJobId;
                if (this.isIllegalDataset && (status === 'queued' || status === 'running') && jobId) {
                    this.startConversionStream(jobId);
                } else {
                    this.stopConversionStream();
                }

            } catch (error) {
                console.error('Failed to fetch dataset detail:', error);
                this.datasetDetail = null;
                if (this.zipUploading) {
                    this.scheduleZipUploadPolling();
                }
            } finally {
                if (!silent) this.detailLoading = false;
            }
        },
        async fetchSplitSummary() {
            if (!this.datasetId) return;
            if (!this.isDetectionDataset || this.isIllegalDataset) {
                this.splitSummary = null;
                return;
            }
            const versionId = this.getResolvedDatasetVersionId();
            if (versionId === null) {
                this.splitSummary = null;
                this.splitLoading = false;
                return;
            }
            this.splitLoading = true;
            try {
                const summary = await fetchDatasetSplitSummary(this.datasetId, {
                    versionId,
                });
                this.splitSummary = summary || null;
            } catch (e) {
                console.warn('Failed to fetch split summary:', e);
                this.splitSummary = null;
            } finally {
                this.splitLoading = false;
            }
        },
        async handleVersionChange() {
            this.viewStatusRetryCount = 0;
            await this.fetchDatasetDetail();
        },
        handleAddImage() {
            if (!this.allowAppendUpload) {
                this.$message.warning('追加上传已禁用');
                return;
            }
            // Open dialog instead of direct file selection
            this.showUploadDialog = true;
            this.pendingImages = [];
            this.pendingLabels = [];
            this.pendingZipFile = null;
            this.uploadMode = 'files';
            this.resetUploadProgress();
        },
        onDialogImagesSelected(event) {
            const files = Array.from(event.target.files || []);
            this.pendingImages = [...this.pendingImages, ...files];
            event.target.value = '';
        },
        onDialogLabelsSelected(event) {
            const files = Array.from(event.target.files || []);
            this.pendingLabels = [...this.pendingLabels, ...files];
            event.target.value = '';
        },
        onImagesDrop(event) {
            this.imageDragOver = false;
            const files = Array.from(event.dataTransfer.files || []);
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            if (imageFiles.length) {
                this.pendingImages = [...this.pendingImages, ...imageFiles];
            }
        },
        onLabelsDrop(event) {
            this.labelDragOver = false;
            const files = Array.from(event.dataTransfer.files || []);
            const labelExts = ['.txt', '.xml', '.json'];
            const labelFiles = files.filter(f => {
                const name = f.name.toLowerCase();
                return labelExts.some(ext => name.endsWith(ext));
            });
            if (labelFiles.length) {
                this.pendingLabels = [...this.pendingLabels, ...labelFiles];
            }
        },
        removeImage(idx) {
            this.pendingImages.splice(idx, 1);
        },
        removeLabel(idx) {
            this.pendingLabels.splice(idx, 1);
        },
        resetUploadProgress() {
            this.uploadPercent = 0;
            this.uploadLoaded = 0;
            this.uploadTotal = 0;
            this.uploadStage = 'idle';
            this.cancelUploadRequest = null;
        },
        handleDialogClose() {
            // 如果正在上传，阻止关闭
            if (this.isUploading) {
                return;
            }
            this.closeUploadDialog();
        },
                closeUploadDialog() {
            this.showUploadDialog = false;
            this.pendingImages = [];
            this.pendingLabels = [];
            this.pendingZipFile = null;
            this.uploadMode = 'files';
            this.resetUploadProgress();
        },
        cancelUpload() {
            if (typeof this.cancelUploadRequest === 'function') {
                this.cancelUploadRequest();
            }
        },
        // ZIP上传相关方法
        onDialogZipSelected(event) {
            const file = event.target.files && event.target.files[0];
            if (file && file.name.endsWith('.zip')) {
                this.pendingZipFile = file;
            }
            event.target.value = '';
        },
        onZipDrop(event) {
            this.zipDragOver = false;
            const file = event.dataTransfer.files && event.dataTransfer.files[0];
            if (file && file.name.endsWith('.zip')) {
                this.pendingZipFile = file;
            }
        },
        removeZipFile() {
            this.pendingZipFile = null;
        },
        formatFileSize(bytes) {
            if (!bytes) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB'];
            let i = 0;
            while (bytes >= 1024 && i < units.length - 1) {
                bytes /= 1024;
                i++;
            }
            return bytes.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
        },
        async submitZipUpload() {
            if (!this.pendingZipFile) {
                this.$message.warning('请选择ZIP文件');
                return;
            }

            this.isUploading = true;
            this.uploadStage = 'uploading';
            this.uploadPercent = 0;
            this.uploadLoaded = 0;
            this.uploadTotal = Number(this.pendingZipFile.size) || 0;
            try {
                const req = appendDatasetArchive(this.datasetId, this.pendingZipFile, {
                    onProgress: ({ loaded, total, percent }) => {
                        const l = Number(loaded) || 0;
                        const t = Number(total) || 0;
                        this.uploadLoaded = l;
                        if (t > 0) this.uploadTotal = t;
                        const pct = percent !== null && percent !== undefined
                            ? Number(percent) || 0
                            : (this.uploadTotal ? Math.round((this.uploadLoaded / this.uploadTotal) * 100) : 0);
                        this.uploadPercent = Math.max(0, Math.min(100, pct));
                    },
                    onUploadDone: () => {
                        this.uploadStage = 'processing';
                        this.uploadPercent = Math.max(this.uploadPercent, 100);
                    },
                });
                this.cancelUploadRequest = req.cancel;

                await req.promise;
                this.$message.success('ZIP上传成功');
                this.closeUploadDialog();
                // Refresh the dataset detail
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                const rawMsg = (error && error.message) ? String(error.message) : '上传失败';
                if (rawMsg.toLowerCase().includes('cancel')) {
                    this.$message.info('已取消上传');
                } else {
                    const msg = this.formatUploadErrorMessage(rawMsg);
                    this.$message.error(`上传失败: ${msg}`);
                }
            } finally {
                this.isUploading = false;
                this.cancelUploadRequest = null;
                this.uploadStage = 'idle';
            }
        },
        async submitUpload() {
            if (!this.pendingImages.length) {
                this.$message.warning('请至少选择一张图片');
                return;
            }

            this.isUploading = true;
            this.uploadStage = 'uploading';
            this.uploadPercent = 0;
            this.uploadLoaded = 0;
            this.uploadTotal = 0;
            try {
                const req = uploadDatasetImages(this.datasetId, this.pendingImages, {
                    relativeDir: 'images',
                    labels: this.pendingLabels,
                    labelsRelativeDir: this.pendingLabels.length ? 'labels' : null,
                    requireLabels: false,
                    createVersion: true,
                    activate: true,
                    onProgress: ({ loaded, total, percent }) => {
                        const l = Number(loaded) || 0;
                        const t = Number(total) || 0;
                        this.uploadLoaded = l;
                        if (t > 0) this.uploadTotal = t;
                        const pct = percent !== null && percent !== undefined
                            ? Number(percent) || 0
                            : (this.uploadTotal ? Math.round((this.uploadLoaded / this.uploadTotal) * 100) : 0);
                        this.uploadPercent = Math.max(0, Math.min(100, pct));
                    },
                    onUploadDone: () => {
                        this.uploadStage = 'processing';
                        this.uploadPercent = Math.max(this.uploadPercent, 100);
                    },
                });
                this.cancelUploadRequest = req.cancel;

                const result = await req.promise;
                this.$message.success(`成功上传 ${result.saved_count || this.pendingImages.length} 张图片`);
                this.closeUploadDialog();
                // Refresh the dataset detail
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                const rawMsg = (error && error.message) ? String(error.message) : '上传失败';
                if (rawMsg.toLowerCase().includes('cancel')) {
                    this.$message.info('已取消上传');
                } else {
                    const msg = this.formatUploadErrorMessage(rawMsg);
                    this.$message.error(`上传失败: ${msg}`);
                }
            } finally {
                this.isUploading = false;
                this.cancelUploadRequest = null;
                this.uploadStage = 'idle';
            }
        },
        async handleFilesSelected(event) {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;

            this.isUploading = true;
            try {
                const req = uploadDatasetImages(this.datasetId, files, {
                    relativeDir: 'images',
                    requireLabels: false,
                    createVersion: true,
                    activate: true,
                });
                const result = await req.promise;
                this.$message.success(`成功上传 ${result.saved_count || files.length} 张图片`);
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                const rawMsg = (error && error.message) ? String(error.message) : '上传失败';
                const msg = this.formatUploadErrorMessage(rawMsg);
                this.$message.error(`上传失败: ${msg}`);
            } finally {
                this.isUploading = false;
                event.target.value = '';
            }
        },

    }
}
</script>

<style scoped>
.dataset-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Hero */
.detail-hero {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  box-shadow: none;
  color: var(--text-main);
  position: relative;
  overflow: hidden;
}

.detail-hero::before {
    content: none;
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.back-link {
  align-self: flex-start;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.back-link:hover { background: #f3f4f6; color: var(--text-main); }

.hero-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.hero-kicker {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  opacity: 0.8;
  color: var(--color-primary);
}

.hero-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.meta-pill {
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-primary-dark);
  font-size: 0.75rem;
  font-weight: 600;
}

.meta-id {
  font-size: 0.8rem;
  opacity: 0.8;
}

.hero-right {
  display: flex;
  gap: 1rem;
  align-items: center;
  position: relative;
  z-index: 1;
}

.stat-card {
  min-width: 90px;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  text-align: center;
}

.stat-label { font-size: 0.7rem; color: var(--text-secondary); }
.stat-value { font-size: 1.125rem; font-weight: 700; color: var(--color-primary); margin-top: 0.25rem; }

/* Body */
.detail-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: hidden;
}

.loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--text-secondary);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  padding: 2rem;
  background: rgba(255,255,255,0.5);
  border-radius: var(--radius-lg);
  border: 1px dashed rgba(0,0,0,0.1);
}

.empty-title { font-size: 1.5rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem; }
.empty-desc { color: var(--text-secondary); margin-bottom: 1rem; }
.empty-processing-tip { margin-top: 0.75rem; color: #2563eb; font-size: 0.9rem; line-height: 1.5; }
.upload-reset-btn { margin-top: 0.75rem; }
.empty-tips { display: flex; gap: 1rem; font-size: 0.875rem; color: var(--text-secondary); }
.tip-item i { color: #10b981; margin-right: 0.25rem; }

/* Gallery Layout */
.gallery-layout {
  flex: 1;
  display: flex;
  gap: 1.5rem;
  min-height: 0;
}

.sidebar-panel {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.panel-head {
    margin-bottom: 0.5rem;
}

.panel-title { font-weight: 700; color: var(--text-main); font-size: 1rem; }
.panel-sub { font-size: 0.75rem; color: var(--text-secondary); }
.panel-subtitle { margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-secondary); }

.glass-input ::v-deep .el-input__inner {
    border: 1px solid rgba(0,0,0,0.1);
    background: rgba(255,255,255,0.5);
    border-radius: var(--radius-md);
}

.class-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.class-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255,255,255,0.3);
}

.class-list li:hover { background: rgba(255,255,255,0.8); }
.class-list li.selected { background: var(--color-primary); color: white; box-shadow: var(--shadow-md); }

.class-info { display: flex; align-items: center; gap: 0.75rem; overflow: hidden; flex: 1; min-width: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; }
.dot.all { background: #f59e0b; }
.selected .dot { background: white; }
.class-name { font-size: 0.875rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.class-count { font-size: 0.75rem; font-weight: 600; opacity: 0.7; flex-shrink: 0; }

/* 类别内联编辑 */
.class-info.editing { flex: 1; min-width: 0; }
.class-edit-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.875rem;
  font-weight: 500;
  outline: none;
  background: rgba(255,255,255,0.95);
  color: var(--text-main);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.class-edit-input:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.class-edit-input.is-saving {
  opacity: 0.6;
  cursor: not-allowed;
}
.selected .class-edit-input {
  color: var(--text-main);
}
.class-edit-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
}
.class-edit-btn {
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.class-edit-btn.confirm { color: #10b981; }
.class-edit-btn.confirm:hover { background: rgba(16, 185, 129, 0.15); }
.class-edit-btn.cancel { color: #ef4444; }
.class-edit-btn.cancel:hover { background: rgba(239, 68, 68, 0.15); }
.selected .class-edit-btn.confirm { color: #6ee7b7; }
.selected .class-edit-btn.cancel { color: #fca5a5; }
.class-edit-status {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--color-primary);
}

/* 标签编辑按钮 */
.edit-tag-btn {
  padding: 5px 14px !important;
  font-size: 0.8rem !important;
  font-weight: 500 !important;
  color: var(--color-primary) !important;
  border: 1px solid rgba(99, 102, 241, 0.2) !important;
  border-radius: 6px !important;
  transition: all 0.25s ease !important;
  flex-shrink: 0;
  text-decoration: none !important;
  box-shadow: 0 1px 3px rgba(99, 102, 241, 0.1);
  letter-spacing: 0.02em;
}

.edit-tag-btn:hover {
  text-decoration: none !important;
  transform: translateY(-1px);
}

.edit-tag-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(99, 102, 241, 0.15);
}

.edit-tag-btn span,
.edit-tag-btn:hover span {
  text-decoration: none !important;
}

.selected .edit-tag-btn {
  color: white !important;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.15) 100%) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.selected .edit-tag-btn:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0.25) 100%) !important;
  border-color: rgba(255, 255, 255, 0.45) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  text-decoration: none !important;
}
.highlight-text { background: rgba(255,255,0,0.3); color: inherit; }

.images-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: var(--radius-lg);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  min-width: 0;
}


.panel-actions { 
  display: flex; 
  align-items: center;
  gap: 0.5rem;
}

.images-panel .panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-card {
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md);
  padding: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.card-select {
  width: 100px;
}

.card-select ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  padding: 0 25px 0 10px;
  text-align: center;
  font-size: 0.85rem;
  color: #475569;
  height: 28px;
  line-height: 28px;
}

.card-select ::v-deep .el-input__icon {
  line-height: 28px;
}

.action-divider {
  width: 1px;
  height: 20px;
  background: #e2e8f0;
  margin: 0 8px;
}

.card-btn {
  background: #6366f1; /* Indigo-500 equivalent */
  color: white;
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  font-size: 0.8rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.2s;
  height: 28px;
  box-sizing: border-box;
}

.card-btn:hover {
  background: #4f46e5;
}

.card-btn.is-loading {
  background: #818cf8;
  cursor: not-allowed;
}

.count-badge { background: var(--bg-body); padding: 0.1rem 0.4rem; border-radius: var(--radius-full); font-size: 0.75rem; color: var(--text-secondary); margin-left: 0.5rem; }

.image-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  padding: 0.5rem;
  align-content: start;
}

.image-card {
  height: 200px;
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  border: 1px solid rgba(0,0,0,0.05);
}

.image-card:hover .image-overlay { opacity: 1; }
.image-wrapper { width: 100%; height: 100%; background: #f1f5f9; }
.image-wrapper img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0.75rem;
    opacity: 0;
    transition: opacity 0.2s;
    color: white;
}
.image-name { font-size: 0.8rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.image-meta { font-size: 0.7rem; opacity: 0.8; }

.no-images, .no-results {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    gap: 0.5rem;
    font-size: 0.9rem;
}

/* Modal */
.preview-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.8);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(5px);
}

.modal-card {
    max-width: 90vw;
    max-height: 90vh;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
    background: white;
}

.close-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-main);
    z-index: 10;
}

.modal-image-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    background: #f8fafc;
    border-radius: var(--radius-md);
    overflow: hidden;
}

.modal-canvas-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-image {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
}

.modal-overlay-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.modal-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.modal-info h3 { margin: 0; font-size: 1.25rem; }
.modal-meta-row { display: flex; gap: 0.5rem; font-size: 0.9rem; }
.modal-meta-row .label { color: var(--text-secondary); }
.modal-meta-row .value { color: var(--text-main); font-weight: 500; }
.modal-meta-row .value.error { color: #dc2626; }
.modal-meta-row .value.muted { color: var(--text-secondary); font-weight: 400; }

/* Upload Dialog */
.upload-dialog ::v-deep .el-dialog__header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 1rem;
}

.upload-dialog ::v-deep .el-dialog__body {
  padding: 1.5rem;
}

/* Convert Dialog */
.convert-dialog ::v-deep .el-dialog__body {
  padding: 1.25rem 1.5rem 1.5rem;
}

.convert-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.convert-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.convert-label {
  width: 90px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  flex-shrink: 0;
}

.convert-hint {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.split-dialog ::v-deep .el-dialog__body {
  padding: 1.25rem 1.5rem 1.5rem;
}

.augmentation-dialog ::v-deep .el-dialog__body {
  padding-top: 10px;
}

.split-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.split-suffix {
  color: var(--text-secondary);
}

.split-sum {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-left: 90px;
}

.split-sum.invalid {
  color: #ef4444;
  font-weight: 600;
}

/* Merge Dialog */
.merge-dialog ::v-deep .el-dialog__body {
  padding: 1.25rem 1.5rem 1.5rem;
}

.merge-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.merge-hint {
  color: #606266;
  margin: 0;
  font-size: 0.9rem;
}


.upload-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-main);
}

.section-count {
  font-size: 0.8rem;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.file-drop-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  border: 2px dashed #e2e8f0;
  border-radius: var(--radius-md);
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s;
}

.file-drop-area:hover {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.05);
}

.file-drop-area.drag-over {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.1);
  border-style: solid;
}

.file-drop-area i {
  font-size: 2rem;
  color: #94a3b8;
}

.file-drop-area span {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.file-drop-area .hint {
  font-size: 0.75rem;
  color: #94a3b8;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 150px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f1f5f9;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.file-item i {
  color: #64748b;
}

.file-item .file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-main);
}

.file-item .remove-btn {
  cursor: pointer;
  color: #94a3b8;
  transition: color 0.2s;
}

.file-item .remove-btn:hover {
  color: #ef4444;
}

.file-item.more {
  color: var(--text-secondary);
  font-style: italic;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.upload-progress {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.upload-progress-meta .stage {
  color: var(--text-main);
  font-weight: 600;
}

/* Upload Mode Switcher */
.upload-mode-switcher {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.upload-mode-switcher .el-radio-group {
  display: flex;
}

/* ZIP Upload Styles */
.zip-section {
  min-height: 200px;
}

.zip-drop-area {
  min-height: 120px;
  position: relative;
}

.zip-drop-area.has-file {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.05);
}

.zip-drop-area .zip-file-name {
  font-weight: 600;
  color: var(--text-main);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zip-drop-area .zip-file-size {
  color: #64748b;
  font-size: 0.8rem;
}

.zip-drop-area .remove-zip-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 1rem;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.2s;
}

.zip-drop-area .remove-zip-btn:hover {
  color: #ef4444;
}

.zip-structure-hint {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: var(--radius-sm);
  border: 1px solid #e2e8f0;
}

.zip-structure-hint .hint-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.zip-structure-hint .hint-tree {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
  background: transparent;
}

/* Illegal Section + Banner */
.illegal-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.illegal-banner {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(254, 243, 199, 0.4);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-md);
}
.illegal-icon {
  font-size: 24px;
  color: #f59e0b;
  margin-top: 2px;
}
.illegal-content {
  flex: 1;
}
.illegal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 8px;
}
.illegal-desc {
  font-size: 0.9rem;
  color: #b45309;
  margin-bottom: 8px;
}
.illegal-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(245, 158, 11, 0.15);
  border-radius: 12px;
  font-size: 0.8rem;
  color: #d97706;
  margin-bottom: 8px;
}
.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
}
.illegal-error {
  font-size: 0.85rem;
  color: #ef4444;
  margin-bottom: 8px;
}
.conversion-progress {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.conversion-progress-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.conversion-progress-label {
  font-size: 0.82rem;
  color: #92400e;
}
.conversion-reconnect-hint {
  font-size: 0.8rem;
  color: #b45309;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.preset-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: var(--radius-sm);
  background: rgba(248, 250, 252, 0.8);
}
.preset-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.preset-toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 0.78rem;
  color: var(--text-secondary);
}
.preset-mode-select {
  width: 150px;
}
.preset-dialog-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.preset-dialog-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
}
.preset-dialog-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.illegal-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 140px;
}
.action-btn {
  width: 100%;
  margin: 0 !important;
}


</style>
