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
        <section class="family-group" v-for="group in groupedList" :key="group.family">
          <header class="family-header">
            <div class="family-title">{{ group.family }}</div>
            <div class="family-count">{{ group.items.length }} variants</div>
          </header>
          <div class="arch-grid">
            <article v-for="item in group.items" :key="item.arch_id || item.model_variant" class="arch-card">
              <div class="arch-card-header">
                <div class="arch-name" :title="formatVariant(item.model_variant)">
                  {{ formatVariant(item.model_variant) || 'Unnamed' }}
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
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<script>
import { FetchArchitectureDetail } from "@/api/models";
import { resolveFramework } from "@/utils/trainingFramework";

const FRAMEWORK_FILTERS = [
  { key: "all", label: "全部", engine: "" },
  { key: "pytorch", label: "PyTorch (YOLO)", engine: "ultralytics-yolo" },
  { key: "paddle", label: "Paddle", engine: "paddle-det" },
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
        (map[fam] = map[fam] || []).push(it);
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
      return Object.entries(map)
        .sort((a, b) => {
          if (a[0] === 'Uncategorized') return 1;
          if (b[0] === 'Uncategorized') return -1;
          const ra = familyRank(a[0]);
          const rb = familyRank(b[0]);
          if (ra !== rb) return ra - rb;
          return a[0].localeCompare(b[0]);
        })
        .map(([family, items]) => ({
          family,
          items: items.slice().sort((a, b) => {
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
      const engine = item?.engine || "ultralytics-yolo";
      return resolveFramework(engine).frameworkKey;
    },
    displayFrameworkLabel(item) {
      const engine = item?.engine || "ultralytics-yolo";
      return resolveFramework(engine).frameworkLabel;
    },
    async fetchArchitectures() {
      this.loading = true;
      this.error = null;
      try {
        const response = await FetchArchitectureDetail();
        this.architectures = response;
      } catch (error) {
        this.error = error.message || "Failed to load architectures.";
      } finally {
        this.loading = false;
      }
    },
    truncate(str){
      if(!str) return '-';
      return str.length > 25 ? str.slice(0,22)+'...' : str;
    },
    formatVariant(v){
      if(!v) return '';
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
