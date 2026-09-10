<template>
  <div class="architecture-page page-container">
    <header class="arch-hero">
      <div class="arch-hero-content">
        <div class="arch-eyebrow">模型库</div>
        <h1 class="arch-title">模型架构</h1>
        <p class="arch-subtitle">浏览支持的主干网络和变体。</p>
      </div>
      
      <div class="arch-hero-stats">
        <div class="hero-stat">
          <div class="stat-value">{{ groupedList.length }}</div>
          <div class="stat-label">系列</div>
        </div>
        <div class="hero-stat">
          <div class="stat-value">{{ totalArchitectures }}</div>
          <div class="stat-label">总数</div>
        </div>
        <el-button type="primary" plain @click="openPackageDialog">
          自定义模型包
        </el-button>
        <el-button type="primary" class="refresh-btn" icon="el-icon-refresh" circle @click="fetchArchitectures"></el-button>
      </div>
    </header>

    <section class="arch-filter-bar">
      <div class="filter-label">框架筛选</div>
      <el-radio-group v-model="activeFramework" size="small">
        <el-radio-button
          v-for="item in frameworkFilters"
          :key="item.key"
          :label="item.key"
        >
          {{ item.label }} ({{ frameworkCounts[item.key] || 0 }})
        </el-radio-button>
      </el-radio-group>
    </section>

    <section class="arch-body">
      <div v-if="loading" class="state loading">
        <i class="el-icon-loading"></i>
        <span>正在加载模型架构...</span>
      </div>

      <div v-else-if="error" class="state error">
        <i class="el-icon-warning"></i>
        <span>{{ error }}</span>
        <el-button size="mini" type="primary" @click="fetchArchitectures">Retry</el-button>
      </div>

      <div v-else-if="groupedList.length === 0" class="state empty">
        <i class="el-icon-info"></i>
        <span>暂无架构数据。</span>
      </div>

      <div v-else class="family-groups">
        <section class="family-group" v-for="group in groupedList" :key="group.key">
          <header class="family-header">
            <div class="family-title">{{ group.family }}</div>
            <div class="family-count">{{ group.items.length }} variants</div>
          </header>
          <div class="arch-grid">
            <article v-for="item in group.items" :key="item.arch_id || item.model_variant" class="arch-card">
              <div class="arch-card-header">
                <div class="arch-name" :title="formatVariant(item.model_variant, item)">
                  {{ formatVariant(item.model_variant, item) || 'Unnamed' }}
                </div>
                <div class="arch-tags">
                  <span class="arch-tag framework">{{ displayFrameworkLabel(item) }}</span>
                  <span v-if="item.task_type" class="arch-tag">{{ displayTaskType(item.task_type) }}</span>
                </div>
              </div>
              <div class="arch-meta">
                <div class="meta-row" v-if="item.arch_id">
                  <span class="meta-label">ID</span>
                  <span class="meta-value">{{ item.arch_id }}</span>
                </div>
                <div class="meta-row" v-if="item.pretrained_path">
                  <span class="meta-label">Pretrained</span>
                  <el-tooltip :content="item.pretrained_path" placement="top" :open-delay="500">
                    <span class="meta-value">{{ truncate(item.pretrained_path) }}</span>
                  </el-tooltip>
                </div>
                <div
                  v-if="isCustomArchitecture(item) && item.custom_model_package_id !== null && item.custom_model_package_id !== undefined"
                  class="meta-row"
                >
                  <span class="meta-label">Package</span>
                  <span class="meta-value">#{{ item.custom_model_package_id }}</span>
                </div>
                <div v-if="isCustomArchitecture(item) && item.description" class="meta-row">
                  <span class="meta-label">说明</span>
                  <el-tooltip :content="item.description" placement="top" :open-delay="500">
                    <span class="meta-value">{{ truncate(item.description) }}</span>
                  </el-tooltip>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>

    <el-dialog
      title="自定义模型包"
      :visible.sync="packageDialogVisible"
      width="1000px"
      append-to-body
      @closed="resetPackageUpload"
    >
      <div class="package-toolbar">
        <el-upload
          ref="packageUploader"
          action="#"
          accept=".zip"
          :auto-upload="false"
          :limit="1"
          :on-change="handlePackageFileChange"
          :on-remove="handlePackageFileRemove"
          :on-exceed="handlePackageFileExceed"
        >
          <el-button size="small" icon="el-icon-upload2">选择 ZIP</el-button>
          <div slot="tip" class="el-upload__tip">仅支持 .zip 源码包</div>
        </el-upload>
        <div class="package-upload-actions">
          <el-button
            type="primary"
            size="small"
            :loading="packageUploading"
            :disabled="!packageUploadFile"
            @click="uploadPackage"
          >
            上传
          </el-button>
          <el-button size="small" :loading="packageLoading" @click="loadPackageList">
            刷新列表
          </el-button>
        </div>
      </div>
      <div v-if="packageUploadError" class="package-upload-error">{{ packageUploadError }}</div>

      <div v-if="packageLoading" class="state loading package-state">
        <i class="el-icon-loading"></i>
        <span>正在加载自定义模型包...</span>
      </div>
      <div v-else-if="packageError" class="state error package-state">
        <i class="el-icon-warning"></i>
        <span>{{ packageError }}</span>
        <el-button size="mini" type="primary" @click="loadPackageList">重试</el-button>
      </div>
      <div v-else-if="!packages.length" class="state empty package-state">
        <i class="el-icon-info"></i>
        <span>暂无自定义模型包，请上传 ZIP 源码包。</span>
      </div>
      <el-table v-else :data="packages" border stripe size="small" class="package-table">
        <el-table-column label="名称" min-width="150">
          <template slot-scope="scope">
            <div class="package-name">{{ packageName(scope.row) }}</div>
            <div class="package-id">#{{ scope.row.package_id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="Entrypoint" min-width="180">
          <template slot-scope="scope">{{ formatEntrypoint(scope.row) }}</template>
        </el-table-column>
        <el-table-column prop="runtime_profile" label="Runtime" min-width="130">
          <template slot-scope="scope">{{ scope.row.runtime_profile || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="155">
          <template slot-scope="scope">{{ formatPackageDate(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template slot-scope="scope">
            <el-tag :type="scope.row.retired_at ? 'info' : 'success'" size="mini">
              {{ scope.row.retired_at ? '已停用' : '可用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="SHA256" min-width="135">
          <template slot-scope="scope">
            <el-tooltip :content="scope.row.source_sha256 || '-'"><span>{{ truncateHash(scope.row.source_sha256) }}</span></el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template slot-scope="scope">
            <el-button
              v-if="!scope.row.retired_at"
              type="text"
              size="small"
              :disabled="retiringPackageId === scope.row.package_id"
              @click="retirePackage(scope.row)"
            >
              停用
            </el-button>
            <el-button
              type="text"
              size="small"
              :disabled="Boolean(scope.row.retired_at)"
              @click="openRegisterDialog(scope.row)"
            >
              注册架构
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog
      title="注册自定义模型架构"
      :visible.sync="registerDialogVisible"
      width="520px"
      append-to-body
    >
      <div v-if="selectedPackage" class="selected-package">
        <div><span>模型包：</span>{{ packageName(selectedPackage) }}</div>
        <div><span>Package ID：</span>#{{ selectedPackage.package_id }}</div>
      </div>
      <el-form ref="registerForm" :model="registerForm" :rules="registerRules" label-width="90px">
        <el-form-item label="Family" prop="family">
          <el-input v-model="registerForm.family" placeholder="请输入模型系列"></el-input>
        </el-form-item>
        <el-form-item label="Variant" prop="variant">
          <el-input v-model="registerForm.variant" placeholder="请输入模型变体"></el-input>
        </el-form-item>
        <el-form-item label="任务类型" prop="task_type">
          <el-select v-model="registerForm.task_type" placeholder="请选择任务类型" style="width: 100%">
            <el-option label="目标检测" value="detection"></el-option>
            <el-option label="图像分割" value="segmentation"></el-option>
            <el-option label="图像分类" value="classification"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="registerForm.description" type="textarea" :rows="3" placeholder="可选"></el-input>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="registerDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="registering" @click="registerArchitecture">注册</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { CreateArchitecture } from "@/api/models";
import {
  fetchCustomModelPackages,
  uploadCustomModelPackage,
  retireCustomModelPackage,
} from "@/api/customModels";
import { referenceStore, loadArchitectures } from "@/store/referenceStore";
import { resolveFramework } from "@/utils/trainingFramework";

const FRAMEWORK_FILTERS = [
  { key: "all", label: "全部", engine: "" },
  { key: "pytorch", label: "PyTorch (YOLO)", engine: "ultralytics-yolo" },
  { key: "paddle", label: "Paddle", engine: "paddle-det" },
  { key: "engine:custom-source", label: "自定义模型", engine: "custom-source" },
];

export default {
  name: "ModelArchitecture",
  data() {
    return {
      architectures: null,
      loading: false,
      error: null,
      activeFramework: "all",
      frameworkFilters: FRAMEWORK_FILTERS,
      packageDialogVisible: false,
      packageLoading: false,
      packageError: null,
      packages: [],
      packageTotal: 0,
      packageUploadFile: null,
      packageUploadError: null,
      packageUploading: false,
      retiringPackageId: null,
      registerDialogVisible: false,
      selectedPackage: null,
      registering: false,
      registerForm: {
        family: "",
        variant: "",
        task_type: "detection",
        description: "",
      },
      registerRules: {
        family: [{
          validator: (rule, value, callback) => {
            if (String(value || '').trim()) {
              callback();
              return;
            }
            callback(new Error("请输入模型系列"));
          },
          trigger: "blur",
        }],
        variant: [{
          validator: (rule, value, callback) => {
            if (String(value || '').trim()) {
              callback();
              return;
            }
            callback(new Error("请输入模型变体"));
          },
          trigger: "blur",
        }],
        task_type: [{ required: true, message: "请选择任务类型", trigger: "change" }],
      },
    };
  },
  computed: {
    frameworkCounts() {
      const counts = { all: 0 };
      const source = Array.isArray(this.architectures) ? this.architectures : [];
      source.forEach((item) => {
        counts.all += 1;
        const key = this.frameworkKey(item);
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    },
    filteredArchitectures() {
      if (!Array.isArray(this.architectures)) return [];
      if (this.activeFramework === "all") return this.architectures;
      return this.architectures.filter((item) => this.frameworkKey(item) === this.activeFramework);
    },
    groupedList() {
      if (!this.filteredArchitectures.length) return [];
      const map = {};
      this.filteredArchitectures.forEach(it => {
        const fam = it.model_family || 'Uncategorized';
        const isCustom = this.isCustomArchitecture(it);
        const key = `${isCustom ? 'custom' : 'builtin'}:${fam}`;
        if (!map[key]) {
          map[key] = { key, family: fam, isCustom, items: [] };
        }
        map[key].items.push(it);
      });
      const sizeOrder = { t:0, n:1, s:2, m:3, b:4, l:5, x:6, c:7, e:8 };
      const taskOrder = (variant='') => {
        if (variant.endsWith('-seg')) return 2;
        if (variant.endsWith('-cls')) return 1;
        return 0;
      };
      const sizeRank = (variant='') => {
        const base = String(variant || '').toLowerCase().replace(/-(cls|seg)$/,'');
        const rtDetr = base.match(/^rtdetr-([a-z0-9]+)$/);
        if (rtDetr && rtDetr[1] in sizeOrder) return sizeOrder[rtDetr[1]];
        const letter = base.slice(-1);
        return letter in sizeOrder ? sizeOrder[letter] : 999;
      };
      // Version-based family order
      const familyOrder = ['YOLOv8', 'YOLOv9', 'YOLOv10', 'YOLO11', 'YOLO12', 'YOLO26', 'RT-DETR', 'PP-YOLOE', 'PicoDet'];
      const familyRank = (name) => {
        const idx = familyOrder.indexOf(name);
        return idx >= 0 ? idx : 999;
      };
      const naturalCompare = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return Object.entries(map)
        .map(([, group]) => group)
        .sort((a, b) => {
          if (this.activeFramework === 'all' && a.isCustom !== b.isCustom) {
            return a.isCustom ? 1 : -1;
          }
          if (a.family === 'Uncategorized') return 1;
          if (b.family === 'Uncategorized') return -1;
          if (a.isCustom || b.isCustom) {
            return naturalCompare(a.family, b.family);
          }
          const ra = familyRank(a.family);
          const rb = familyRank(b.family);
          if (ra !== rb) return ra - rb;
          return naturalCompare(a.family, b.family);
        })
        .map((group) => ({
          key: group.key,
          family: group.family,
          items: group.items.slice().sort((a, b) => {
            if (group.isCustom) {
              return naturalCompare(a.model_variant, b.model_variant);
            }
            const ta = taskOrder(a.model_variant);
            const tb = taskOrder(b.model_variant);
            if (ta !== tb) return ta - tb;
            const sa = sizeRank(a.model_variant);
            const sb = sizeRank(b.model_variant);
            if (sa !== sb) return sa - sb;
            return (a.model_variant || '').localeCompare(b.model_variant || '');
          })
        }));
    },
    totalArchitectures() {
      return this.filteredArchitectures.length;
    },
  },
  methods: {
    frameworkKey(item) {
      return resolveFramework(item?.engine || "").frameworkKey;
    },
    isCustomArchitecture(item) {
      return String(item?.engine || "").trim().toLowerCase() === "custom-source";
    },
    displayFrameworkLabel(item) {
      return resolveFramework(item?.engine || "").frameworkLabel;
    },
    async fetchArchitectures() {
      this.loading = true;
      this.error = null;
      try {
        await loadArchitectures({ force: true });
        this.architectures = referenceStore.architectures;
        if (referenceStore.error.architectures) {
          this.error = referenceStore.error.architectures;
        }
      } catch (error) {
        this.error = error.message || "Failed to load architectures.";
      } finally {
        this.loading = false;
      }
    },
    openPackageDialog() {
      this.packageDialogVisible = true;
      this.loadPackageList();
    },
    async loadPackageList() {
      this.packageLoading = true;
      this.packageError = null;
      try {
        const response = await fetchCustomModelPackages({
          include_retired: true,
          skip: 0,
          limit: 100,
        });
        this.packages = Array.isArray(response?.items) ? response.items : [];
        this.packageTotal = Number(response?.total || this.packages.length);
      } catch (error) {
        this.packageError = error.message || "加载自定义模型包失败。";
      } finally {
        this.packageLoading = false;
      }
    },
    handlePackageFileChange(file) {
      this.packageUploadError = null;
      const name = String(file?.name || file?.raw?.name || "");
      if (!/\.zip$/i.test(name)) {
        if (this.$refs.packageUploader) this.$refs.packageUploader.clearFiles();
        this.packageUploadFile = null;
        this.packageUploadError = "仅支持 .zip 文件。";
        return;
      }
      this.packageUploadFile = file.raw || file;
    },
    handlePackageFileRemove() {
      this.packageUploadFile = null;
      this.packageUploadError = null;
    },
    handlePackageFileExceed() {
      this.packageUploadError = "一次只能选择一个 ZIP 文件。";
    },
    async uploadPackage() {
      if (!this.packageUploadFile) return;
      this.packageUploading = true;
      this.packageUploadError = null;
      try {
        await uploadCustomModelPackage(this.packageUploadFile);
        this.$message.success("自定义模型包上传成功");
        if (this.$refs.packageUploader) this.$refs.packageUploader.clearFiles();
        this.packageUploadFile = null;
        await this.loadPackageList();
      } catch (error) {
        this.packageUploadError = error.message || "上传失败。";
      } finally {
        this.packageUploading = false;
      }
    },
    async retirePackage(packageItem) {
      try {
        await this.$confirm(
          "停用后，该模型包不能再用于创建新的架构或训练任务，但历史架构和训练记录不会删除。",
          "确认停用",
          { type: "warning" }
        );
      } catch (_) {
        return;
      }
      this.retiringPackageId = packageItem.package_id;
      try {
        await retireCustomModelPackage(packageItem.package_id);
        this.$message.success("模型包已停用");
        await this.loadPackageList();
      } catch (error) {
        this.packageError = error.message || "停用模型包失败。";
      } finally {
        this.retiringPackageId = null;
      }
    },
    openRegisterDialog(packageItem) {
      if (packageItem.retired_at) return;
      this.selectedPackage = packageItem;
      this.registerForm = {
        family: "",
        variant: `${packageItem.name || "model"}-${packageItem.version || "latest"}`,
        task_type: "detection",
        description: "",
      };
      this.registerDialogVisible = true;
      this.$nextTick(() => {
        if (this.$refs.registerForm) this.$refs.registerForm.clearValidate();
      });
    },
    async registerArchitecture() {
      if (!this.selectedPackage) return;
      this.$refs.registerForm.validate(async valid => {
        if (!valid) return;
        this.registering = true;
        try {
          await CreateArchitecture({
            family: this.registerForm.family.trim(),
            variant: this.registerForm.variant.trim(),
            task_type: this.registerForm.task_type,
            engine: "custom-source",
            custom_model_package_id: this.selectedPackage.package_id,
            description: this.registerForm.description.trim() || null,
          });
          this.$message.success("自定义模型架构注册成功");
          this.registerDialogVisible = false;
          this.selectedPackage = null;
          await this.fetchArchitectures();
        } catch (error) {
          this.$message.error(error.message || "注册架构失败。");
        } finally {
          this.registering = false;
        }
      });
    },
    resetPackageUpload() {
      this.packageUploadFile = null;
      this.packageUploadError = null;
      if (this.$refs.packageUploader) this.$refs.packageUploader.clearFiles();
    },
    packageName(packageItem) {
      return `${packageItem?.name || '-'}@${packageItem?.version || '-'}`;
    },
    formatEntrypoint(packageItem) {
      const moduleName = packageItem?.entrypoint_module;
      const className = packageItem?.entrypoint_class;
      if (!moduleName && !className) return '-';
      return [moduleName, className].filter(Boolean).join('.') || '-';
    },
    formatPackageDate(value) {
      if (!value) return '-';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    },
    truncateHash(value) {
      if (!value) return '-';
      return value.length > 12 ? `${value.slice(0, 12)}...` : value;
    },
    truncate(str){
      if(!str) return '-';
      return str.length > 25 ? str.slice(0,22)+'...' : str;
    },
    formatVariant(v, item){
      if(!v) return '';
      if (this.isCustomArchitecture(item)) return String(v);
      return v
        .replace(/^rtdetr-/i, 'RT-DETR-')
        .replace(/^ppyoloe/i, 'PP-YOLOE')
        .replace(/^picodet/i, 'PicoDet')
        .replace(/^yolo/i,'YOLO');
    },
    displayTaskType(t){
      if(!t) return '-';
      const map = {
        detection: '目标检测',
        classify: '图像分类',
        classification: '图像分类',
        segment: '图像分割',
        segmentation: '图像分割'
      };
      return map[String(t).toLowerCase()] || t;
    }
  },
  mounted() {
    this.fetchArchitectures();
  },
};
</script>

<style scoped>
.architecture-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Hero */
.arch-hero {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
}

.arch-hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arch-eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
  font-weight: 700;
}

.arch-title {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  line-height: 1.2;
}

.arch-subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
  margin: 0;
}

.arch-hero-stats {
    display: flex;
    align-items: center;
    gap: 16px;
}

.package-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.package-upload-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.package-upload-error {
  margin: -8px 0 14px;
  color: var(--color-danger, #f56c6c);
  font-size: 0.85rem;
}

.package-state {
  min-height: 180px;
  padding: 24px;
}

.package-table {
  width: 100%;
}

.package-name {
  color: var(--text-main);
  font-weight: 600;
}

.package-id {
  color: var(--text-secondary);
  font-size: 0.75rem;
  margin-top: 3px;
}

.selected-package {
  margin-bottom: 20px;
  padding: 12px 14px;
  background: var(--bg-body);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  color: var(--text-main);
  line-height: 1.8;
}

.selected-package span {
  color: var(--text-secondary);
}

.arch-filter-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 700;
}

.hero-stat {
    text-align: center;
    padding: 10px 20px;
    background: var(--bg-body);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-light);
}

.stat-value {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-main);
    line-height: 1;
}

.stat-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    margin-top: 4px;
    text-transform: uppercase;
}

/* Body */
.arch-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.family-group {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);
}

.family-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.family-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.family-count {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: var(--bg-body);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--border-color);
}

/* Grid */
.arch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.arch-card {
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.2s ease;
}

.arch-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--color-primary-subtle);
  background: white;
}

.arch-card-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.arch-tags {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.arch-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arch-tag {
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 0.65rem;
  font-weight: 600;
  flex-shrink: 0;
  height: fit-content;
}

.arch-tag.framework {
  background: var(--bg-panel);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.arch-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.meta-label {
  color: var(--text-secondary);
}

.meta-value {
  color: var(--text-main);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

/* States */
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--text-secondary);
}

.state i { font-size: 1.5rem; }
</style>
