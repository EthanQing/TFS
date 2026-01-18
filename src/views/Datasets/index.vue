<template>
  <div class="datasets">
    <div class="top">
      <h3>数据</h3>
      <el-button
        type="primary"
        class="custom-primary-btn"
        @click="dialogFormVisible = true"
        >上传数据集</el-button
      >
    </div>

    <div class="secondFloor">
      <i class="el-icon-s-operation" @click="changeShow"></i>
      <el-input
        v-model="searchQuery"
        placeholder="请输入数据集名称"
        class="input"
      ></el-input>
      <div class="topNavigation">
        <el-menu
          :default-active="activeIndex"
          class="el-menu-demo"
          mode="horizontal"
          @select="handleSelect"
        >
          <el-menu-item index="1" class="nav-item">全部</el-menu-item>
        </el-menu>
      </div>
    </div>
    <div class="searchShow" v-show="isShow">
      <el-select v-model="value" placeholder="请选择" class="selectPart" @change="handleFilterChange">
        <el-option
          v-for="item in options"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        >
        </el-option>
      </el-select>
      <el-button
        class="filter-btn"
        :class="{ 'active-btn': activeFilter === 'category' }"
        @click="setActiveFilter('category')"
        >分类</el-button
      >
      <el-button
        class="filter-btn"
        :class="{ 'active-btn': activeFilter === 'image' }"
        @click="setActiveFilter('image')"
        >图片</el-button
      >
      <el-button
        class="filter-btn"
        :class="{ 'active-btn': activeFilter === 'size' }"
        @click="setActiveFilter('size')"
        >大小</el-button
      >
    </div>
    <div class="showList">
      <div
        class="pictureItem"
        v-for="d in filteredDatasets"
        :key="d.dataset_id"
        @click="goDetail(d)"
      >
        <div class="wordsPart">
          <span class="messageTitle">{{ d.dataset_name }}</span
          ><br />
          <span class="message">
            类型：{{ getDatasetTypeLabel(d.dataset_type) }} | 一个对图片分类与AI模型训练至关重要的数据集
          </span>
        </div>
        <div class="dataPart">
          <div class="classes">{{ d.num_classes || 0 }} 分类</div>
          <div class="images">{{ formatImageCount(d.num_images) }}图片</div>
          <div class="MBsize">{{ formatDatasetSize(d.dataset_size_mb) }}</div>
        </div>
        <div class="image-part" :style="{ backgroundImage: `url(${d.preview_image_url || defaultPreview})` }"></div>
        <div class="more" @click.stop="handleShowDeletePopup(d.dataset_id)">
          . . .
        </div>
      </div>
    </div>

    <!-- 弹窗和遮罩层 -->
    <div v-if="showPopup" class="mask" @click="showPopup = false">
      <div class="popup" @click.stop>
        <p>是否删除此数据集</p>
        <button @click="showPopup = false">取消</button>
        <button @click="handleDelete(currentDatasetId)">确认</button>
      </div>
    </div>

    <!-- 创建项目对话框 -->
    <el-dialog
      title="创建数据集"
      :visible.sync="dialogFormVisible"
      width="800px"
    >
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item
          label="数据集名称"
          :label-width="formLabelWidth"
          prop="name"
        >
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item
          label="数据集类型"
          :label-width="formLabelWidth"
          prop="type"
        >
          <el-select v-model="form.type" placeholder="请选择">
            <el-option
              v-for="item in selectOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <UploadZip
        :dataset-name="form.name"
        :dataset-type="form.type"
        @upload-success="handleUploadSuccess"
        @upload-fail="handleUploadFail"
      ></UploadZip>
    </el-dialog>
  </div>
</template>

<script>
import { fetchDatasets, deleteDataset, FetchDatasetStatistics, FetchDatasetPreviewImage, FetchDatasetClassNames } from "@/api/datasets";
import UploadZip from "@/components/Upload/index.vue";
import defaultDatasetImg from "@/assets/images/Datasets/image.png";

export default {
  name: "Datasets",
  components: { UploadZip },
  data() {
    return {
      searchQuery: "", // 搜索关键词
      activeIndex: "1",
      options: [
        { value: "all", label: "全部" },
        { value: "detection", label: "Detect(目标检测)" },
        { value: "segmentation", label: "Segment(实例分割)" },
        { value: "classification", label: "Classify(分类)" },
      ],
      selectOptions: [
        { value: "detection", label: "Detect(目标检测)" },
        { value: "segmentation", label: "Segment(实例分割)" },
        { value: "classification", label: "Classify(分类)" },
      ],
      value: "all",
      isShow: true,
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
      defaultPreview: defaultDatasetImg,
    };
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
    handleSelect(key, keyPath) {
      this.activeIndex = key;
    },
    changeShow() {
      this.isShow = !this.isShow;
    },
    setActiveFilter(filter) {
      this.activeFilter = this.activeFilter === filter ? null : filter;
    },
    // 处理筛选器变化
    handleFilterChange() {
      // 筛选变化时会自动触发computed重新计算
    },
    goDetail(dataset) {
      console.log('点击的数据集信息:', dataset);
      if (this.$route.path !== "/datadetail") {
        const queryData = {
          datasetId: dataset.dataset_id,
          datasetName: dataset.dataset_name,
          datasetType: dataset.dataset_type,
          numClasses: dataset.num_classes,
          numImages: dataset.num_images,
          datasetSize: dataset.dataset_size_mb
        };
        console.log('准备传递的query数据:', queryData);
        this.$router.push({
          path: "/datadetail",
          query: queryData
        });
      }
    },
    handleUploadSuccess(datasetId) {
      this.$message.success(`数据集上传成功，ID: ${datasetId}`);
      this.dialogFormVisible = false;
      this.$refs.formRef.resetFields();
      this.fetchDatasetsList();
    },
    handleUploadFail(errorMsg) {
      this.$message.error(`上传失败: ${errorMsg}`);
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
        console.error('获取数据集失败:', e);
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
        await deleteDataset(id);
        this.showPopup = false;
        this.fetchDatasetsList();
      } catch (error) {
        alert(`删除失败：${error.message}`);
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
        'segmentation': '实例分割', 
        'classification': '分类',
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
.datasets {
  margin-left: 10px;
  box-sizing: border-box;
  width: calc(100% - 10px); /* 占据父容器全部宽度（减去左侧margin） */
  /* 去掉最大宽度限制，允许铺满到屏幕右侧 */
  max-width: none;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.top h3 {
  font-size: 24px;
  font-weight: bolder;
  color: #111f68;
}
.secondFloor {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 16px;
}
.el-menu-demo {
  display: flex;
}
.input {
  margin: 0 20px;
  width: 300px;
  max-width: 500px;
}

.el-dropdown-link {
  cursor: pointer;
  color: #409eff;
}
.el-icon-arrow-down {
  font-size: 12px;
}
.selectPart {
  margin-right: 20px;
  margin-left: 3px;
  width: 350px;
}

.searchShow {
  margin-top: 30px;
  display: flex;
  align-items: center;
}

.pictureItem {
  position: relative;
  height: 200px;
  background-color: #fff;
  border-radius: 20px;
  margin: 16px 0; /* 横向间距交给父容器的 gap 控制 */
  flex: 1 1 65%;
  max-width: 48%;
  min-width: 300px;
  box-sizing: border-box;
  box-shadow: 0 0 10px 3px rgba(0, 0, 0, 0.05);
}
.pictureItem:hover {
  box-shadow: 0 0 12px 3px rgba(0, 0, 0, 0.1);
}
.showList {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  width: 100%;
}
.wordsPart {
  margin: 25px;
  width: 50%;
}
.messageTitle {
  font-size: 20px;
  font-weight: bolder;
}
.message {
  font-size: 15px;
}
.dataPart {
  margin: 20px;
  margin-top: 35px;
  display: flex;
  gap: 10px;
  font-size: 12px;
}
.classes {
  width: 65px;
  height: 30px;
  border-radius: 3px;
  background-color: #f3f3f3;
  line-height: 30px;
  text-align: center;
}
.images {
  width: 65px;
  height: 30px;
  border-radius: 3px;
  background-color: #f3f3f3;
  line-height: 30px;
  text-align: center;
}
.MBsize {
  width: 65px;
  height: 30px;
  border-radius: 3px;
  background-color: #f3f3f3;
  line-height: 30px;
  text-align: center;
}

::v-deep .custom-primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #111f68 !important;
  border-color: #111f68 !important;
  border-radius: 20px;
  position: absolute;
  top:20px;
  right:20px
}

::v-deep .custom-primary-btn:hover {
  background-color: #25388e !important;
  border-color: #25388e !important;
}

::v-deep .filter-btn {
  background-color: #ffffff !important;
  border-color: #111f68 !important;
  color: #111f68 !important;
  border-radius: 20px !important;
  margin-right: 10px !important;
}

::v-deep .filter-btn.active-btn {
  background-color: #111f68 !important;
  border-color: #111f68 !important;
  color: #ffffff !important;
}

::v-deep .el-menu-demo {
  border-bottom: none !important;
}

::v-deep .el-menu-demo .nav-item {
  margin: 0 10px !important;
  min-width: 80px !important;
  text-align: center !important;
}

::v-deep .el-menu-demo .el-menu-item.is-active {
  color: #111f68 !important;
  border-bottom: 2px solid #111f68 !important;
}
.image-part {
  position: absolute;
  top: 20px;
  right: 10px;
  width: 45%;
  height: 80%;
  /* background-color: #25388e; */
  border-radius: 10px;
  background-image: url(~@/assets/images/Datasets/image.png);
  background-size: cover;
  background-position: center;
}
.el-dialog {
  width: 600px !important;
}

.el-form-item {
  margin-bottom: 20px !important;
}

.el-input {
  width: 80%;
}

/* 只影响对话框内的按钮和弹窗按钮，不影响筛选按钮 */
.el-dialog .el-button,
.popup button {
  background-color: #111f68 !important;
  color: #fff !important;
  border-color: #111f68;
  border-radius: 20px;
}
.more {
  position: absolute;
  width: 30px;
  height: 30px;
  right: 5px;
  top: 5px;
  background-color: #f3f3f3;
  border-radius: 50%;
  line-height: 25px;
  text-align: center;
  color: rgb(161, 155, 155);
  cursor: pointer;

  /* 修改点：使用visibility替代display */
  visibility: hidden;
  opacity: 0;
  transition: opacity 0.3s ease-in-out, visibility 0.3s;

  /* 可选：添加缩放效果增强视觉体验 */
  transform: scale(0.8);
  transition: opacity 0.2s ease-in-out, visibility 0.3s, transform 0.3s;
}

.pictureItem:hover .more {
  visibility: visible;
  opacity: 1;

  /* 可选：添加缩放效果增强视觉体验 */
  transform: scale(1);
}
.more:hover {
  background-color: #dddcdc;
  color: rgb(131, 127, 127);
}

/* 新增：弹窗和遮罩样式 */
.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.popup {
  width: 400px;
  height: 120px;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-sizing: border-box;
}
.popup p {
  font-size: 20px;
  margin-left: 100px;
  color: #111f68;
}
.popup button {
  width: 50px;
  height: 30px;
  background-color: #111f68;
  color: #fff;
  border-radius: 10px;
  /* margin: 20px 5px; */
  margin-top: 20px;
}
.popup button:nth-child(2) {
  margin-left: 240px;
  margin-right: 10px;
}
.el-icon-s-operation{
  cursor: pointer;
  width: 25px;
  height: 25px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: font-size 0.1s ease-in-out;
}
.el-icon-s-operation:hover{
  font-size: 22px;
}

/* 响应式：中屏时两列更紧凑，小屏单列铺满，避免拥挤与空白 */
@media (max-width: 1200px) {
  .pictureItem {
    flex-basis: 45%;
    max-width: 45%;
  }
}
@media (max-width: 768px) {
  .pictureItem {
    flex-basis: 100%;
    max-width: 100%;
    min-width: 0;
  }
}
</style>
