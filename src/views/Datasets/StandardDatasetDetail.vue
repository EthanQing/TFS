<template>
  <div class="dataset-detail-page page-container">
    <header class="detail-hero">
      <div class="hero-left">
        <button class="back-link" type="button" @click="goBack">
          <i class="el-icon-arrow-left"></i> 返回数据集列表
        </button>
        <div class="hero-content">
            <div class="hero-kicker">标准数据集概览</div>
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
        <!-- For Standard Dataset, directly show the gallery layout, or an empty state if no images -->
        <div v-if="isDatasetEmpty" class="empty-state">
          <div class="empty-content">
            <div class="empty-title">{{ emptyStateTitle }}</div>
            <div class="empty-desc">{{ emptyStateDesc }}</div>
            <div class="empty-tips">
              <span class="tip-item"><i class="el-icon-check"></i> 仅支持 .zip 文件</span>
              <span class="tip-item"><i class="el-icon-check"></i> 请保持符合 YOLO/COCO 的文件夹结构</span>
            </div>
            <div v-if="zipUploading" class="empty-processing-tip">
              {{ emptyProcessingTip }}
            </div>
          </div>
          <div class="empty-action">
            <UploadZip
              :dataset-id="datasetId"
              :is-illegal="false"
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
              >
                <div class="class-info">
                  <span class="dot"></span>
                  <span class="class-name" v-html="input.trim() ? highlightText(getClassName(classInfo), input) : getClassName(classInfo)"></span>
                </div>
                <span class="class-count">{{ classInfo && classInfo.image_count ? classInfo.image_count : 0 }}</span>
              </li>
            </ul>
            <div v-else class="no-results">
              <div class="no-desc">未找到类别 "{{ input }}"</div>
              <el-button type="text" @click="clearSearch">清除搜索</el-button>
            </div>
          </aside>

          <main class="images-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">图片列表 <span class="count-badge">{{ selectedImages.length }}</span></div>
                <div v-if="viewStatusText" class="panel-subtitle">{{ viewStatusText }}</div>
              </div>
              <div class="panel-actions">
                <el-button
                  size="small"
                  type="success"
                  plain
                  @click="openAugmentationDialog"
                >
                  <i class="el-icon-magic-stick"></i> 样本扩增
                </el-button>
                <div class="action-card" v-if="allowAppendUpload">
                    <!-- Placeholder for append upload later if supported natively -->
                    <el-button size="small" type="primary" plain @click="handleAddImage">
                      <i class="el-icon-plus"></i> 追加图片
                    </el-button>
                </div>
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

    <!-- Upload Dialog -->
    <el-dialog
      v-if="allowAppendUpload"
      title="追加上传"
      :visible.sync="showUploadDialog"
      width="520px"
      :close-on-click-modal="false"
      class="upload-dialog"
    >
        <UploadZip
            :dataset-id="datasetId"
            :is-illegal="false"
            :external-file.sync="zipUploadFile"
            :external-uploading.sync="zipUploading"
            :external-progress.sync="zipUploadProgress"
            @upload-success="handleUploadSuccess"
            @upload-fail="handleUploadFail"
        ></UploadZip>
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
        @published="handleAugmentationPublished"
      />
    </el-dialog>

  </div>
</template>

<script>
import {
  fetchStandardDataset,
  fetchStandardDatasetView,
  fetchStandardDatasetAnnotations,
  fetchStandardDatasetStatistics
} from '@/api/standardDatasets';
import UploadZip from '@/components/Upload/index.vue';
import ManualAugmentationPanel from '@/views/Datasets/components/ManualAugmentationPanel.vue';

export default {
  name: 'StandardDatasetDetail',
  components: { UploadZip, ManualAugmentationPanel },
  data() {
    return {
      datasetId: '',
      datasetName: '',
      datasetType: '',
      numClasses: 0,
      numImages: 0,
      datasetSize: '',
      detailLoading: false,

      // View
      datasetDetail: null,
      input: '',
      selectedClass: null,
      selectedImages: [],
      classList: [],
      viewStatusText: '',
      viewRequestToken: 0,
      searchTimeout: null,
      
      // Upload ZIP
      zipUploadFile: null,
      zipUploading: false,
      zipUploadProgress: 0,
      showUploadDialog: false,
      allowAppendUpload: true, // we assume append via zip is supported

      // Preview
      showImagePreview: false,
      previewImage: null,
      previewAnnotationsLoading: false,
      previewAnnotationsError: '',
      previewAnnotationData: null,
      previewBoxCount: 0,
      
      showAugmentationDialog: false,
    };
  },
  computed: {
    isDatasetEmpty() {
      return this.numImages === 0;
    },
    emptyStateTitle() {
      if (this.zipUploadProgress > 0 && this.zipUploadProgress < 100 && !this.zipUploading) return "上传已中断";
      return "数据集为空";
    },
    emptyStateDesc() {
      return "请上传ZIP压缩包。格式必须为所选的标准格式（YOLO/COCO）";
    },
    emptyProcessingTip() {
      if (this.zipUploadProgress >= 100) return "正在服务器端解压并处理数据，这可能需要几分钟...";
      return `正在上传... ${this.zipUploadProgress}%`;
    },
    filteredClassList() {
      if (!this.input.trim()) return this.classList;
      const term = this.input.trim().toLowerCase();
      return this.classList.filter(c => {
        const name = this.getClassName(c).toLowerCase();
        return name.includes(term);
      });
    },
    isDetectionDataset() {
      return this.datasetType === 'detection' || !this.datasetType;
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
        const data = await fetchStandardDataset(this.datasetId);
        if (!data) throw new Error("Dataset not found");
        
        this.datasetName = data.name || data.dataset_name;
        this.datasetType = data.dataset_type || data.type;
        
        // statistics
        const stats = await fetchStandardDatasetStatistics(this.datasetId);
        this.numClasses = stats.num_classes || 0;
        this.numImages = stats.num_images || 0;
        this.datasetSize = stats.dataset_size_mb || '0MB';

        if (!this.isDatasetEmpty) {
            this.loadView();
        }

      } catch (e) {
        this.$message.error("Failed to load standard dataset details: " + e.message);
      } finally {
        this.detailLoading = false;
      }
    },
    async loadView() {
      try {
        this.viewRequestToken++;
        const token = this.viewRequestToken;
        const cid = this.selectedClass ? this.getClassId(this.selectedClass) : null;
        this.viewStatusText = '加载中...';
        
        const res = await fetchStandardDatasetView(this.datasetId, { classId: cid, page: 1, pageSize: 200 });
        if (token !== this.viewRequestToken) return;

        this.datasetDetail = res;
        this.classList = Array.isArray(res.categories) ? res.categories : [];
        this.selectedImages = Array.isArray(res.items) ? res.items : [];
        
        if (res.meta) {
            if (res.meta.thumbnail_status === 'processing') {
                this.viewStatusText = `正在生成缩略图 (${Math.round(res.meta.thumbnail_progress || 0)}%)`;
                setTimeout(() => this.loadView(), 3000);
            } else if (res.meta.view_index_status === 'processing') {
                this.viewStatusText = `正在建立视图索引...`;
                setTimeout(() => this.loadView(), 3000);
            } else {
                this.viewStatusText = '';
            }
        } else {
            this.viewStatusText = '';
        }

      } catch (e) {
        this.viewStatusText = '加载视图失败';
        console.error("View load failed:", e);
      }
    },
    
    // UI actions
    handleSearchInput() {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {}, 300);
    },
    clearSearch() {
      this.input = '';
    },
    selectClass(classInfo) {
      if (this.isSelectedClass(classInfo)) return;
      this.selectedClass = classInfo;
      this.loadView();
    },
    isSelectedClass(classInfo) {
      if (!this.selectedClass && !classInfo) return true;
      if (!this.selectedClass || !classInfo) return false;
      return this.getClassId(this.selectedClass) === this.getClassId(classInfo);
    },
    getClassId(c) {
      return c ? (c.id != null ? String(c.id) : String(c.name)) : '';
    },
    getClassName(c) {
      return c ? (c.name || c.id || 'Unknown') : '';
    },
    getClassNames(ids) {
        if (!Array.isArray(ids)) return '';
        const names = ids.map(id => {
            const cat = this.classList.find(c => String(c.id) === String(id));
            return cat ? cat.name : String(id);
        });
        return names.join(', ');
    },
    highlightText(text, term) {
      if (!term || !text) return text;
      const t = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${t})`, 'gi');
      return String(text).replace(regex, '<span class="highlight">$1</span>');
    },

    // Preview
    openImagePreview(image) {
      this.previewImage = image;
      this.showImagePreview = true;
      this.previewBoxCount = 0;
      this.previewAnnotationsError = '';
      this.previewAnnotationData = null;
      if (this.isDetectionDataset) {
        this.loadPreviewAnnotations(image);
      }
    },
    closeImagePreview() {
      this.showImagePreview = false;
      this.previewImage = null;
    },
    handleImageError(e, image) {
      const img = e.target;
      if (image && image.image_url && img.src !== image.image_url) {
        img.src = image.image_url;
      }
    },
    handlePreviewImageLoad() {
      this.drawAnnotations();
    },
    handleModalImageError(e) {
      this.previewAnnotationsError = '图片加载失败';
    },
    async loadPreviewAnnotations(image) {
      this.previewRequestToken++;
      const token = this.previewRequestToken;
      this.previewAnnotationsLoading = true;
      try {
        const data = await fetchStandardDatasetAnnotations(this.datasetId, image.image_path);
        if (token !== this.previewRequestToken) return;
        this.previewAnnotationData = data;
        this.previewBoxCount = Array.isArray(data.boxes) ? data.boxes.length : 0;
        this.$nextTick(() => {
          this.drawAnnotations();
        });
      } catch (e) {
        if (token === this.previewRequestToken) {
          this.previewAnnotationsError = e.message || '获取标注失败';
          this.previewAnnotationData = null;
        }
      } finally {
        if (token === this.previewRequestToken) {
          this.previewAnnotationsLoading = false;
        }
      }
    },
    drawAnnotations() {
      if (!this.previewAnnotationData || !this.isDetectionDataset || !this.showImagePreview) return;
      const canvas = this.$refs.previewCanvas;
      const img = this.$refs.previewModalImage;
      const wrap = this.$refs.previewCanvasWrap;
      if (!canvas || !img || !wrap) return;

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      if (!imgW || !imgH) return;

      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const rect = img.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const offsetX = rect.left - wrapRect.left;
      const offsetY = rect.top - wrapRect.top;
      const drawW = rect.width;
      const drawH = rect.height;

      const boxes = this.previewAnnotationData.boxes || [];
      ctx.lineWidth = 2;
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'top';

      boxes.forEach(box => {
        let x, y, w, h;
        if (box.x1 !== undefined && box.x2 !== undefined) {
          x = box.x1 * drawW;
          y = box.y1 * drawH;
          w = (box.x2 - box.x1) * drawW;
          h = (box.y2 - box.y1) * drawH;
        } else if (box.cx !== undefined && box.w !== undefined) {
          w = box.w * drawW;
          h = box.h * drawH;
          x = (box.cx - box.w / 2) * drawW;
          y = (box.cy - box.h / 2) * drawH;
        } else {
          return;
        }

        const absX = offsetX + x;
        const absY = offsetY + y;
        
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.strokeRect(absX, absY, w, h);

        const className = this.getClassName(this.classList.find(c => c.id === box.class_id)) || box.class_name || `Cls ${box.class_id}`;
        const textW = ctx.measureText(className).width + 6;
        const textH = 16;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillRect(absX, Math.max(offsetY, absY - textH), textW, textH);
        ctx.fillStyle = '#000';
        ctx.fillText(className, absX + 3, Math.max(offsetY, absY - textH) + 2);
      });
    },

    // ZIP upload
    handleAddImage() {
        this.showUploadDialog = true;
    },
    handleUploadSuccess() {
      this.zipUploading = false;
      this.zipUploadProgress = 0;
      this.zipUploadFile = null;
      this.showUploadDialog = false;
      this.$message.success("数据上传并入库成功！");
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
    },

    // Augmentation
    openAugmentationDialog() {
      this.showAugmentationDialog = true;
    },
    handleAugmentationPublished() {
      this.showAugmentationDialog = false;
      this.$message.success("增强数据集已发布！");
      this.loadDetail();
    }
  },
  mounted() {
    this.datasetId = this.$route.query.id;
    if (this.datasetId) {
        this.loadDetail();
    } else {
        this.$message.error("未找到数据集ID");
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
  height: 100%;
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

/* Gallery Layout */
.gallery-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  height: calc(100vh - 280px);
  min-height: 500px;
}

.sidebar-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-head {
  padding: 20px;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
}

.panel-sub {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.search-box {
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
}

.glass-input ::v-deep .el-input__inner {
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.class-list {
  list-style: none;
  padding: 12px;
  margin: 0;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.class-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  border: 1px solid transparent;
}

.class-list li:hover {
  background: var(--bg-body);
}

.class-list li.selected {
  background: var(--color-primary-light);
  border-color: var(--color-primary-subtle);
}

.class-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.class-info .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-primary);
}

.class-info .dot.all {
  background: var(--color-success);
}

.class-name {
  font-size: 0.95rem;
  color: var(--text-main);
  font-weight: 500;
}

.class-list li.selected .class-name {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.class-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
  background: var(--bg-body);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  min-width: 32px;
  text-align: center;
}

.class-list li.selected .class-count {
  background: white;
  color: var(--color-primary);
  font-weight: 600;
}

.no-results {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary);
}

.images-panel {
  flex: 1;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.count-badge {
  display: inline-block;
  background: var(--bg-body);
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  margin-left: 8px;
  vertical-align: middle;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-card {
  display: flex;
  align-items: center;
  background: var(--bg-body);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  padding: 2px;
}

.no-images {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-light);
  gap: 16px;
}

.no-images i {
  font-size: 4rem;
}

.image-grid {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  align-content: start;
}

.image-card {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-body);
  cursor: pointer;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-subtle);
}

.image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.image-wrapper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 16px 12px 12px;
  color: white;
  pointer-events: none;
}

.image-name {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-meta {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 4px;
}

/* Modal */
.preview-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 1200px;
  height: 90vh;
  display: flex;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: none;
  color: var(--text-main);
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-body);
  color: var(--color-danger);
  transform: rotate(90deg);
}

.modal-image-wrapper {
  flex: 1;
  background: #000;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-image {
  max-width: 100%;
  max-height: 100%;
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
  width: 320px;
  background: var(--bg-card);
  border-left: 1px solid var(--border-light);
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.modal-info h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
  word-break: break-all;
}

.modal-meta-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-meta-row .label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.modal-meta-row .value {
  font-size: 1rem;
  color: var(--text-main);
  font-weight: 500;
}

.modal-meta-row .value.error {
  color: var(--color-danger);
}

.modal-meta-row .value.muted {
  color: var(--text-light);
  font-style: italic;
}

.panel-subtitle {
  font-size: 0.85rem;
  color: var(--color-primary);
  margin-top: 4px;
}
</style>
