<template>
  <div class="datasets-page page-container">
    <header class="ds-hero">
      <div class="ds-hero-left">
        <div class="ds-eyebrow">数据集中心</div>
        <h1 class="ds-title">数据集</h1>
        <p class="ds-subtitle">集中创建、上传和管理训练数据。</p>
      </div>
      <div class="ds-hero-right">
        <div class="search-shell">
          <i class="el-icon-search"></i>
          <el-input
            v-model="searchQuery"
            placeholder="搜索数据集"
            class="search-input"
            clearable
          ></el-input>
        </div>
        <el-button
          type="primary"
          class="primary-action"
          @click="dialogFormVisible = true"
        >新建数据集</el-button>
      </div>
    </header>

    <section class="ds-toolbar glass-panel">
      <div class="toolbar-left">
        <div class="filter-group">
          <span class="filter-label">Type</span>
          <el-select v-model="value" placeholder="All types" class="filter-select" @change="handleFilterChange">
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </div>
      </div>
      <div class="toolbar-right">
        <span class="filter-label">排序</span>
        <button
          class="chip"
          :class="{ active: activeFilter === 'category' }"
          @click="setActiveFilter('category')"
        >类别</button>
        <button
          class="chip"
          :class="{ active: activeFilter === 'image' }"
          @click="setActiveFilter('image')"
        >图片数</button>
        <button
          class="chip"
          :class="{ active: activeFilter === 'size' }"
          @click="setActiveFilter('size')"
        >大小</button>
      </div>
    </section>

    <section class="ds-content">
      <section v-if="filteredDatasets.length" class="dataset-grid">
        <div
          class="dataset-card"
          v-for="d in filteredDatasets"
          :key="d.dataset_id"
          @click="goDetail(d)"
        >
          <div class="card-media" :style="{ backgroundImage: `url(${d.preview_image_url || defaultPreview})` }">
            <span class="card-type">{{ getDatasetTypeLabel(d.dataset_type) }}</span>
            <div class="card-overlay"></div>
          </div>
          <div class="card-body">
            <div class="card-header">
                <div class="card-title">{{ d.dataset_name }}</div>
                <div class="card-sub">ID: {{ d.dataset_id || '-' }}</div>
            </div>
            
            <div class="card-stats">
              <div class="stat-item">
                <div class="stat-label">类别</div>
                <div class="stat-value">{{ d.num_classes || 0 }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">图片</div>
                <div class="stat-value">{{ formatImageCount(d.num_images) }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">大小</div>
                <div class="stat-value">{{ formatDatasetSize(d.dataset_size_mb) }}</div>
              </div>
            </div>
          </div>
          <button class="card-more" type="button" @click.stop="handleShowDeletePopup(d.dataset_id)">
            <i class="el-icon-more"></i>
          </button>
        </div>
      </section>

      <div v-else class="empty-state glass-panel">
        <div class="empty-title">暂无数据集</div>
        <div class="empty-desc">创建您的第一个数据集以开始。</div>
        <el-button type="primary" class="primary-action" @click="dialogFormVisible = true">创建数据集</el-button>
      </div>
    </section>

    <!-- Custom Popup -->
    <div v-if="showPopup" class="mask" @click="showPopup = false">
      <div class="popup glass-panel" @click.stop>
        <p>确定删除此数据集吗？</p>
        <div class="popup-actions">
          <el-button size="small" @click="showPopup = false">取消</el-button>
          <el-button size="small" type="danger" @click="handleDelete(currentDatasetId)">删除</el-button>
        </div>
      </div>
    </div>

    <el-dialog
      title="创建数据集"
      :visible.sync="dialogFormVisible"
      width="720px"
      custom-class="dataset-dialog"
    >
      <div class="dialog-content">
        <div class="dialog-subtitle">先创建数据集，然后在详情页上传文件。</div>
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
            <el-form-item
            label="数据集名称"
            prop="name"
            >
            <el-input v-model="form.name" autocomplete="off" :disabled="createdDatasetId" placeholder="例如：交通标志"></el-input>
            </el-form-item>
            <el-form-item
            label="数据集类型"
            prop="type"
            >
            <el-select v-model="form.type" placeholder="选择类型" :disabled="createdDatasetId" style="width: 100%">
                <el-option
                v-for="item in selectOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
                ></el-option>
            </el-select>
            </el-form-item>
        </el-form>

        <div class="create-dataset-actions">
            <el-button
            type="primary"
            :loading="creatingDataset"
            :disabled="createdDatasetId"
            @click="handleCreateDataset"
            >创建</el-button>
            <el-button
            v-if="createdDatasetId"
            type="primary"
            plain
            class="view-detail-btn"
            @click="goToCreatedDetail"
            >打开详情</el-button>
            <el-button
            v-if="createdDatasetId"
            type="text"
            class="reset-dataset-btn"
            @click="resetCreatedDataset"
            >继续创建</el-button>
            <span v-if="createdDatasetId" class="created-tip">已创建。ID：{{ createdDatasetId }}</span>
            <span v-else class="created-tip">创建后在详情页上传 ZIP 文件。</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>


<script>
import { fetchDatasets, createDataset, deleteDataset, FetchDatasetStatistics, FetchDatasetPreviewImage, FetchDatasetClassNames } from "@/api/datasets";
import defaultDatasetImg from "@/assets/images/Datasets/image.png";

export default {
  name: "Datasets",
  components: {},
  data() {
    return {
      searchQuery: "", // Search keywords
      options: [
        { value: "all", label: "全部" },
        { value: "detection", label: "检测" },
        { value: "segmentation", label: "分割" },
        { value: "classification", label: "分类" },
      ],
      selectOptions: [
        { value: "detection", label: "检测" },
        { value: "segmentation", label: "分割" },
        { value: "classification", label: "分类" },
      ],
      value: "all",
      activeFilter: null,
      datasets: [],
      originalDatasets: [],
      dialogFormVisible: false,
      form: {
        name: "",
        type: "",
      },
      formLabelWidth: "120px",
      rules: {
        name: [
          { required: true, message: "请输入数据集名称", trigger: "blur" },
        ],
        type: [
          { required: true, message: "请选择数据集类型", trigger: "change" },
        ],
      },
      showPopup: false,
      currentDatasetId: null,
      createdDatasetId: null,
      creatingDataset: false,
      defaultPreview: defaultDatasetImg,
      bodyOverflowBackup: '',
      htmlOverflowBackup: '',
    };
  },
  watch: {
    dialogFormVisible(val) {
      if (!val) {
        this.createdDatasetId = null;
        this.creatingDataset = false;
        if (this.$refs.formRef) {
          this.$refs.formRef.resetFields();
        }
      }
    }
  },

  computed: {
    // 综合过滤：先按名称搜索，再按类型过滤，最后排序
    filteredDatasets() {
      let result = [...this.datasets];
      
      // 1. 仅按名称搜索过滤
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(dataset => {
          // 只保留名称匹配的过滤逻辑
          return dataset.dataset_name.toLowerCase().includes(query);
        });
      }
      
      // 2. 类型过滤
      if (this.value !== 'all' && this.value) {
        result = result.filter(dataset => {
          return dataset.dataset_type === this.value;
        });
      }
      
      // 3. 排序
      if (this.activeFilter === 'category') {
        result = result.sort((a, b) => {
          const aClasses = a.num_classes || 0;
          const bClasses = b.num_classes || 0;
          return bClasses - aClasses;
        });
      } else if (this.activeFilter === 'image') {
        result = result.sort((a, b) => {
          const aImages = a.num_images || 0;
          const bImages = b.num_images || 0;
          return bImages - aImages;
        });
      } else if (this.activeFilter === 'size') {
        result = result.sort((a, b) => {
          const aSize = this.parseDatasetSize(a.dataset_size_mb);
          const bSize = this.parseDatasetSize(b.dataset_size_mb);
          return bSize - aSize;
        });
      }
      
      return result;
    }
  },
  methods: {
    setActiveFilter(filter) {
      this.activeFilter = this.activeFilter === filter ? null : filter;
    },
    // 处理筛选器变化
    handleFilterChange() {
      // 筛选变化时会自动触发computed重新计算
    },
    goDetail(dataset) {
      if (this.$route.path !== "/datadetail") {
        const queryData = {
          datasetId: dataset.dataset_id,
          datasetName: dataset.dataset_name,
          datasetType: dataset.dataset_type,
          numClasses: dataset.num_classes,
          numImages: dataset.num_images,
          datasetSize: dataset.dataset_size_mb
        };
        this.$router.push({
          path: "/datadetail",
          query: queryData
        });
      }
    },
    resetCreatedDataset() {
      this.createdDatasetId = null;
      this.$nextTick(() => {
        if (this.$refs.formRef) {
          this.$refs.formRef.clearValidate();
        }
      });
    },
    goToCreatedDetail() {
      if (!this.createdDatasetId) return;
      const queryData = {
        datasetId: this.createdDatasetId,
        datasetName: this.form.name,
        datasetType: this.form.type,
      };
      this.dialogFormVisible = false;
      this.$router.push({ path: "/datadetail", query: queryData });
    },

    async handleCreateDataset() {
      if (this.creatingDataset) return;
      if (this.createdDatasetId) return;
      try {
        this.creatingDataset = true;
        await this.$refs.formRef.validate();
        const payload = {
          name: this.form.name,
          dataset_type: this.form.type,
        };
        const ds = await createDataset(payload);
        this.createdDatasetId = ds && (ds.dataset_id || ds.id);
        this.$message({ type: 'success', message: `数据集已创建: ${this.form.name}` });
        this.fetchDatasetsList();
      } catch (error) {
        this.$message({ type: 'error', message: '创建失败: ' + (error.message || error) });
      } finally {
        this.creatingDataset = false;
      }
    },

    async fetchDatasetsList() {
      try {
        const list = await fetchDatasets();
        // 确保list是数组
        this.datasets = Array.isArray(list) ? list : [];
        this.originalDatasets = Array.isArray(list) ? [...list] : [];
        this.seedPreviewFromCache();
        this.loadStatsParallel();
        this.loadPreviewsParallel(4);
      } catch (e) {
        console.error('Failed to fetch datasets:', e);
        this.datasets = [];
        this.originalDatasets = [];
      }
    },
    seedPreviewFromCache() {
      this.datasets.forEach(d => {
        const key = `ds_preview_${d.dataset_id}`;
        const cached = localStorage.getItem(key) || '';
        // 仅当缓存存在且不是默认占位图时使用
        if (cached && !/images\/image\.png$/.test(cached)) {
          this.$set(d, 'preview_image_url', cached);
        } else {
          this.$set(d, 'preview_image_url', '');
        }
      });
      this.$forceUpdate();
    },
    async loadStatsParallel() {
      const jobs = this.datasets.map(async d => {
        try {
          const s = await FetchDatasetStatistics(d.dataset_id);
          // 后端 v2 统计字段：total_images / total_size_mb 等
          this.$set(d, 'num_images', s.num_images || 0);
          this.$set(d, 'dataset_size_mb', s.dataset_size_mb || '0MB');

          // 类别数：优先从 data.yaml 读取（例如 coco128），避免首页一直显示 0 分类
          try {
            const names = await FetchDatasetClassNames(d.storage_path || d.dataset_name || d.name);
            this.$set(d, 'num_classes', Array.isArray(names) ? names.length : 0);
          } catch (_) {
            this.$set(d, 'num_classes', 0);
          }
        } catch (_) {
          this.$set(d, 'num_classes', 0);
          this.$set(d, 'num_images', 0);
          this.$set(d, 'dataset_size_mb', '0MB');
        }
      });
      await Promise.allSettled(jobs);
    },
    async loadPreviewsParallel(concurrency = 4) {
      const queue = [...this.datasets];
      const worker = async () => {
        for (;;) {
          const d = queue.shift();
          if (!d) return;
          try {
            const url = await FetchDatasetPreviewImage(d.dataset_id);
            this.$set(d, 'preview_image_url', url || '');
            // 仅当 URL 有效且非默认占位时写入缓存
            if (url && !/images\/image\.png$/.test(url)) {
              localStorage.setItem(`ds_preview_${d.dataset_id}`, url);
            }
          } catch (_) {}
        }
      };
      const n = Math.min(concurrency, queue.length || 0);
      await Promise.all(Array.from({ length: n }, worker));
    },
    async handleDelete(id) {
      try {
        await deleteDataset(id, { force: true, deleteFiles: true });
        this.showPopup = false;
        this.fetchDatasetsList();
      } catch (error) {
        alert(`删除失败: ${error.message}`);
      }
    },
    handleShowDeletePopup(datasetId) {
      this.currentDatasetId = datasetId;
      this.showPopup = true;
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
      return typeMap[type] || type || '未知';
    },
    parseDatasetSize(sizeStr) {
      if (!sizeStr) return 0;
      if (typeof sizeStr === 'number') {
        return sizeStr;
      }
      if (typeof sizeStr === 'string') {
        const match = sizeStr.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      }
      return 0;
    },
  },
  mounted() {
    this.fetchDatasetsList();
  },
};
</script>


<style scoped>
.datasets-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Hero Section */
.ds-hero {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  color: var(--text-main);
  position: relative;
  overflow: hidden;
}

.ds-hero::before {
  content: none;
}

.ds-hero-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.ds-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 600;
}

.ds-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.ds-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.ds-hero-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border-radius: var(--radius-full);
  border: 1px solid #e5e7eb;
  transition: all 0.3s ease;
}

.search-shell:focus-within {
  background: #ffffff;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
}

.search-shell i {
  color: var(--text-secondary);
}

.search-input ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  color: var(--text-main);
  height: auto;
  padding: 0;
  line-height: normal;
}

.search-input ::v-deep .el-input__inner::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.primary-action {
  border-radius: var(--radius-full) !important;
  font-weight: 600;
}

/* Toolbar */
.ds-toolbar {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.filter-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
}

/* Custom Chip Buttons */
.chip {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: rgba(0,0,0,0.05); /* slightly dark on light theme */
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.chip:hover {
  background: rgba(0,0,0,0.1);
  color: var(--text-main);
}

.chip.active {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

/* Grid & Cards */
.ds-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.dataset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.dataset-card {
  background: var(--bg-card-glass);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition-normal);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
}

.dataset-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary-light);
}

.card-media {
  height: 160px;
  background-size: cover;
  background-position: center;
  position: relative;
}

.card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%);
}

.card-type {
  position: absolute;
  top: 1rem;
  left: 1rem;
  background: rgba(255, 255, 255, 0.9);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-sm);
  z-index: 2;
}

.card-more {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  box-shadow: var(--shadow-sm);
  color: var(--text-secondary);
}

.card-more:hover {
    background: white;
    color: var(--color-primary);
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.card-header {
    margin-bottom: 0.5rem;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.card-stats {
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  border-top: 1px solid rgba(0,0,0,0.05);
  padding-top: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  text-align: center;
  background: rgba(0,0,0,0.02);
  padding: 0.5rem;
  border-radius: var(--radius-md);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  border: 1px dashed rgba(0,0,0,0.1);
  text-align: center;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.empty-desc {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

/* Popup */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup {
  width: 320px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  text-align: center;
}

.popup p {
    font-weight: 600;
    font-size: 1.125rem;
}

.popup-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

/* Custom Dialog Content */

.dialog-content {
    padding: 1rem 2rem;
}

.dialog-subtitle {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
}

.create-dataset-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
}

.created-tip {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

@media (max-width: 960px) {
  .ds-hero {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
