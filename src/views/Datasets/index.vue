<template>
  <div class="datasets-page page-container">
    <header class="ds-hero">
      <div class="ds-hero-content">
        <div class="ds-eyebrow">数据中心</div>
        <h1 class="ds-title">数据集</h1>
        <p class="ds-subtitle">集中创建、上传、标注和管理您的训练数据。</p>

        <div class="ds-actions">
          <el-button type="primary" icon="el-icon-plus" class="hero-action" @click="openCreateDialog">新建数据集</el-button>
        </div>
      </div>
    </header>

    <div class="ds-tabs-container">
      <el-tabs v-model="activeTab" @tab-click="handleTabClick" class="ds-custom-tabs">
        <el-tab-pane label="原始数据集 (待处理)" name="illegal">
          <span slot="label"><i class="el-icon-folder"></i> 原始数据集</span>
        </el-tab-pane>
        <el-tab-pane label="标准数据集 (正式/已发布)" name="standard">
          <span slot="label"><i class="el-icon-document-checked"></i> 标准数据集</span>
        </el-tab-pane>
      </el-tabs>
    </div>

    <section class="ds-toolbar">
      <div class="toolbar-left">
        <div class="search-shell">
          <i class="el-icon-search"></i>
          <el-input v-model="searchQuery" placeholder="搜索数据集..." class="search-input" clearable></el-input>
        </div>

        <div class="filter-group">
          <el-select v-model="filterType" placeholder="全部类型" class="filter-select">
            <el-option v-for="item in typeOptions" :key="item.value" :label="item.label"
              :value="item.value"></el-option>
          </el-select>
        </div>

      </div>

      <div class="toolbar-right">
        <div class="filter-group">
          <el-select v-model="activeSort" placeholder="排序方式" class="filter-select" clearable>
            <el-option v-for="item in sortOptions" :key="item.value" :label="item.label"
              :value="item.value"></el-option>
          </el-select>
        </div>
      </div>
    </section>

    <section class="ds-content" v-loading="loading">
      <section v-if="filteredDatasets.length" class="dataset-grid">
        <div class="dataset-card" v-for="d in filteredDatasets" :key="d.dataset_id" @click="goDetail(d)">
          <div v-if="activeTab === 'standard'" class="card-media"
            :style="{ backgroundImage: `url(${d.preview_image_url || defaultPreview})` }">
            <span class="card-type-badge">{{ getDatasetTypeLabel(d.dataset_type) }}</span>
            <span v-if="activeTab === 'standard' && d.format" class="card-format-badge">{{ d.format.toUpperCase()
            }}</span>
            <div class="card-overlay"></div>
          </div>
          <div v-else class="raw-card-panel">
            <span class="card-type-badge raw-type-badge">{{ getDatasetTypeLabel(d.dataset_type) }}</span>
            <div class="raw-panel-content">
              <div class="raw-panel-icon">
                <i class="el-icon-folder-opened"></i>
              </div>
              <div>
                <div class="raw-panel-kicker">原始数据集</div>
                <div class="raw-panel-title">等待映射与发布</div>
              </div>
            </div>
          </div>
          <div class="card-body">
            <div class="card-header">
              <div class="card-title">{{ d.dataset_name }}</div>
              <div class="card-id">ID: {{ d.dataset_id || '-' }}</div>
            </div>

            <div class="card-stats" :class="activeTab === 'illegal' ? 'stats-3col' : 'stats-4col'">
              <div class="stat-item">
                <div class="stat-label">图片</div>
                <div class="stat-value">
                  <i v-if="d.__stats_loading" class="el-icon-loading stat-loading-icon"></i>
                  <span v-else>{{ formatImageCount(d.num_images) }}</span>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-label">类别</div>
                <div class="stat-value">
                  <i v-if="d.__stats_loading" class="el-icon-loading stat-loading-icon"></i>
                  <span v-else>{{ formatStatValue(d.num_classes) }}</span>
                </div>
              </div>
              <div class="stat-item" v-if="activeTab === 'standard'">
                <div class="stat-label">目标数</div>
                <div class="stat-value">
                  <i v-if="d.__stats_loading" class="el-icon-loading stat-loading-icon"></i>
                  <span v-else>{{ formatStatValue(d.statistics?.total_objects) }}</span>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-label">大小</div>
                <div class="stat-value">
                  <i v-if="d.__stats_loading" class="el-icon-loading stat-loading-icon"></i>
                  <span v-else>{{ formatDatasetSize(d.dataset_size_mb) }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="card-actions">
            <el-tooltip content="修改名称" placement="top">
              <button class="card-icon-btn" type="button" :disabled="isDeletingDataset(d.dataset_id)" @click.stop="renameDataset(d)">
                <i class="el-icon-edit"></i>
              </button>
            </el-tooltip>
            <el-tooltip content="删除数据集" placement="top">
              <button class="card-icon-btn danger" type="button" :disabled="isDeletingDataset(d.dataset_id)"
                @click.stop="handleShowDeletePopup(d.dataset_id)">
                <i :class="isDeletingDataset(d.dataset_id) ? 'el-icon-loading' : 'el-icon-delete'"></i>
              </button>
            </el-tooltip>
          </div>
        </div>
      </section>

      <div v-else class="empty-state">
        <div class="empty-icon">
          <i class="el-icon-folder-opened"></i>
        </div>
        <div class="empty-title">暂无{{ activeTab === 'illegal' ? '非法' : '标准' }}数据集</div>
        <div class="empty-desc">
          <template v-if="activeTab === 'illegal'">
            原始数据集用于原始数据导入、标签映射、版本管理和发布标准数据集。
          </template>
          <template v-else>
            标准数据集用于正式的模型训练，可通过原始数据集发布或直接导入。
          </template>
        </div>
        <el-button type="primary" @click="openCreateDialog">创建数据集</el-button>
      </div>
    </section>

    <!-- Custom Popup -->
    <div v-if="showPopup" class="mask" @click="closeDeletePopup">
      <div class="popup" @click.stop>
        <div class="popup-header">
          <i class="el-icon-warning text-warning"></i>
          <span>确认删除</span>
        </div>
        <p class="popup-body">
          确定要删除此数据集吗？此操作不可撤销。删除过程可能需要一点时间，请不要重复点击。
        </p>
        <div class="popup-actions">
          <el-button :disabled="deleteSubmitting" @click="closeDeletePopup">取消</el-button>
          <el-button type="danger" :loading="deleteSubmitting" :disabled="deleteSubmitting"
            @click="handleDelete(currentDatasetId)">删除</el-button>
        </div>
      </div>
    </div>

    <el-dialog :title="`创建新${activeTab === 'illegal' ? '非法' : '标准'}数据集`" :visible.sync="dialogFormVisible" width="600px"
      custom-class="dataset-dialog" append-to-body>
      <div class="dialog-content">
        <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
          <el-form-item label="数据集名称" prop="name">
            <el-input v-model="form.name" autocomplete="off" :disabled="!!createdDatasetId"
              placeholder="例如：交通标志"></el-input>
          </el-form-item>
          <el-form-item label="任务类型" prop="type">
            <el-select v-model="form.type" placeholder="选择类型" :disabled="!!createdDatasetId" style="width: 100%">
              <el-option v-for="item in createTypeOptions" :key="item.value" :label="item.label"
                :value="item.value"></el-option>
            </el-select>
          </el-form-item>
        </el-form>

        <div class="dialog-footer-actions">
          <span v-if="createdDatasetId" class="created-tip success">
            <i class="el-icon-success"></i> 已创建! ID: {{ createdDatasetId }}
          </span>
          <div class="actions-right">
            <el-button @click="dialogFormVisible = false" v-if="!createdDatasetId">取消</el-button>
            <el-button v-if="!createdDatasetId" type="primary" :loading="creatingDataset"
              @click="handleCreateDataset">创建</el-button>

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
import { fetchIllegalDatasets, createIllegalDataset, deleteIllegalDataset, updateIllegalDataset, fetchIllegalDatasetStatistics } from "@/api/illegalDatasets";
import { fetchStandardDatasets, createStandardDataset, deleteStandardDataset, updateStandardDataset, fetchStandardDatasetStatistics, fetchStandardDatasetView } from "@/api/standardDatasets";
import { formatMb, toAbsUrl } from "@/api/apiUtils";
import defaultDatasetImg from "@/assets/images/Datasets/image.png";

export default {
  name: "DatasetsPage",
  data() {
    return {
      loading: false,
      searchQuery: "",
      filterType: "all",
      activeSort: null,

      typeOptions: [
        { value: "all", label: "全部类型" },
        { value: "detection", label: "目标检测" },
        { value: "segmentation", label: "图像分割" },
        { value: "classification", label: "图像分类" },
      ],
      createTypeOptions: [
        { value: "detection", label: "目标检测" },
        { value: "segmentation", label: "图像分割" },
        { value: "classification", label: "图像分类" },
      ],
      sortOptions: [
        { value: "category", label: "类别" },
        { value: "image", label: "图片数" },
        { value: "size", label: "大小" },
      ],

      datasets: [],
      datasetTabs: {
        illegal: { items: [], loaded: false, loading: false, lastLoadedAt: null, statsToken: 0 },
        standard: { items: [], loaded: false, loading: false, lastLoadedAt: null, statsToken: 0 },
      },

      dialogFormVisible: false,
      form: { name: "", type: "" },
      rules: {
        name: [{ required: true, message: "请输入数据集名称", trigger: "blur" }],
        type: [{ required: true, message: "请选择任务类型", trigger: "change" }],
      },
      showPopup: false,
      currentDatasetId: null,
      deleteSubmitting: false,
      deletingDatasetKey: '',
      createdDatasetId: null,
      creatingDataset: false,
      defaultPreview: defaultDatasetImg,
      activeTab: localStorage.getItem('datasets_active_tab') || 'illegal',
    };
  },
  watch: {
    dialogFormVisible(val) {
      if (!val) {
        this.resetCreatedDataset();
      }
    },
    activeTab(newTab) {
      // 监听 tab 变化，保存到 localStorage
      localStorage.setItem('datasets_active_tab', newTab);
    },
  },
  computed: {
    filteredDatasets() {
      let result = [...this.datasets];
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(dataset => (dataset.dataset_name || "").toLowerCase().includes(query));
      }
      if (this.filterType !== 'all' && this.filterType) {
        result = result.filter(dataset => dataset.dataset_type === this.filterType);
      }
      if (this.activeSort === 'category') {
        result.sort((a, b) => (b.num_classes || 0) - (a.num_classes || 0));
      } else if (this.activeSort === 'image') {
        result.sort((a, b) => (b.num_images || 0) - (a.num_images || 0));
      } else if (this.activeSort === 'size') {
        result.sort((a, b) => this.parseDatasetSize(b.dataset_size_mb) - this.parseDatasetSize(a.dataset_size_mb));
      }
      return result;
    },
  },
  methods: {
    handleTabClick() {
      this.filterType = 'all';
      this.activeSort = null;
      this.searchQuery = "";
      this.activateDatasetTab();
    },
    goDetail(dataset) {
      if (this.activeTab === 'illegal') {
        this.$router.push({
          path: "/illegal-dataset-detail",
          query: {
            id: dataset.dataset_id,
          }
        });
      } else {
        this.$router.push({
          path: "/standard-dataset-detail",
          query: {
            id: dataset.dataset_id,
          }
        });
      }
    },
    openCreateDialog() {
      this.dialogFormVisible = true;
    },
    resetCreatedDataset() {
      this.createdDatasetId = null;
      this.creatingDataset = false;
      this.form.name = "";
      this.form.type = "";
      this.$nextTick(() => { if (this.$refs.formRef) this.$refs.formRef.clearValidate(); });
    },
    goToCreatedDetail() {
      if (!this.createdDatasetId) return;
      const id = this.createdDatasetId;
      this.dialogFormVisible = false;
      if (this.activeTab === 'illegal') {
        this.$router.push({ path: "/illegal-dataset-detail", query: { id } });
      } else {
        this.$router.push({ path: "/standard-dataset-detail", query: { id } });
      }
    },
    async handleCreateDataset() {
      if (this.creatingDataset || this.createdDatasetId) return;
      try {
        this.creatingDataset = true;
        await this.$refs.formRef.validate();

        let ds;
        if (this.activeTab === 'illegal') {
          const payload = { name: this.form.name, dataset_type: this.form.type };
          ds = await createIllegalDataset(payload);
        } else {
          const payload = { name: this.form.name, dataset_type: this.form.type };
          ds = await createStandardDataset(payload);
        }

        this.createdDatasetId = ds && (ds.illegal_dataset_id || ds.standard_dataset_id || ds.id);
        this.$message.success(`Dataset Created: ${this.form.name}`);
        await this.refreshCurrentTab();
      } catch (error) {
        this.$message.error('Creation failed: ' + (error.message || error));
      } finally {
        this.creatingDataset = false;
      }
    },
    async fetchDatasetsList() {
      return this.fetchDatasetsForTab(this.activeTab, { force: false });
    },
    activateDatasetTab() {
      const cache = this.datasetTabs[this.activeTab];
      if (cache && cache.loaded) {
        this.datasets = cache.items;
        this.loading = false;
        this.loadDatasetStatsForTab(this.activeTab);
        return;
      }
      this.fetchDatasetsForTab(this.activeTab, { force: false });
    },
    async refreshCurrentTab() {
      this.invalidateDatasetTab(this.activeTab);
      await this.fetchDatasetsForTab(this.activeTab, { force: true });
    },
    invalidateDatasetTab(tab) {
      const cache = this.datasetTabs[tab];
      if (!cache) return;
      cache.loaded = false;
      cache.items = [];
      cache.lastLoadedAt = null;
      cache.statsToken += 1;
      if (tab === this.activeTab) {
        this.datasets = [];
      }
    },
    async fetchDatasetsForTab(tab, { force = false } = {}) {
      const cache = this.datasetTabs[tab];
      if (!cache) return;
      if (!force && cache.loaded) {
        if (tab === this.activeTab) this.datasets = cache.items;
        this.loadDatasetStatsForTab(tab);
        return;
      }
      try {
        cache.loading = true;
        if (tab === this.activeTab) this.loading = true;
        let list;
        if (tab === 'illegal') {
          list = await fetchIllegalDatasets({ includeStatistics: false });
        } else {
          list = await fetchStandardDatasets({ includeStatistics: false });
        }

        cache.items = (Array.isArray(list) ? list : []).map(item => this.normalizeListDataset(item, tab));
        cache.loaded = true;
        cache.lastLoadedAt = Date.now();
        cache.statsToken += 1;
        if (tab === this.activeTab) {
          this.datasets = cache.items;
          this.seedPreviewFromCache(tab);
        }
        this.loadDatasetStatsForTab(tab);
      } catch (e) {
        console.error('Failed to fetch datasets:', e);
        cache.items = [];
        cache.loaded = false;
        if (tab === this.activeTab) this.datasets = [];
      } finally {
        cache.loading = false;
        if (tab === this.activeTab) this.loading = false;
      }
    },
    normalizeListDataset(item, tab) {
      return {
        ...item,
        __tab: tab,
        __stats_loaded: !!item.statistics,
        __stats_loading: false,
        __stats_error: false,
        __preview_loading: false,
      };
    },
    seedPreviewFromCache(tab = this.activeTab) {
      const cache = this.datasetTabs[tab];
      const items = cache ? cache.items : this.datasets;
      items.forEach(d => {
        if (tab === 'illegal') {
          localStorage.removeItem(`ds_preview_illegal_${d.dataset_id}`);
          this.$set(d, 'preview_image_url', '');
          return;
        }
        const key = `ds_preview_${tab}_${d.dataset_id}`;
        const cached = localStorage.getItem(key) || '';
        const backendPreview = d.preview_image_url || '';
        const imageCount = Number(d.num_images || 0);
        if (d.__stats_loaded && imageCount <= 0) {
          localStorage.removeItem(key);
          this.$set(d, 'preview_image_url', '');
        } else if (backendPreview) {
          this.$set(d, 'preview_image_url', backendPreview);
        } else if (cached && !/images\/image\.png$/.test(cached)) {
          this.$set(d, 'preview_image_url', cached);
        } else {
          this.$set(d, 'preview_image_url', '');
        }
      });
      this.$forceUpdate();
    },
    async loadDatasetStatsForTab(tab) {
      const cache = this.datasetTabs[tab];
      if (!cache || !cache.items.length) return;
      const token = cache.statsToken;
      const pending = cache.items.filter(d => d && d.dataset_id && !d.__stats_loaded && !d.__stats_loading);
      if (!pending.length) return;
      await this.runLimited(pending, 4, async dataset => {
        if (token !== cache.statsToken) return;
        this.$set(dataset, '__stats_loading', true);
        this.$set(dataset, '__stats_error', false);
        try {
          const stats = tab === 'illegal'
            ? await fetchIllegalDatasetStatistics(dataset.dataset_id)
            : await fetchStandardDatasetStatistics(dataset.dataset_id);
          if (token !== cache.statsToken) return;
          this.applyDatasetStatistics(dataset, stats);
          this.$set(dataset, '__stats_loading', false);
          if (tab === 'standard') {
            await this.ensureStandardPreview(dataset, token);
          }
        } catch (error) {
          console.warn('Failed to load dataset statistics:', error);
          if (token === cache.statsToken) this.$set(dataset, '__stats_error', true);
        } finally {
          if (token === cache.statsToken) this.$set(dataset, '__stats_loading', false);
        }
      });
    },
    async runLimited(items, limit, worker) {
      let cursor = 0;
      const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
          const item = items[cursor++];
          await worker(item);
        }
      });
      await Promise.all(runners);
    },
    applyDatasetStatistics(dataset, stats) {
      const totalImages = stats?.num_images ?? stats?.total_images ?? stats?.image_count ?? null;
      const numClasses = stats?.num_classes ?? null;
      const sizeMb = stats?.size_mb ?? stats?.total_size_mb ?? stats?.dataset_size_mb ?? null;
      this.$set(dataset, 'statistics', stats || null);
      this.$set(dataset, 'num_images', totalImages);
      this.$set(dataset, 'num_classes', numClasses);
      this.$set(dataset, 'dataset_size_mb', sizeMb != null ? formatMb(sizeMb) : null);
      this.$set(dataset, '__stats_loaded', true);
    },
    async ensureStandardPreview(dataset, token) {
      if (!dataset) return;
      const tab = 'standard';
      const cache = this.datasetTabs[tab];
      if (!cache) return;
      const key = `ds_preview_${tab}_${dataset.dataset_id}`;
      if (Number(dataset.num_images || 0) <= 0) {
        localStorage.removeItem(key);
        this.$set(dataset, 'preview_image_url', '');
        return;
      }
      if (dataset.preview_image_url) return;
      const cached = localStorage.getItem(key) || '';
      if (cached && !/images\/image\.png$/.test(cached)) {
        this.$set(dataset, 'preview_image_url', cached);
        return;
      }
      if (dataset.__preview_loading) return;
      this.$set(dataset, '__preview_loading', true);
      try {
        const view = await fetchStandardDatasetView(dataset.dataset_id, { page: 1, pageSize: 1 });
        if (token !== cache.statsToken) return;
        const first = Array.isArray(view?.items) ? view.items[0] : null;
        const preview = toAbsUrl(first?.thumbnail_url || first?.image_url || '');
        if (preview) {
          localStorage.setItem(key, preview);
          this.$set(dataset, 'preview_image_url', preview);
        }
      } catch (error) {
        console.warn('Failed to load dataset preview:', error);
      } finally {
        if (cache && token === cache.statsToken) this.$set(dataset, '__preview_loading', false);
      }
    },
    datasetDeleteKey(id, kind = this.activeTab) {
      return `${kind}:${id}`;
    },
    isDeletingDataset(id) {
      return !!id && this.deletingDatasetKey === this.datasetDeleteKey(id);
    },
    closeDeletePopup() {
      if (this.deleteSubmitting) return;
      this.showPopup = false;
    },
    async handleDelete(id) {
      if (!id || this.deleteSubmitting) return;
      const kind = this.activeTab;
      this.deleteSubmitting = true;
      this.deletingDatasetKey = this.datasetDeleteKey(id, kind);
      try {
        if (kind === 'illegal') {
          await deleteIllegalDataset(id, { force: false, deleteFiles: true });
        } else {
          await deleteStandardDataset(id, { force: false, deleteFiles: true });
        }
        this.showPopup = false;
        await this.refreshCurrentTab();
        this.$message.success('数据集删除完成');
      } catch (error) {
        if (this.isDeleteConflict(error)) {
          this.showPopup = false;
          try {
            await this.$confirm(
              '该数据集有关联项目/训练任务或增强任务，是否强制链式删除？',
              '确认强制删除',
              { type: 'warning', confirmButtonText: '强制删除', cancelButtonText: '取消' }
            );
            if (kind === 'illegal') {
              await deleteIllegalDataset(id, { force: true, deleteFiles: true });
            } else {
              await deleteStandardDataset(id, { force: true, deleteFiles: true });
            }
            await this.refreshCurrentTab();
            this.$message.success('数据集删除完成');
          } catch (forceError) {
            if (forceError !== 'cancel' && forceError !== 'close') {
              this.$message.error(`Delete failed: ${forceError.message || forceError}`);
            }
          }
          return;
        }
        this.$message.error(`Delete failed: ${error.message}`);
      } finally {
        this.deleteSubmitting = false;
        this.deletingDatasetKey = '';
      }
    },
    isDeleteConflict(error) {
      if (error && error.status === 409) return true;
      const msg = String((error && error.message) || '').toLowerCase();
      return msg.includes('cannot delete') || msg.includes('still reference');
    },
    handleShowDeletePopup(datasetId) {
      if (this.isDeletingDataset(datasetId) || this.deleteSubmitting) return;
      this.currentDatasetId = datasetId;
      this.showPopup = true;
    },
    async renameDataset(dataset) {
      if (!dataset || !dataset.dataset_id) return;
      const oldName = String(dataset.dataset_name || dataset.name || '').trim();
      try {
        const { value } = await this.$prompt('请输入新的数据集名称', '修改数据集名称', {
          confirmButtonText: '保存',
          cancelButtonText: '取消',
          inputValue: oldName,
          inputPlaceholder: '数据集名称',
          inputPattern: /\S+/,
          inputErrorMessage: '数据集名称不能为空',
          closeOnClickModal: false,
        });
        const newName = String(value || '').trim();
        if (!newName || newName === oldName) return;
        if (this.activeTab === 'illegal') {
          await updateIllegalDataset(dataset.dataset_id, { name: newName });
        } else {
          await updateStandardDataset(dataset.dataset_id, { name: newName });
        }
        this.$set(dataset, 'name', newName);
        this.$set(dataset, 'dataset_name', newName);
        this.$message.success('数据集名称已更新');
      } catch (error) {
        if (error === 'cancel' || error === 'close') return;
        this.$message.error(`修改失败：${error.message || error}`);
      }
    },
    formatImageCount(count) {
      if (count === null || count === undefined || count === '') return '--';
      count = Number(count);
      if (!Number.isFinite(count)) return '--';
      if (count === 0) return '0';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
      return count.toString();
    },
    formatStatValue(value) {
      if (value === null || value === undefined || value === '') return '--';
      const num = Number(value);
      if (!Number.isFinite(num)) return '--';
      return num.toString();
    },
    formatDatasetSize(sizeStr) {
      if (typeof sizeStr === 'number') return formatMb(sizeStr);
      const text = String(sizeStr || '').trim();
      if (!text) return '--';
      const match = text.match(/(\d+\.?\d*)\s*(GB|MB)?/i);
      if (!match) return text;
      const value = parseFloat(match[1]);
      if (!Number.isFinite(value)) return '--';
      const unit = String(match[2] || 'MB').toUpperCase();
      return formatMb(unit === 'GB' ? value * 1024 : value);
    },
    getDatasetTypeLabel(type) {
      const map = { 'detection': '目标检测', 'segmentation': '图像分割', 'classification': '图像分类' };
      return map[type] || type || '未知';
    },
    parseDatasetSize(sizeStr) {
      if (!sizeStr) return 0;
      if (typeof sizeStr === 'number') return sizeStr;
      const match = String(sizeStr).match(/(\d+\.?\d*)\s*(GB|MB)?/i);
      if (!match) return 0;
      const value = parseFloat(match[1]);
      if (!Number.isFinite(value)) return 0;
      const unit = String(match[2] || 'MB').toUpperCase();
      return unit === 'GB' ? value * 1024 : value;
    },
  },
  mounted() {
    this.activateDatasetTab();
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

.ds-tabs-container {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 0 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.ds-custom-tabs ::v-deep .el-tabs__nav-wrap::after {
  height: 1px;
  background-color: var(--border-color);
}

.ds-custom-tabs ::v-deep .el-tabs__item {
  font-size: 1rem;
  height: 50px;
  line-height: 50px;
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

.toolbar-left,
.toolbar-right {
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

.search-input ::v-deep .el-input__inner:focus {
  border: none;
  box-shadow: none;
  outline: none;
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

.raw-card-panel {
  height: 180px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 18px 24px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 233, 0.06)),
    var(--bg-body);
  border-bottom: 1px solid var(--border-light);
  overflow: hidden;
}

.raw-card-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent 78%);
  pointer-events: none;
}

.raw-card-panel::after {
  content: "";
  position: absolute;
  width: 120px;
  height: 120px;
  right: -36px;
  bottom: -42px;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.08);
  pointer-events: none;
}

.raw-type-badge {
  background: rgba(255, 255, 255, 0.92);
}

.raw-panel-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}

.raw-panel-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.88);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  font-size: 1.5rem;
}

.raw-panel-kicker {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.raw-panel-title {
  color: var(--text-main);
  font-weight: 800;
  font-size: 1.05rem;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent);
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
  right: 50px;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: var(--shadow-sm);
  z-index: 2;
}

.card-format-badge {
  background: #eff8ff;
  color: #175cd3;
}

.card-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  z-index: 2;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
}

.card-icon-btn {
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
  transition: all 0.2s;
}

.dataset-card:hover .card-actions {
  opacity: 1;
  visibility: visible;
}

.card-icon-btn:hover {
  background: white;
  color: var(--color-primary);
  transform: scale(1.1);
}

.card-icon-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
  transform: none;
}

.card-icon-btn.danger:hover {
  color: var(--color-danger);
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
  /* grid-template-columns: repeat(3, 1fr); */
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
}

.stats-3col {
  grid-template-columns: repeat(3, 1fr);
}

.stats-4col {
  grid-template-columns: repeat(4, 1fr);
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

.stat-loading-icon {
  color: var(--text-secondary);
  font-size: 0.85rem;
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
