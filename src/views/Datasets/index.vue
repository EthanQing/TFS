<template>
  <div class="datasets-page page-container">
    <header class="ds-hero">
      <div class="ds-hero-content">
        <div class="ds-eyebrow">数据中心</div>
        <h1 class="ds-title">数据集</h1>
        <p class="ds-subtitle">集中创建、上传和管理您的训练数据。</p>
        
        <div class="ds-actions">
           <el-button
            type="primary"
            icon="el-icon-plus"
            class="hero-action"
            @click="dialogFormVisible = true"
          >新建数据集</el-button>
        </div>
      </div>
      
      <!-- Optional: Add a decorative element or keep clean -->
    </header>

    <section class="ds-toolbar">
      <div class="toolbar-left">
        <div class="search-shell">
          <i class="el-icon-search"></i>
          <el-input
            v-model="searchQuery"
            placeholder="搜索数据集..."
            class="search-input"
            clearable
          ></el-input>
        </div>
        
        <div class="filter-group">
          <el-select v-model="value" placeholder="全部类型" class="filter-select" @change="handleFilterChange">
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </div>

        <div class="filter-group">
          <el-select v-model="formatValue" placeholder="全部格式" class="filter-select">
             <el-option
              v-for="item in formatOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            ></el-option>
          </el-select>
        </div>
      </div>
      
      <div class="toolbar-right">
        <span class="filter-label">排序:</span>
        <div class="sort-actions">
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
            <span class="card-type-badge">{{ getDatasetTypeLabel(d.dataset_type) }}</span>
            <span v-if="d.format === 'coco'" class="card-format-badge coco">COCO</span>
            <div class="card-overlay"></div>
          </div>
          <div class="card-body">
            <div class="card-header">
                <div class="card-title">{{ d.dataset_name }}</div>
                <div class="card-id">ID: {{ d.dataset_id || '-' }}</div>
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

      <div v-else class="empty-state">
        <div class="empty-icon">
          <i class="el-icon-folder-opened"></i>
        </div>
        <div class="empty-title">暂无数据集</div>
        <div class="empty-desc">创建您的第一个数据集项目以开始。</div>
        <el-button type="primary" @click="dialogFormVisible = true">创建数据集</el-button>
      </div>
    </section>

    <!-- Custom Popup -->
    <div v-if="showPopup" class="mask" @click="showPopup = false">
      <div class="popup" @click.stop>
        <div class="popup-header">
           <i class="el-icon-warning text-warning"></i>
           <span>确认删除</span>
        </div>
        <p class="popup-body">确定要删除此数据集吗？此操作不可撤销。</p>
        <div class="popup-actions">
          <el-button @click="showPopup = false">取消</el-button>
          <el-button type="danger" @click="handleDelete(currentDatasetId)">删除</el-button>
        </div>
      </div>
    </div>

    <el-dialog
      title="创建新数据集"
      :visible.sync="dialogFormVisible"
      width="600px"
      custom-class="dataset-dialog"
      append-to-body
    >
      <div class="dialog-content">
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
            <el-form-item label="数据集名称" prop="name">
              <el-input v-model="form.name" autocomplete="off" :disabled="createdDatasetId" placeholder="例如：交通标志"></el-input>
            </el-form-item>
            <el-form-item label="任务类型" prop="type">
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

        <div class="dialog-footer-actions">
            <span v-if="createdDatasetId" class="created-tip success">
               <i class="el-icon-success"></i> 已创建! ID: {{ createdDatasetId }}
            </span>
            <div class="actions-right">
                <el-button @click="dialogFormVisible = false" v-if="!createdDatasetId">取消</el-button>
                <el-button
                v-if="!createdDatasetId"
                type="primary"
                :loading="creatingDataset"
                @click="handleCreateDataset"
                >创建</el-button>
                
                <template v-else>
                    <el-button type="text" @click="resetCreatedDataset">继续创建</el-button>
                    <el-button type="primary" @click="goToCreatedDetail">查看详情</el-button>
                </template>
            </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
// Logic remains mostly the same, ensuring imports are correct
import { fetchDatasets, createDataset, deleteDataset, FetchDatasetStatistics, FetchDatasetPreviewImage, FetchDatasetClassNames } from "@/api/datasets";
import defaultDatasetImg from "@/assets/images/Datasets/image.png";

export default {
  name: "Datasets",
  data() {
    return {
      searchQuery: "",
      options: [
        { value: "all", label: "全部类型" },
        { value: "detection", label: "目标检测" },
        { value: "segmentation", label: "图像分割" },
        { value: "classification", label: "图像分类" },
      ],
      selectOptions: [
        { value: "detection", label: "目标检测" },
        { value: "segmentation", label: "图像分割" },
        { value: "classification", label: "图像分类" },
      ],
      formatOptions: [
        { value: "all", label: "全部格式" },
        { value: "yolo", label: "YOLO" },
        { value: "coco", label: "COCO" },
      ],
      value: "all",
      formatValue: "all",
      activeFilter: null,
      datasets: [],
      originalDatasets: [],
      dialogFormVisible: false,
      form: { name: "", type: "" },
      rules: {
        name: [{ required: true, message: "请输入数据集名称", trigger: "blur" }],
        type: [{ required: true, message: "请选择任务类型", trigger: "change" }],
      },
      showPopup: false,
      currentDatasetId: null,
      createdDatasetId: null,
      creatingDataset: false,
      defaultPreview: defaultDatasetImg,
    };
  },
  watch: {
    dialogFormVisible(val) {
      if (!val) {
        this.createdDatasetId = null;
        this.creatingDataset = false;
        if (this.$refs.formRef) this.$refs.formRef.resetFields();
      }
    }
  },
  computed: {
    filteredDatasets() {
      let result = [...this.datasets];
      // console.log("the datasets:", this.datasets);
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(dataset => dataset.dataset_name.toLowerCase().includes(query));
      }
      if (this.value !== 'all' && this.value) {
        result = result.filter(dataset => dataset.dataset_type === this.value);
      }
      if (this.formatValue !== 'all' && this.formatValue) {
        result = result.filter(dataset => (dataset.format || 'yolo') === this.formatValue);
      }
      console.log('After filtering:', result);
      console.log('current activeFilter:', this.activeFilter);
      if (this.activeFilter === 'category') {
        result.sort((a, b) => (b.num_classes || 0) - (a.num_classes || 0));
      } else if (this.activeFilter === 'image') {
        result.sort((a, b) => (b.num_images || 0) - (a.num_images || 0));
      } else if (this.activeFilter === 'size') {
        result.sort((a, b) => this.parseDatasetSize(b.dataset_size_mb) - this.parseDatasetSize(a.dataset_size_mb));
      }
      // console.log(result,'filtered result');
      return result;
    }
  },
  methods: {
    testClick(d){
      console.log(d);
    },
    setActiveFilter(filter) {
      this.activeFilter = this.activeFilter === filter ? null : filter;
    },
    handleFilterChange() {},
    goDetail(dataset) {
      if (this.$route.path !== "/datadetail") {
        this.$router.push({
          path: "/datadetail",
          query: {
            datasetId: dataset.dataset_id,
            datasetName: dataset.dataset_name,
            datasetType: dataset.dataset_type,
            numClasses: dataset.num_classes,
            numImages: dataset.num_images,
            datasetSize: dataset.dataset_size_mb
          }
        });
      }
    },
    resetCreatedDataset() {
      this.createdDatasetId = null;
      this.form.name = "";
      this.form.type = "";
      this.$nextTick(() => { if (this.$refs.formRef) this.$refs.formRef.clearValidate(); });
    },
    goToCreatedDetail() {
      if (!this.createdDatasetId) return;
      this.dialogFormVisible = false;
      this.$router.push({ 
        path: "/datadetail", 
        query: { datasetId: this.createdDatasetId, datasetName: this.form.name, datasetType: this.form.type } 
      });
    },
    async handleCreateDataset() {
      if (this.creatingDataset || this.createdDatasetId) return;
      try {
        this.creatingDataset = true;
        await this.$refs.formRef.validate();
        const payload = { name: this.form.name, dataset_type: this.form.type };
        const ds = await createDataset(payload);
        this.createdDatasetId = ds && (ds.dataset_id || ds.id);
        this.$message.success(`Dataset Created: ${this.form.name}`);
        this.fetchDatasetsList();
      } catch (error) {
        this.$message.error('Creation failed: ' + (error.message || error));
      } finally {
        this.creatingDataset = false;
      }
    },
    async fetchDatasetsList() {
      try {
        const list = await fetchDatasets();
        // console.log(list,'list:');
        this.datasets = Array.isArray(list) ? list : [];
        this.originalDatasets = [...this.datasets];
        this.seedPreviewFromCache();
        this.loadStatsParallel();
        this.loadPreviewsParallel(4);
      } catch (e) {
        console.error('Failed to fetch datasets:', e);
        this.datasets = [];
      }
    },
    seedPreviewFromCache() {
      this.datasets.forEach(d => {
        const key = `ds_preview_${d.dataset_id}`;
        const cached = localStorage.getItem(key) || '';
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
          this.$set(d, 'num_images', s.num_images || 0);
          this.$set(d, 'dataset_size_mb', s.dataset_size_mb || '0MB');
          try {
            const names = await FetchDatasetClassNames(d.storage_path || d.dataset_name || d.name);
            this.$set(d, 'num_classes', Array.isArray(names) ? names.length : 0);
          } catch (_) {
            this.$set(d, 'num_classes', 0);
          }
        } catch (_) {
            // retain defaults
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
            if (url && !/images\/image\.png$/.test(url)) {
               this.$set(d, 'preview_image_url', url);
               localStorage.setItem(`ds_preview_${d.dataset_id}`, url);
            }
          } catch (_) {}
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    },
    async handleDelete(id) {
      try {
        await deleteDataset(id, { force: false, deleteFiles: true });
        this.showPopup = false;
        this.fetchDatasetsList();
        this.$message.success('Dataset deleted');
      } catch (error) {
        if (this.isDeleteConflict(error)) {
          this.showPopup = false;
          try {
            await this.$confirm(
              '该数据集有关联项目/训练任务，是否强制链式删除？',
              '确认强制删除',
              { type: 'warning', confirmButtonText: '强制删除', cancelButtonText: '取消' }
            );
            await deleteDataset(id, { force: true, deleteFiles: true });
            this.fetchDatasetsList();
            this.$message.success('Dataset deleted');
          } catch (forceError) {
            if (forceError !== 'cancel' && forceError !== 'close') {
              this.$message.error(`Delete failed: ${forceError.message || forceError}`);
            }
          }
          return;
        }
        this.$message.error(`Delete failed: ${error.message}`);
      }
    },
    isDeleteConflict(error) {
      if (error && error.status === 409) return true;
      const msg = String((error && error.message) || '').toLowerCase();
      return msg.includes('cannot delete') || msg.includes('still reference');
    },
    handleShowDeletePopup(datasetId) {
      this.currentDatasetId = datasetId;
      this.showPopup = true;
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
    parseDatasetSize(sizeStr) {
      if (!sizeStr) return 0;
      if (typeof sizeStr === 'number') return sizeStr;
      const match = sizeStr.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    },
  },
  mounted() {
    this.fetchDatasetsList();
  },
};
</script>

<style scoped>
.datasets-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Hero Section */
.ds-hero {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
}

.ds-hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ds-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
  font-weight: 700;
}

.ds-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  line-height: 1.2;
}

.ds-subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
  max-width: 600px;
}

.ds-actions {
    margin-top: 16px;
}

/* Toolbar */
.ds-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-sm);
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-shell {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-full);
  padding: 6px 16px;
  transition: all 0.2s;
  width: 280px;
}

.search-shell:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-subtle);
}

.search-input ::v-deep .el-input__inner {
  border: none;
  background: transparent;
  padding: 0;
  height: auto;
}

.filter-group {
    min-width: 160px;
}

.sort-actions {
    display: flex;
    gap: 8px;
}

.chip {
  padding: 6px 12px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: transparent;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.chip:hover {
  background: var(--bg-body);
  color: var(--color-primary);
}

.chip.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

/* Grid */
.ds-content {
    flex: 1;
}

.dataset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.dataset-card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-normal);
  display: flex;
  flex-direction: column;
  position: relative;
}

.dataset-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary-subtle);
}

.card-media {
  height: 180px;
  background-size: cover;
  background-position: center;
  position: relative;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.4), transparent);
}

.card-type-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(255, 255, 255, 0.95);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-sm);
  z-index: 2;
}

.card-format-badge {
  position: absolute;
  top: 12px;
  left: auto;
  right: 50px; /* Positioned to the left of the 'more' button */
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: var(--shadow-sm);
  z-index: 2;
}

.card-format-badge.coco {
    background: #FFC107; /* Amber */
    color: #3e2723;
}

.card-more {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  z-index: 2;
  transition: all 0.2s;
}

.card-more:hover {
  background: white;
  color: var(--color-primary);
  transform: scale(1.1);
}

.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-id {
  font-size: 0.75rem;
  color: var(--text-light);
  font-family: monospace;
}

.card-stats {
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-color);
}

.empty-icon {
  font-size: 3rem;
  color: var(--text-light);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-main);
}

.empty-desc {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* Popup */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.popup {
  background: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 400px;
  box-shadow: var(--shadow-xl);
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 12px;
}

.text-warning {
    color: var(--color-warning);
}

.popup-body {
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.5;
}

.popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Dialog Footer */
.dialog-footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
}

.created-tip.success {
    color: var(--color-success);
    font-weight: 500;
    font-size: 0.9rem;
}
</style>
