<template>
  <div class="dataset-detail-page page-container">
    <header class="detail-hero">
      <div class="hero-left">
        <button class="back-link" type="button" @click="goBack">
          <i class="el-icon-arrow-left"></i> 返回数据集列表
        </button>
        <div class="hero-content">
          <div class="hero-kicker">标准数据集</div>
          <h1 class="hero-title">{{ datasetName || '未命名标准数据集' }}</h1>
          <div class="hero-meta">
            <span class="meta-pill success">{{ datasetTypeLabel }}</span>
            <span class="meta-pill info">{{ datasetFormat }}</span>
            <span class="meta-id">ID: {{ datasetId || '-' }}</span>
          </div>
        </div>
      </div>
      <div class="hero-right">
        <div class="stat-card">
          <div class="stat-label">图片数</div>
          <div class="stat-value">{{ formatNumber(totalImages) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">类别数</div>
          <div class="stat-value">{{ formatNumber(classCount) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">大小</div>
          <div class="stat-value">{{ datasetSizeText }}</div>
        </div>
      </div>
    </header>

    <section class="detail-body glass-panel">
      <div v-if="loading" class="loading-state">
        <i class="el-icon-loading"></i>
        <span>正在加载标准数据集详情...</span>
      </div>

      <template v-else>
        <div v-if="isEmpty" class="empty-state">
          <div class="empty-content">
            <div class="empty-title">当前标准数据集还是空的</div>
            <div class="empty-desc">
              请上传一个符合 YOLO 结构的 ZIP 包。标准数据集不支持追加版本，如需新内容请创建或发布一个新的标准数据集。
            </div>
            <div class="empty-tips">
              <span class="tip-item"><i class="el-icon-check"></i> 输出格式固定为 YOLO</span>
              <span class="tip-item"><i class="el-icon-check"></i> 标准数据集不可追加版本</span>
            </div>
          </div>
          <div class="empty-action">
            <UploadZip :dataset-id="datasetId" dataset-kind="standard" mode="upload" :external-file.sync="uploadFile"
              :external-uploading.sync="uploading" :external-progress.sync="uploadProgress"
              @upload-success="handleUploadSuccess" @upload-fail="handleUploadFail" />
          </div>
        </div>

        <div v-else class="gallery-layout">
          <aside class="sidebar-panel glass-panel-sm">
            <div class="panel-head">
              <div class="panel-title">类别</div>
              <div class="panel-sub">按类别筛选图片</div>
            </div>

            <!-- <div class="dataset-info-card">
              <div class="info-line"><span>来源</span><strong>{{ sourceText }}</strong></div>
              <div class="info-line"><span>创建时间</span><strong>{{ formatDate(dataset && dataset.created_at) }}</strong>
              </div>
            </div> -->
            <div class="search-box">
              <el-input v-model="input" placeholder="搜索类别..." prefix-icon="el-icon-search" class="glass-input"
                clearable />
            </div>

            <ul class="class-list" v-if="filteredClassList.length || !input.trim()">
              <li class="all-option" :class="{ selected: selectedClassId === null }" @click="selectClass(null)">
                <div class="class-info">
                  <span class="dot all"></span>
                  <span class="class-name">全部类别</span>
                </div>
                <span class="class-count">{{ formatNumber(totalImages) }}</span>
              </li>
              <li v-for="(classInfo, idx) in filteredClassList" :key="getClassId(classInfo, idx)"
                :class="{ selected: isSelectedClass(classInfo) }" @click="selectClass(classInfo.class_id)">
                <div class="class-info">
                  <span class="dot"></span>
                  <span class="class-name">{{ getClassName(classInfo) }}</span>
                </div>
                <span class="class-count">{{ classInfo && classInfo.count ? classInfo.count : 0 }}</span>
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
                <div class="panel-subtitle">
                  {{ selectedClassId === null ? '显示全部类别图片' : `当前类别：${selectedClassName}` }}
                  <span v-if="hasSplit" class="split-hint">· 当前划分 {{ splitSummaryText }}</span>
                </div>
              </div>
              <div class="panel-actions">
                <el-button size="small" @click="refreshAll">刷新</el-button>
                <el-button v-if="canSplitDataset" size="small" type="primary" plain
                  :loading="splitSubmitting || splitLoading" @click="openSplitDialog">
                  数据集划分
                </el-button>
                <el-button size="small" type="success" plain @click="openAugmentationDialog">
                  <i class="el-icon-magic-stick"></i> 样本扩增
                </el-button>
              </div>
            </div>

            <div v-if="selectedImages.length === 0" class="no-images">
              <i class="el-icon-picture-outline"></i>
              <span>暂无图片显示</span>
            </div>
            <div v-else class="image-grid">
              <div v-for="(image, index) in selectedImages" :key="`${image.image_name}-${index}`" class="image-card"
                @click="openImagePreview(image)">
                <div class="image-wrapper">
                  <img :src="image.thumbnail_url || image.image_url" :alt="image.image_name" loading="lazy"
                    @error="handleImageError($event, image)" />
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

    <div v-if="showImagePreview" class="preview-modal" @click="closeImagePreview">
      <div class="modal-card glass-panel" @click.stop>
        <button class="close-btn" @click="closeImagePreview"><i class="el-icon-close"></i></button>
        <div class="modal-image-wrapper">
          <div ref="previewCanvasWrap" class="modal-canvas-wrap">
            <img ref="previewModalImage" :src="previewImage.image_url" :alt="previewImage.image_name"
              class="modal-image" @load="handlePreviewImageLoad" @error="handleModalImageError" />
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
          <div class="modal-meta-row">
            <span class="label">标注显示:</span>
            <span class="value" v-if="previewAnnotationsLoading">加载中...</span>
            <span class="value error" v-else-if="previewAnnotationsError">{{ previewAnnotationsError }}</span>
            <span class="value" v-else-if="previewBoxCount > 0">已显示 {{ previewBoxCount }} 个标注框</span>
            <span class="value muted" v-else>无标注 / 负样本</span>
          </div>
        </div>
      </div>
    </div>

    <el-dialog title="数据集划分" :visible.sync="showSplitDialog" width="420px" :close-on-click-modal="!splitSubmitting"
      :close-on-press-escape="!splitSubmitting" append-to-body class="split-dialog">
      <div class="split-body">
        <div class="split-row">
          <label class="split-label">训练</label>
          <el-input-number v-model="splitForm.train" :min="0" :max="100" size="small" />
          <span class="split-suffix">%</span>
        </div>
        <div class="split-row">
          <label class="split-label">验证</label>
          <el-input-number v-model="splitForm.val" :min="0" :max="100" size="small" />
          <span class="split-suffix">%</span>
        </div>
        <div class="split-row">
          <label class="split-label">测试</label>
          <el-input-number v-model="splitForm.test" :min="0" :max="100" size="small" />
          <span class="split-suffix">%</span>
        </div>
        <div class="split-sum" :class="{ invalid: !splitValid }">
          总和：{{ splitSum }}%
        </div>
      </div>
      <div slot="footer" class="dialog-footer">
        <el-button :disabled="splitSubmitting" @click="showSplitDialog = false">取消</el-button>
        <el-button type="primary" :loading="splitSubmitting" :disabled="!splitValid" @click="submitSplit">
          开始划分
        </el-button>
      </div>
    </el-dialog>

    <el-dialog title="样本扩增" :visible.sync="showAugmentationDialog" width="1000px" append-to-body
      class="augmentation-dialog preview-enabled">
      <ManualAugmentationPanel v-if="showAugmentationDialog" :dataset-id="datasetId" @published="handlePublished" />
    </el-dialog>
  </div>
</template>

<script>
import UploadZip from '@/components/Upload/index.vue';
import ManualAugmentationPanel from '@/views/Datasets/components/ManualAugmentationPanel.vue';
import {
  fetchStandardDatasetAnnotations,
  fetchStandardDatasetDetail,
  fetchStandardDatasetSplitSummary,
  fetchStandardDatasetView,
  splitStandardDataset,
} from '@/api/standardDatasets';

export default {
  name: 'StandardDatasetDetail',
  components: { UploadZip, ManualAugmentationPanel },
  data() {
    return {
      datasetId: this.$route.query.id || '',
      loading: false,
      detail: null,
      input: '',
      selectedClassId: null,
      selectedImages: [],
      categories: [],
      uploadFile: null,
      uploading: false,
      uploadProgress: 0,
      showAugmentationDialog: false,
      showSplitDialog: false,
      showImagePreview: false,
      previewImage: null,
      previewAnnotationsLoading: false,
      previewAnnotationsError: '',
      previewAnnotationData: null,
      previewRequestToken: 0,
      viewRequestToken: 0,
      splitSubmitting: false,
      splitLoading: false,
      splitSummary: null,
      splitForm: {
        train: 90,
        val: 7,
        test: 3,
      },
    };
  },
  computed: {
    dataset() {
      return this.detail && this.detail.dataset ? this.detail.dataset : null;
    },
    statistics() {
      return this.detail && this.detail.statistics ? this.detail.statistics : null;
    },
    datasetName() {
      return (this.dataset && (this.dataset.name || this.dataset.dataset_name)) || '标准数据集';
    },
    datasetTypeLabel() {
      return this.typeLabel(this.dataset && this.dataset.dataset_type);
    },
    datasetFormat() {
      return 'YOLO';
    },
    totalImages() {
      return Number(this.statistics && this.statistics.total_images) || 0;
    },
    classCount() {
      return Array.isArray(this.categories) ? this.categories.length : 0;
    },
    datasetSizeText() {
      const mb = Number(this.statistics && this.statistics.total_size_mb);
      if (Number.isFinite(mb) && mb > 0) return `${mb.toFixed(2)} MB`;
      return '0 MB';
    },
    isEmpty() {
      return this.totalImages <= 0;
    },
    canSplitDataset() {
      return String(this.dataset && this.dataset.dataset_type || '').toLowerCase() === 'detection' && !this.isEmpty;
    },
    splitSum() {
      const train = Number(this.splitForm.train) || 0;
      const val = Number(this.splitForm.val) || 0;
      const test = Number(this.splitForm.test) || 0;
      return Math.round((train + val + test) * 100) / 100;
    },
    splitValid() {
      return Math.abs(this.splitSum - 100) < 0.05;
    },
    hasSplit() {
      const summary = this.splitSummary;
      if (!summary) return false;
      return ((Number(summary.train_count) || 0) + (Number(summary.val_count) || 0) + (Number(summary.test_count) || 0)) > 0;
    },
    splitSummaryText() {
      if (!this.hasSplit) return '未划分';
      const summary = this.splitSummary || {};
      return `训练 ${summary.train_count || 0} / 验证 ${summary.val_count || 0} / 测试 ${summary.test_count || 0}`;
    },
    filteredClassList() {
      const query = String(this.input || '').trim().toLowerCase();
      if (!query) return this.categories;
      return this.categories.filter((item) => String(item && item.name || '').toLowerCase().includes(query));
    },
    selectedClassName() {
      if (this.selectedClassId === null || this.selectedClassId === undefined) return '全部类别';
      const row = (this.categories || []).find((item) => Number(item.class_id) === Number(this.selectedClassId));
      return row ? row.name : `class_${this.selectedClassId}`;
    },
    sourceText() {
      const dataset = this.dataset || {};
      const publishConfig = dataset && typeof dataset.publish_config === 'object' ? dataset.publish_config : {};
      const sourceType = String(dataset.source_type || '').trim();
      if (sourceType === 'illegal_publish') {
        const sourceId = publishConfig.source_illegal_dataset_id;
        const sourceName = String(publishConfig.source_illegal_dataset_name || '').trim();
        const sourceVersion = publishConfig.source_version;
        if (sourceName && sourceVersion) return `${sourceName} · v${sourceVersion}`;
        if (sourceName) return sourceName;
        if (sourceId && sourceVersion) return `非法数据集 #${sourceId} · v${sourceVersion}`;
        if (sourceId) return `非法数据集 #${sourceId}`;
        return '非法数据集发布';
      }
      if (sourceType === 'augmentation_publish') return '数据增强发布';
      if (sourceType) return sourceType;
      return '直接上传';
    },
    previewBoxCount() {
      return Array.isArray(this.previewAnnotationData && this.previewAnnotationData.boxes)
        ? this.previewAnnotationData.boxes.length
        : 0;
    },
  },
  watch: {
    '$route.query.id'(nextId) {
      if (!nextId || String(nextId) === String(this.datasetId)) return;
      this.datasetId = nextId;
      this.selectedClassId = null;
      this.input = '';
      this.showSplitDialog = false;
      this.splitSummary = null;
      this.closeImagePreview();
      this.loadAll();
    },
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('resize', this.handlePreviewResize);
    this.loadAll();
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('resize', this.handlePreviewResize);
  },
  methods: {
    goBack() {
      this.$router.push('/datasets');
    },
    typeLabel(value) {
      const map = { detection: '目标检测', segmentation: '图像分割', classification: '图像分类' };
      return map[String(value || '')] || value || '-';
    },
    formatNumber(value) {
      const n = Number(value) || 0;
      return n.toLocaleString();
    },
    formatDate(value) {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleString();
    },
    clearSearch() {
      this.input = '';
    },
    getClassId(classInfo, idx) {
      return classInfo && classInfo.class_id !== undefined ? classInfo.class_id : idx;
    },
    getClassName(classInfo) {
      return classInfo && classInfo.name ? classInfo.name : '-';
    },
    isSelectedClass(classInfo) {
      return Number(this.selectedClassId) === Number(classInfo && classInfo.class_id);
    },
    async refreshAll() {
      await this.loadAll();
    },
    async loadAll() {
      if (!this.datasetId) {
        this.$message.error('未找到标准数据集 ID');
        return;
      }
      this.loading = true;
      try {
        const detail = await fetchStandardDatasetDetail(this.datasetId, { eventsLimit: 20 });
        this.detail = detail;
        await Promise.all([
          this.loadView(),
          this.loadSplitSummary(),
        ]);
      } catch (error) {
        console.error(error);
        this.splitSummary = null;
        this.$message.error(`加载标准数据集失败：${error.message || error}`);
      } finally {
        this.loading = false;
      }
    },
    async loadView() {
      if (!this.datasetId || this.isEmpty) {
        this.categories = [];
        this.selectedImages = [];
        return;
      }
      const token = ++this.viewRequestToken;
      try {
        const firstPage = await fetchStandardDatasetView(this.datasetId, {
          classId: this.selectedClassId,
          page: 1,
          pageSize: 120,
        });
        if (token !== this.viewRequestToken) return;
        this.categories = Array.isArray(firstPage && firstPage.categories) ? firstPage.categories : [];
        this.selectedImages = Array.isArray(firstPage && firstPage.items) ? firstPage.items : [];
        const totalPages = Number(firstPage && firstPage.meta && firstPage.meta.total_pages) || 1;
        if (totalPages > 1) {
          this.loadRemainingViewPages({
            token,
            classId: this.selectedClassId,
            startPage: 2,
            totalPages,
          });
        }
      } catch (error) {
        console.error(error);
        if (token !== this.viewRequestToken) return;
        this.categories = [];
        this.selectedImages = [];
      }
    },
    async loadRemainingViewPages({ token, classId, startPage, totalPages }) {
      for (let page = startPage; page <= totalPages; page += 1) {
        if (token !== this.viewRequestToken) return;
        try {
          const pageData = await fetchStandardDatasetView(this.datasetId, {
            classId,
            page,
            pageSize: 120,
          });
          if (token !== this.viewRequestToken) return;
          const items = Array.isArray(pageData && pageData.items) ? pageData.items : [];
          if (items.length) {
            this.selectedImages = this.selectedImages.concat(items);
          }
        } catch (_) {
          return;
        }
      }
    },
    async loadSplitSummary() {
      if (!this.datasetId || !this.canSplitDataset) {
        this.splitSummary = null;
        return;
      }
      this.splitLoading = true;
      try {
        const summary = await fetchStandardDatasetSplitSummary(this.datasetId);
        this.splitSummary = summary || null;
      } catch (error) {
        console.warn('加载数据集划分摘要失败:', error);
        this.splitSummary = null;
      } finally {
        this.splitLoading = false;
      }
    },
    openSplitDialog() {
      if (!this.canSplitDataset) return;
      if (this.hasSplit && this.splitSummary) {
        this.splitForm = {
          train: Math.round((Number(this.splitSummary.train_ratio) || 0) * 10000) / 100,
          val: Math.round((Number(this.splitSummary.val_ratio) || 0) * 10000) / 100,
          test: Math.round((Number(this.splitSummary.test_ratio) || 0) * 10000) / 100,
        };
      } else {
        this.splitForm = { train: 90, val: 7, test: 3 };
      }
      this.showSplitDialog = true;
    },
    async submitSplit() {
      if (!this.datasetId) return;
      if (!this.splitValid) {
        this.$message.warning('训练 / 验证 / 测试比例总和必须为 100%');
        return;
      }
      this.splitSubmitting = true;
      try {
        const summary = await splitStandardDataset(this.datasetId, {
          train_ratio: (Number(this.splitForm.train) || 0) / 100,
          val_ratio: (Number(this.splitForm.val) || 0) / 100,
          test_ratio: (Number(this.splitForm.test) || 0) / 100,
          seed: 42,
          shuffle: true,
          overwrite: true,
        });
        this.splitSummary = summary || null;
        this.$message.success('数据集划分完成');
        this.showSplitDialog = false;
        await this.loadAll();
      } catch (error) {
        this.$message.error(`数据集划分失败：${error && error.message ? error.message : error || '未知错误'}`);
      } finally {
        this.splitSubmitting = false;
      }
    },
    selectClass(classId) {
      this.selectedClassId = classId === null || classId === undefined || classId === '' ? null : Number(classId);
      this.loadView();
    },
    handleImageError(event, image) {
      const img = event.target;
      if (!img || !image || !image.image_url) return;
      if (img.dataset.fallback === 'original') return;
      img.dataset.fallback = 'original';
      img.src = image.image_url;
    },
    async openImagePreview(image) {
      this.previewImage = image ? { ...image } : null;
      this.showImagePreview = true;
      this.previewAnnotationsLoading = true;
      this.previewAnnotationsError = '';
      this.previewAnnotationData = null;
      const token = ++this.previewRequestToken;

      this.$nextTick(() => {
        const img = this.$refs.previewModalImage;
        if (img && img.complete) this.handlePreviewImageLoad();
      });

      try {
        const data = await fetchStandardDatasetAnnotations(this.datasetId, image.image_path || image.image_name);
        if (token !== this.previewRequestToken) return;
        this.previewAnnotationData = data;
        this.previewAnnotationsLoading = false;
        this.previewImage = {
          ...this.previewImage,
          objects_count: Number(data && data.object_count) || 0,
        };
        this.$nextTick(() => this.redrawPreviewAnnotations());
      } catch (error) {
        if (token !== this.previewRequestToken) return;
        this.previewAnnotationsLoading = false;
        this.previewAnnotationsError = error && error.message ? String(error.message) : '标注加载失败';
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
      if (event && event.target) event.target.style.display = 'none';
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
      const palette = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4f46e5', '#ea580c', '#059669'];
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
      if (!this.categories || !classIds) return '';
      return classIds
        .map((id) => {
          const classInfo = this.categories.find((cls) => Number(cls.class_id) === Number(id));
          return classInfo ? classInfo.name : `class_${id}`;
        })
        .join(', ');
    },
    handleKeydown(event) {
      if (event.key === 'Escape' && this.showImagePreview) {
        this.closeImagePreview();
      }
    },
    openAugmentationDialog() {
      if (this.isEmpty) return;
      this.showAugmentationDialog = true;
    },
    handleUploadSuccess() {
      this.uploadFile = null;
      this.uploading = false;
      this.uploadProgress = 0;
      this.$message.success('标准数据集上传成功');
      this.loadAll();
    },
    handleUploadFail(error) {
      this.$message.error(`上传失败：${error && error.message ? error.message : error || '未知错误'}`);
    },
    handlePublished(payload) {
      this.showAugmentationDialog = false;
      const nextId = payload && payload.standard_dataset_id;
      this.$message.success(`增强结果已发布为新的标准数据集 #${nextId}`);
      if (nextId) {
        this.$router.push({ path: '/standard-dataset-detail', query: { id: nextId } });
      }
    },
  },
};
</script>

<style scoped>
.dataset-detail-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.glass-panel,
.glass-panel-sm,
.detail-hero {
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.detail-hero {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 28px 30px;
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.back-link {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}

.hero-kicker {
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
}

.hero-title {
  margin: 0;
  font-size: 32px;
  line-height: 1.2;
  color: #111827;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
}

.meta-pill,
.meta-id {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
}

.meta-pill.success {
  background: #ecfdf3;
  color: #027a48;
}

.meta-pill.info {
  background: #eff6ff;
  color: #1d4ed8;
}

.meta-id {
  background: #f8fafc;
  color: #475569;
}

.hero-desc {
  margin: 14px 0 0;
  color: #4b5563;
  line-height: 1.8;
  max-width: 760px;
}

.hero-right {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 14px;
  min-width: 360px;
}

.stat-card {
  border-radius: 18px;
  padding: 18px 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #edf2f7;
}

.stat-label {
  color: #64748b;
  font-size: 13px;
}

.stat-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.detail-body {
  padding: 22px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 240px;
  color: #64748b;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
}

.empty-content {
  max-width: 680px;
}

.empty-title {
  font-size: 26px;
  font-weight: 700;
  color: #111827;
}

.empty-desc {
  margin-top: 14px;
  color: #4b5563;
  line-height: 1.8;
}

.empty-tips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.tip-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 12px;
  border-radius: 999px;
}

.gallery-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 20px;
}

.sidebar-panel,
.images-panel,
.extra-section {
  padding: 18px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.panel-sub,
.panel-subtitle {
  color: #64748b;
  font-size: 13px;
  margin-top: 4px;
}

.split-hint {
  color: #475569;
}

.search-box {
  margin-bottom: 16px;
}

.class-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 625px;
  overflow-y: auto;
}

.class-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.class-list li:hover,
.class-list li.selected {
  border-color: #93c5fd;
  background: #eff6ff;
}

.class-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.class-name {
  color: #111827;
  font-weight: 500;
  word-break: break-word;
}

.class-count {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #60a5fa;
  flex: 0 0 auto;
}

.dot.all {
  background: #10b981;
}

.dataset-info-card {
  /* margin-top: 18px; */
  /* border-top: 1px dashed #dbe4ee; */
  /* padding-top: 16px; */
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.info-line {
  display: flex;
  /* flex-direction: column; */
  gap: 4px;
  align-items: center;
}

.info-line span {
  color: #64748b;
  font-size: 12px;
}

.info-line strong {
  color: #111827;
  word-break: break-word;
}

.panel-actions {
  display: flex;
  gap: 10px;
}

.split-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.split-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.split-label {
  width: 56px;
  color: #111827;
  font-weight: 600;
}

.split-suffix {
  color: #64748b;
}

.split-sum {
  font-size: 13px;
  color: #64748b;
}

.split-sum.invalid {
  color: #dc2626;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
  margin-left: 8px;
}

.no-images,
.no-results {
  padding: 36px 16px;
  color: #64748b;
  text-align: center;
}

.no-images i {
  font-size: 32px;
  display: block;
  margin-bottom: 10px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  height: 660px;
  overflow: auto;
}

.image-card {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  cursor: pointer;
  background: #0f172a;
  min-height: 180px;
}

.image-wrapper {
  width: 100%;
  height: 100%;
  min-height: 180px;
}

.image-wrapper img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 180px;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.88) 100%);
  color: #fff;
}

.image-name {
  font-weight: 600;
  word-break: break-word;
}

.image-meta {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.extra-section {
  margin-top: 20px;
}

.preview-modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  padding: 24px;
}

.modal-card {
  position: relative;
  width: min(1180px, calc(100vw - 48px));
  max-height: calc(100vh - 48px);
  padding: 24px;
  overflow: auto;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #f8fafc;
  cursor: pointer;
  color: #334155;
}

.modal-image-wrapper {
  margin-right: 340px;
}

.modal-canvas-wrap {
  position: relative;
  width: 100%;
  min-height: 480px;
  background: #020617;
  border-radius: 16px;
  overflow: hidden;
}

.modal-image {
  width: 100%;
  display: block;
}

.modal-overlay-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.modal-info {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 300px;
  padding: 16px;
  border-radius: 16px;
  background: #f8fafc;
}

.modal-info h3 {
  margin: 0 0 16px;
  color: #0f172a;
}

.modal-meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  line-height: 1.6;
}

.modal-meta-row .label {
  min-width: 64px;
  color: #64748b;
}

.modal-meta-row .value {
  color: #111827;
  word-break: break-word;
}

.modal-meta-row .value.error {
  color: #dc2626;
}

.modal-meta-row .value.muted {
  color: #94a3b8;
}

@media (max-width: 1200px) {

  .detail-hero,
  .gallery-layout {
    grid-template-columns: 1fr;
    display: grid;
  }

  .hero-right {
    min-width: 0;
  }

  .modal-image-wrapper {
    margin-right: 0;
  }

  .modal-info {
    position: static;
    width: 100%;
    margin-top: 16px;
  }
}

@media (max-width: 768px) {
  .detail-hero {
    padding: 20px;
  }

  .hero-right {
    grid-template-columns: 1fr;
  }

  .detail-body,
  .sidebar-panel,
  .images-panel,
  .extra-section {
    padding: 16px;
  }

  .empty-state {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
