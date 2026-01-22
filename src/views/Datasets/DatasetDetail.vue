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
                v-for="classInfo in filteredClassList"
                :key="classInfo.class_id"
                :class="{ 'selected': selectedClass && selectedClass.class_id === classInfo.class_id }"
                @click="selectClass(classInfo)"
              >
                <div class="class-info">
                    <span class="dot"></span>
                    <span class="class-name" v-html="input.trim() ? highlightText(classInfo.class_name, input) : classInfo.class_name"></span>
                </div>
                <span class="class-count">{{ classInfo.image_count }}</span>
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
              <div class="panel-actions">
                  <div class="action-card">
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
                    :src="image.image_url"
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

    <!-- Upload Dialog -->
    <el-dialog
      title="添加图片和标注"
      :visible.sync="showUploadDialog"
      width="520px"
      :close-on-click-modal="false"
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

      <div slot="footer" class="dialog-footer">
        <el-button @click="closeUploadDialog">取消</el-button>
        <el-button
          type="primary"
          :loading="isUploading"
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
import { FetchDatasetDetail, fetchDatasetVersions, uploadDatasetImages, appendDatasetArchive } from '@/api/datasets';
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
            isUploading: false,
            showUploadDialog: false,
            pendingImages: [],
            pendingLabels: [],
            imageDragOver: false,
            labelDragOver: false,
            // ZIP上传相关
            uploadMode: 'files',
            pendingZipFile: null,
            zipDragOver: false,
        }
    },
    created() {
        this.loadDataFromRoute();
    },
    mounted() {
        document.addEventListener('keydown', this.handleKeydown);
        this.debouncedSearch = this.debounce(() => {}, 300);
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleKeydown);
    },
    computed: {
        classList() {
            if (!this.datasetDetail || !this.datasetDetail.classes) return [];
            return this.datasetDetail.classes;
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
        }
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
        async loadDataFromRoute() {
            this.datasetId = this.$route.query.datasetId || '';
            this.datasetName = this.$route.query.datasetName || '';
            this.datasetType = this.$route.query.datasetType || '';
            this.numClasses = parseInt(this.$route.query.numClasses) || 0;
            this.numImages = parseInt(this.$route.query.numImages) || 0;
            this.datasetSize = this.$route.query.datasetSize || '0MB';
            this.selectedVersionId = null;
            this.versionOptions = [];
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
            if (!query || !query.trim()) return text;
            try {
                const regex = new RegExp(`(${query.trim()})`, 'gi');
                return text.replace(regex, '<span class="highlight-text">$1</span>');
            } catch (e) {
                return text;
            }
        },
        selectClass(classInfo) {
            this.selectedClass = classInfo;
            if (classInfo && classInfo.class_id !== undefined) {
                const filteredImages = this.imagesList.filter(img => {
                    const hasClass = img.classes_in_image &&
                        img.classes_in_image.includes(classInfo.class_id);
                    return hasClass;
                });
                const uniqueImages = filteredImages.filter((img, index, self) =>
                    index === self.findIndex(item => item.image_name === img.image_name)
                );
                this.selectedImages = uniqueImages;
            } else {
                const uniqueImages = this.imagesList.filter((img, index, self) =>
                    index === self.findIndex(item => item.image_name === img.image_name)
                );
                this.selectedImages = uniqueImages;
            }
        },
        handleImageError(event) {
            event.target.style.display = 'none';
            // Placeholder logic could go here
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
        handleUploadFail(errorMsg) {
            this.$message.error(`上传失败: ${errorMsg}`);
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
                const detail = await FetchDatasetDetail(this.datasetId, {
                    versionId: this.selectedVersionId,
                    filesLimit: 500,
                });
                this.datasetDetail = detail;
                
                if (detail.dataset_name) this.datasetName = detail.dataset_name;
                if (detail.dataset_type) this.datasetType = detail.dataset_type;
                if (detail.num_classes !== undefined) this.numClasses = detail.num_classes;
                if (detail.total_images !== undefined) this.numImages = detail.total_images;
                if (detail.dataset_size_mb) this.datasetSize = detail.dataset_size_mb;
                
            } catch (error) {
                console.error('Failed to fetch dataset detail:', error);
                this.datasetDetail = null;
            } finally {
                this.detailLoading = false;
            }
        },
        async handleVersionChange() {
            await this.fetchDatasetDetail();
        },
        handleAddImage() {
            // Open dialog instead of direct file selection
            this.showUploadDialog = true;
            this.pendingImages = [];
            this.pendingLabels = [];
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
        closeUploadDialog() {
            this.showUploadDialog = false;
            this.pendingImages = [];
            this.pendingLabels = [];
            this.pendingZipFile = null;
            this.uploadMode = 'files';
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
            try {
                await appendDatasetArchive(this.datasetId, this.pendingZipFile);
                this.$message.success('ZIP上传成功');
                this.closeUploadDialog();
                // Refresh the dataset detail
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                this.$message.error(`上传失败: ${error.message}`);
            } finally {
                this.isUploading = false;
            }
        },
        async submitUpload() {
            if (!this.pendingImages.length) {
                this.$message.warning('请至少选择一张图片');
                return;
            }

            this.isUploading = true;
            try {
                const result = await uploadDatasetImages(this.datasetId, this.pendingImages, {
                    relativeDir: 'images',
                    labels: this.pendingLabels,
                    labelsRelativeDir: this.pendingLabels.length ? 'labels' : null,
                    requireLabels: false,
                    createVersion: true,
                    activate: true,
                });
                this.$message.success(`成功上传 ${result.saved_count || this.pendingImages.length} 张图片`);
                this.closeUploadDialog();
                // Refresh the dataset detail
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                this.$message.error(`上传失败: ${error.message}`);
            } finally {
                this.isUploading = false;
            }
        },
        async handleFilesSelected(event) {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;

            this.isUploading = true;
            try {
                const result = await uploadDatasetImages(this.datasetId, files, {
                    relativeDir: 'images',
                    requireLabels: false,
                    createVersion: true,
                    activate: true,
                });
                this.$message.success(`成功上传 ${result.saved_count || files.length} 张图片`);
                // Refresh the dataset detail
                await this.refreshVersionsAndDetail({ forceLatest: true });
            } catch (error) {
                this.$message.error(`上传失败: ${error.message}`);
            } finally {
                this.isUploading = false;
                // Reset file input
                event.target.value = '';
            }
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

.class-info { display: flex; align-items: center; gap: 0.75rem; overflow: hidden; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; }
.dot.all { background: #f59e0b; }
.selected .dot { background: white; }
.class-name { font-size: 0.875rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.class-count { font-size: 0.75rem; font-weight: 600; opacity: 0.7; }
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
