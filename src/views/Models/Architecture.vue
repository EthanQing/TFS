<template>
  <div class="architecture-page page-container">
    <header class="arch-hero">
      <div class="arch-hero-left">
        <div class="arch-eyebrow">模型库</div>
        <h1 class="arch-title">模型架构</h1>
        <p class="arch-subtitle">浏览支持的主干网络和变体。</p>
      </div>
      <div class="arch-hero-right">
        <div class="arch-stat glass-panel-sm">
          <div class="arch-stat-label">系列</div>
          <div class="arch-stat-value">{{ groupedList.length }}</div>
        </div>
        <div class="arch-stat glass-panel-sm">
          <div class="arch-stat-label">总数</div>
          <div class="arch-stat-value">{{ totalArchitectures }}</div>
        </div>
        <el-button type="primary" class="primary-action" @click="fetchArchitectures">刷新</el-button>
      </div>
    </header>

    <section class="arch-body">
      <div v-if="loading" class="state loading">
        <i class="el-icon-loading"></i>
        <span>正在加载架构...</span>
      </div>

      <div v-else-if="error" class="state error">
        <i class="el-icon-warning"></i>
        <span>{{ error }}</span>
        <el-button size="mini" type="primary" class="primary-action" @click="fetchArchitectures">重试</el-button>
      </div>

      <div v-else-if="groupedList.length === 0" class="state empty">
        <i class="el-icon-info"></i>
        <span>暂无架构数据。</span>
      </div>

      <div v-else class="family-groups">
        <section class="family-group glass-panel" v-for="group in groupedList" :key="group.family">
          <header class="family-header">
            <div class="family-title">{{ group.family }}</div>
            <div class="family-count">{{ group.items.length }}</div>
          </header>
          <div class="arch-grid">
            <article v-for="item in group.items" :key="item.arch_id || item.model_variant" class="arch-card">
              <div class="arch-card-header">
                <div class="arch-name" :title="formatVariant(item.model_variant) || '未命名'">
                  {{ formatVariant(item.model_variant) || '未命名' }}
                </div>
                <span v-if="item.task_type" class="arch-tag">{{ displayTaskType(item.task_type) }}</span>
              </div>
              <div class="arch-meta">
                <div class="meta-row" v-if="item.arch_id">
                  <span class="meta-label">ID</span>
                  <span class="meta-value">{{ item.arch_id }}</span>
                </div>
                <div class="meta-row" v-if="item.pretrained_path">
                  <span class="meta-label">预训练模型</span>
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

export default {
  name: "Architecture",
  data() {
    return {
      architectures: null,
      loading: false,
      error: null,
    };
  },
  computed: {
    groupedList() {
      if (!Array.isArray(this.architectures)) return [];
      const map = {};
      this.architectures.forEach(it => {
        const fam = it.model_family || 'Uncategorized';
        (map[fam] = map[fam] || []).push(it);
      });
      const sizeOrder = { n:0, s:1, m:2, l:3, x:4 };
      const taskOrder = (variant='') => {
        if (variant.endsWith('-seg')) return 2;
        if (variant.endsWith('-cls')) return 1;
        return 0;
      };
      const sizeRank = (variant='') => {
        const base = variant.replace(/-(cls|seg)$/,'');
        const letter = base.slice(-1);
        return letter in sizeOrder ? sizeOrder[letter] : 999;
      };
      return Object.entries(map)
        .sort((a,b)=> a[0] === 'Uncategorized' ? 1 : b[0] === 'Uncategorized' ? -1 : a[0].localeCompare(b[0]))
        .map(([family, items]) => ({
          family,
          items: items.slice().sort((a,b)=> {
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
      return Array.isArray(this.architectures) ? this.architectures.length : 0;
    },
  },
  methods: {
    async fetchArchitectures() {
      this.loading = true;
      this.error = null;
      try {
        const response = await FetchArchitectureDetail();
        this.architectures = response;
      } catch (error) {
        this.error = error.message || "加载架构失败。";
        console.error("Failed to fetch architectures:", error);
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
      return v.replace(/^yolo/i,'YOLO');
    },
    displayTaskType(t){
      if(!t) return '-';
      const norm = String(t).toLowerCase();
      const map = {
        detection: '目标检测',
        classify: '图像分类',
        classification: '图像分类',
        segment: '图像分割',
        segmentation: '图像分割'
      };
      return map[norm] || t;
    }
  },
  mounted() {
    this.fetchArchitectures();
  },
};
</script>

<style scoped>
.architecture-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.arch-hero {
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

.arch-hero::before {
  content: none;
}

.arch-hero-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.arch-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-primary);
  font-weight: 600;
}

.arch-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-main);
}

.arch-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.arch-hero-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.arch-stat {
  padding: 0.5rem 1rem;
  min-width: 80px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-md);
  text-align: center;
}

.arch-stat-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.arch-stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-primary);
}

.primary-action {
  border-radius: var(--radius-full) !important;
  font-weight: 600;
}

.arch-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 0.5rem;
  padding-bottom: 2rem;
}

/* Family Groups */
.family-groups {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.family-group {
  padding: 1.5rem;
}

.family-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.family-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-main);
}

.family-count {
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  background: rgba(0,0,0,0.05); /* Adaptive */
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

/* Grid */
.arch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}

.arch-card {
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: all 0.2s ease;
}

.arch-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
  background: #fff;
  border-color: var(--color-primary-light);
}

.arch-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.arch-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arch-tag {
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: #fff; /* or dark text if light bg */
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 600;
  flex-shrink: 0;
}

.arch-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
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
  max-width: 150px;
}

/* States */
.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 4rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.state i {
  font-size: 1.5rem;
}

@media (max-width: 960px) {
  .arch-hero {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
