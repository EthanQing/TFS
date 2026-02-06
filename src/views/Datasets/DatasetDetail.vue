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
        <div v-if="isIllegalDataset" class="illegal-banner">
          <div class="illegal-info">
            <div class="illegal-title">非法数据集</div>
            <div class="illegal-desc" v-if="illegalReason === 'labelme_json'">检测到 LabelMe JSON 标注，需要转换为 YOLO</div>
            <div class="illegal-desc" v-else-if="illegalReason === 'unsupported_json'">检测到不支持的 JSON 格式，暂不支持转换</div>
            <div class="illegal-desc" v-else>检测到非 YOLO 标注</div>
            <div v-if="conversionStatusText" class="illegal-status">转换状态：{{ conversionStatusText }}</div>
            <div v-if="conversionError" class="illegal-error">错误信息：{{ conversionError }}</div>
          </div>
          <div class="illegal-actions">
            <el-button
              v-if="conversionSupported"
              type="primary"
              size="small"
              :loading="convertingDataset"
              :disabled="conversionStatus === 'queued' || conversionStatus === 'running'"
              @click="openConvertDialog"
            >
              {{ conversionStatus === 'queued' || conversionStatus === 'running' ? '转换中' : '转换' }}
            </el-button>
            <el-button v-else size="small" disabled>暂不支持转换</el-button>
          </div>
        </div>

        <div v-if="isDatasetEmpty" class="empty-state">
          <div class="empty-content">
            <div class="empty-title">数据集为空</div>
            <div class="empty-desc">上传 ZIP 文件以初始化此数据集。</div>
            <div class="empty-tips">
              <span class="tip-item"><i class="el-icon-check"></i> 仅支持 .zip 文件</span>
              <span class="tip-item"><i class="el-icon-check"></i> 请保持文件夹结构</span>
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
          </div>
        </div>

        <div v-else class="gallery-layout">
          <aside class="sidebar-panel glass-panel-sm">
            <div class="panel-head">
              <div class="panel-title">类别</div>
              <div class="panel-sub">按类别筛选图片</div>
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
                @mouseenter="hoveredClassId = getClassId(classInfo, idx)"
                @mouseleave="handleClassMouseLeave()"
              >
                <div class="class-info">
                    <span class="dot"></span>
                    <span class="class-name" v-html="input.trim() ? highlightText(getClassName(classInfo), input) : getClassName(classInfo)"></span>
                </div>
                <span 
                  class="class-count" 
                  v-show="hoveredClassId !== getClassId(classInfo, idx)"
                >{{ classInfo && classInfo.image_count ? classInfo.image_count : 0 }}</span>
                <el-dropdown
                  v-show="hoveredClassId === getClassId(classInfo, idx)"
                  trigger="click"
                  @command="(cmd) => handleTagAction(cmd, classInfo)"
                  @visible-change="(visible) => handleDropdownVisibleChange(visible, classInfo, idx)"
                >
                  <el-button 
                    type="text" 
                    class="edit-tag-btn"
                    @click.stop
                  >
                    编辑 
                  </el-button>
                  <el-dropdown-menu slot="dropdown">
                    <el-dropdown-item command="rename" icon="el-icon-edit">修改名称</el-dropdown-item>
                    <el-dropdown-item command="delete" icon="el-icon-delete">删除标签</el-dropdown-item>
                    <el-dropdown-item command="merge" icon="el-icon-connection">合并标签</el-dropdown-item>
                  </el-dropdown-menu>
                </el-dropdown>
              </li>
            </ul>
            <div v-else class="no-results">
              <div class="no-desc">未找到类别 "{{ input }}"</div>
              <el-button type="text" @click="clearSearch">清除搜索 box</el-button>
            </div>
          </aside>

          <main class="images-panel">
            <div class="panel-head">
              <div class="panel-title">图片列表 <span class="count-badge">{{ selectedImages.length }}</span></div>
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
                    @error="handleImageError"
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
            <img
            :src="previewImage.image_url"
            :alt="previewImage.image_name"
            class="modal-image"
            @error="handleModalImageError"
            />
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

    <!-- Merge Tag Dialog -->
    <el-dialog
      title="合并标签"
      :visible.sync="showMergeDialog"
      width="420px"
      :close-on-click-modal="!mergeSubmitting"
      :close-on-press-escape="!mergeSubmitting"
      :append-to-body="true"
      class="merge-dialog"
    >
      <div class="merge-body">
        <p class="merge-hint">将标签 "{{ mergeSourceTag ? getClassName(mergeSourceTag) : '' }}" 合并到：</p>
        <el-select 
          v-model="mergeTargetTagId" 
          placeholder="请选择目标标签" 
          style="width: 100%"
          filterable
        >
          <el-option
            v-for="tag in mergeTargetOptions"
            :key="getClassId(tag)"
            :label="getClassName(tag)"
            :value="getClassId(tag)"
          ></el-option>
        </el-select>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button :disabled="mergeSubmitting" @click="showMergeDialog = false">取消</el-button>
        <el-button type="primary" :loading="mergeSubmitting" :disabled="!mergeTargetTagId" @click="submitMergeTag">确定合并</el-button>
      </div>
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
import { FetchDatasetDetail, FetchDatasetView, fetchDatasetVersions, uploadDatasetImages, appendDatasetArchive, convertIllegalDataset, fetchDatasetSplitSummary, splitDataset } from '@/api/datasets';
import UploadZip from '@/components/Upload/index.vue';
export default {
    name: 'DataDetail',
    components: { UploadZip },
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
            // 标签编辑相关
            hoveredClassId: null,
            tagDropdownOpen: false,
            // UploadZip组件状态（用于keep-alive状态保持）
            zipUploadFile: null,
            zipUploading: false,
            zipUploadProgress: 0,
            // Illegal dataset conversion
            showConvertDialog: false,
            convertingDataset: false,
            conversionTimer: null,
            convertForm: {
                labelStrategy: 'leaf',
                labelLevel: 2,
                labelSeparator: '%',
            },
            showSplitDialog: false,
            splitSubmitting: false,
            splitSummary: null,
            splitLoading: false,
            splitForm: {
                train: 90,
                val: 7,
                test: 3,
            },
            // 合并标签相关
            showMergeDialog: false,
            mergeSubmitting: false,
            mergeSourceTag: null,
            mergeTargetTagId: '',
        }
    },
    created() {
        this.loadDataFromRoute();
    },
    mounted() {
        document.addEventListener('keydown', this.handleKeydown);
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
        this.stopConversionPolling();
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
        conversionStatus() {
            const ver = this.datasetDetail && this.datasetDetail.active_version;
            const meta = ver && ver.meta;
            const conv = meta && meta.conversion;
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
        showPanelActions() {
            return this.showSplitButton || this.allowAppendUpload;
        },
        conversionStatusText() {
            const status = this.conversionStatus;
            const map = { queued: '排队中', running: '转换中', completed: '已完成', failed: '失败', pending: '待转换' };
            return status ? (map[status] || status) : '';
        },
        conversionError() {
            const ver = this.datasetDetail && this.datasetDetail.active_version;
            const meta = ver && ver.meta;
            const conv = meta && meta.conversion;
            return conv && conv.error_message ? conv.error_message : '';
        },
        mergeTargetOptions() {
            if (!this.mergeSourceTag) return this.classList;
            return this.classList.filter(c => this.getClassId(c) !== this.getClassId(this.mergeSourceTag));
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
                if (newDetail) {
                    const current = this.selectedClass ? this.classList.find(c => c.class_id === this.selectedClass.class_id) : null;
                    this.selectClass(current || null);
                }
            },
            immediate: true
        }
    },
    methods: {
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
        async loadDataFromRoute() {
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
            await this.refreshVersionsAndDetail({ forceLatest: true });
        },
        async refreshVersionsAndDetail({ forceLatest = false } = {}) {
            if (!this.datasetId) return;
            await this.loadDatasetVersions({ forceLatest });
            await this.fetchDatasetDetail();
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
        async selectClass(classInfo) {
            this.selectedClass = classInfo;
            console.log("Selected class:", classInfo);
            
            // Use server-side filtering via the view API
            try {
                const classId = classInfo && classInfo.class_id !== undefined ? classInfo.class_id : null;
                const viewData = await FetchDatasetView(this.datasetId, {
                    versionId: this.selectedVersionId,
                    classId: classId,
                    page: 1,
                    pageSize: 500,
                });
                this.selectedImages = viewData.items || [];
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
            }
        },
        handleImageError(event) {
            const img = event.target;
            const currentSrc = img.src || '';
            
            // If static thumbnail failed, try API endpoint as fallback (on-demand generation)
            if (currentSrc.includes('/static/thumbnails/')) {
                // Extract dataset_id and path from static URL
                // Format: /static/thumbnails/{dataset_id}/{path}.webp
                const match = currentSrc.match(/\/static\/thumbnails\/(\d+)\/(.+)\.webp/);
                if (match) {
                    const datasetId = match[1];
                    // Convert path.webp back to original extension
                    const relPath = match[2];
                    // Try API endpoint which generates on-demand
                    const apiUrl = `/api/v2/thumbnails/${datasetId}/images/${relPath}.jpg`;
                    img.src = apiUrl;
                    img.dataset.fallback = 'api';
                    return;
                }
            }
            
            // If API also failed or already tried, hide the image
            img.style.display = 'none';
        },
        openImagePreview(image) {
            this.previewImage = image;
            this.showImagePreview = true;
        },
        closeImagePreview() {
            this.showImagePreview = false;
            this.previewImage = null;
        },
        handleModalImageError(event) {
            event.target.style.display = 'none';
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
        handleUploadSuccess() {
            this.$message.success('上传成功，正在刷新数据集。');
            this.refreshVersionsAndDetail({ forceLatest: true });
        },
        openSplitDialog() {
          if (!this.showSplitButton) return;
          this.splitForm = { train: 90, val: 7, test: 3 };
          this.showSplitDialog = true;
        },
        openConvertDialog() {
          if (!this.conversionSupported) {
            this.$message.warning('该数据集不支持转换');
            return;
          }
          this.showConvertDialog = true;
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
            await convertIllegalDataset(this.datasetId, {
              labelStrategy: strategy,
              labelLevel: this.convertForm.labelLevel,
              labelSeparator: this.convertForm.labelSeparator,
            });
            this.$message.success('转换任务已提交');
            this.showConvertDialog = false;
            this.startConversionPolling();
          } catch (e) {
            const msg = e && e.message ? String(e.message) : '转换失败';
            this.$message.error(`转换失败: ${msg}`);
          } finally {
            this.convertingDataset = false;
          }
        },
        startConversionPolling() {
          if (this.conversionTimer) {
            clearInterval(this.conversionTimer);
            this.conversionTimer = null;
          }
          // Track the version ID before conversion to detect change
          const startVersionId = this.datasetDetail?.active_version?.version_id;
          const startTime = Date.now();
          const TIMEOUT_MS = 120000; // 2 minutes timeout
          
          console.log('[Conversion] Starting poll, initial version:', startVersionId);
          
          this.conversionTimer = setInterval(async () => {
            // Check timeout
            if (Date.now() - startTime > TIMEOUT_MS) {
              this.stopConversionPolling();
              console.log('[Conversion] Polling timed out, forcing page reload...');
              this.$message.warning('转换超时，正在刷新页面...');
              setTimeout(() => window.location.reload(), 500);
              return;
            }
            
            try {
              // Fetch WITHOUT version ID to get the current active version
              const detail = await FetchDatasetDetail(this.datasetId, {
                versionId: null, // Important: don't use selectedVersionId
                filesLimit: 1,
              });
              
              const ver = detail && detail.active_version;
              const meta = ver && ver.meta;
              const conv = meta && meta.conversion;
              const status = conv ? (conv.status || '') : '';
              const currentVersionId = ver?.version_id;
              const isNewVersion = startVersionId && currentVersionId && currentVersionId !== startVersionId;
              const isIllegal = !!(meta && meta.illegal);
              
              console.log('[Conversion] Poll result:', { 
                status, 
                currentVersionId, 
                isNewVersion, 
                verStatus: ver?.status,
                isIllegal,
                elapsed: Math.round((Date.now() - startTime) / 1000) + 's'
              });
              
              if (status === 'failed') {
                this.stopConversionPolling();
                const err = (conv && conv.error_message) || '转换失败';
                this.$message.error(`转换失败: ${err}`);
                return;
              }
              
              // Success: new version is active (version ID changed and new version is finalized and not illegal)
              if (isNewVersion && ver.status === 'finalized' && !isIllegal) {
                this.stopConversionPolling();
                this.$message.success('转换完成，正在刷新页面...');
                console.log('[Conversion] Success detected, reloading page...');
                setTimeout(() => window.location.reload(), 500);
              }
            } catch (e) {
              console.error('[Conversion] Poll error:', e);
            }
          }, 4000);
        },
        stopConversionPolling() {
          if (this.conversionTimer) {
            clearInterval(this.conversionTimer);
            this.conversionTimer = null;
          }
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
        async fetchDatasetDetail() {
            if (!this.datasetId) return;

            this.detailLoading = true;
            try {
                // First get basic detail for dataset info
                const detail = await FetchDatasetDetail(this.datasetId, {
                    versionId: this.selectedVersionId,
                    filesLimit: 10, // Minimal for basic info
                });
                
                if (detail.dataset_name) this.datasetName = detail.dataset_name;
                if (detail.dataset_type) this.datasetType = detail.dataset_type;
                if (detail.dataset_size_mb) this.datasetSize = detail.dataset_size_mb;
                
                // Then get view data with categories and images
                try {
                    const viewData = await FetchDatasetView(this.datasetId, {
                        versionId: this.selectedVersionId,
                        classId: null, // No filter initially
                        page: 1,
                        pageSize: 500,
                    });
                    
                    // Merge view data into detail object
                    this.datasetDetail = {
                        ...detail,
                        categories: viewData.categories || [],
                        images: viewData.items || [],
                        total_images: viewData.meta?.total_items || viewData.items?.length || 0,
                    };
                    
                    // Update stats from view data
                    this.numClasses = (viewData.categories || []).length;
                    this.numImages = viewData.meta?.total_items || 0;
                    
                    // Set selected images initially
                    this.selectedImages = viewData.items || [];
                } catch (viewError) {
                    console.warn('View API failed, falling back to detail:', viewError);
                    this.datasetDetail = detail;
                    if (detail.num_classes !== undefined) this.numClasses = detail.num_classes;
                    if (detail.total_images !== undefined) this.numImages = detail.total_images;
                    this.selectedImages = detail.images || [];
                }

                await this.fetchSplitSummary();

                const status = this.conversionStatus;
                if (this.isIllegalDataset && (status === 'queued' || status === 'running')) {
                    if (!this.conversionTimer) this.startConversionPolling();
                } else {
                    this.stopConversionPolling();
                }

            } catch (error) {
                console.error('Failed to fetch dataset detail:', error);
                this.datasetDetail = null;
            } finally {
                this.detailLoading = false;
            }
        },
        async fetchSplitSummary() {
            if (!this.datasetId) return;
            if (!this.isDetectionDataset || this.isIllegalDataset) {
                this.splitSummary = null;
                return;
            }
            this.splitLoading = true;
            try {
                const summary = await fetchDatasetSplitSummary(this.datasetId, {
                    versionId: this.selectedVersionId,
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
        handleClassMouseLeave() {
            // 如果下拉菜单打开，不隐藏编辑按钮
            if (!this.tagDropdownOpen) {
                this.hoveredClassId = null;
            }
        },
        handleDropdownVisibleChange(visible, classInfo, idx) {
            this.tagDropdownOpen = visible;
            if (!visible) {
                // 下拉菜单关闭后，检查鼠标是否还在该项上
                this.hoveredClassId = null;
            }
        },
        handleTagAction(command, classInfo) {
            const className = this.getClassName(classInfo);
            switch (command) {
                case 'rename':
                    this.$prompt('请输入新的标签名称', '修改标签名称', {
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                        inputValue: className,
                        inputPattern: /^.+$/,
                        inputErrorMessage: '标签名称不能为空'
                    }).then(({ value }) => {
                        if (value && value !== className) {
                            // TODO: 调用API修改标签名称
                            console.log('Rename tag:', classInfo, 'to', value);
                            this.$message.info(`重命名标签: ${className} → ${value} (待实现)`);
                        }
                    }).catch(() => {});
                    break;
                case 'delete':
                    this.$confirm(`确定要删除标签 "${className}" 吗？该操作会移除所有相关标注。`, '删除标签', {
                        confirmButtonText: '确定删除',
                        cancelButtonText: '取消',
                        type: 'warning'
                    }).then(() => {
                        // TODO: 调用API删除标签
                        console.log('Delete tag:', classInfo);
                        this.$message.info(`删除标签: ${className} (待实现)`);
                    }).catch(() => {});
                    break;
                case 'merge':
                    // 获取其他可合并的标签
                    const otherTags = this.classList.filter(c => this.getClassId(c) !== this.getClassId(classInfo));
                    if (otherTags.length === 0) {
                        this.$message.warning('没有其他标签可供合并');
                        return;
                    }
                    // 打开合并对话框
                    this.mergeSourceTag = classInfo;
                    this.mergeTargetTagId = '';
                    this.showMergeDialog = true;
                    break;
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
                // Refresh the dataset detail
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                const rawMsg = (error && error.message) ? String(error.message) : '上传失败';
                const msg = this.formatUploadErrorMessage(rawMsg);
                this.$message.error(`上传失败: ${msg}`);
            } finally {
                this.isUploading = false;
                // Reset file input
                event.target.value = '';
            }
        },
        submitMergeTag() {
            if (!this.mergeTargetTagId || !this.mergeSourceTag) {
                this.$message.warning('请选择目标标签');
                return;
            }
            const targetTag = this.mergeTargetOptions.find(t => this.getClassId(t) === this.mergeTargetTagId);
            const sourceName = this.getClassName(this.mergeSourceTag);
            const targetName = this.getClassName(targetTag);
            
            // TODO: 调用API合并标签
            console.log('Merge tag:', this.mergeSourceTag, 'into', targetTag);
            this.$message.info(`合并标签: ${sourceName} → ${targetName} (待实现)`);
            
            this.showMergeDialog = false;
            this.mergeSourceTag = null;
            this.mergeTargetTagId = '';
        }
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
  padding: 0.25rem 0.75rem;
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
.image-wrapper img { width: 100%; height: 100%; object-fit: cover; }
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

.modal-image {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
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
</style>
