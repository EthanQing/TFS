<template>
  <div class="architecture-wrapper">
    <h2 class="title">当前已支持的模型架构</h2>

    <!-- 加载状态 -->
    <div v-if="loading" class="state loading">
      <i class="el-icon-loading"></i>
      <span>加载中...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state error">
      <i class="el-icon-warning"></i>
      <span>{{ error }}</span>
      <el-button
        size="mini"
        type="primary"
        @click="fetchArchitectures"
        style="margin-left: 12px"
        >重试</el-button
      >
    </div>

    <!-- 空状态 -->
  <div v-else-if="groupedList.length === 0" class="state empty">
      <i class="el-icon-info"></i>
      <span>暂无架构数据</span>
    </div>

    <!-- 分组数据列表（按 model_family 分类，仅显示指定字段） -->
    <div v-else class="family-groups">
      <div class="family-group" v-for="group in groupedList" :key="group.family">
        <h3 class="family-title">{{ group.family }} <span class="family-count">{{ group.items.length }}</span></h3>
        <ul class="arch-list">
      <li v-for="item in group.items" :key="item.arch_id || item.model_variant" class="arch-item">
            <div class="arch-header">
        <span class="arch-name" :title="formatVariant(item.model_variant)">{{ formatVariant(item.model_variant) || '未命名' }}</span>
            </div>
            <div class="simple-fields">
              <div class="field" v-if="item.arch_id"><span class="label">ID:</span><span class="value" :title="item.arch_id">{{ item.arch_id }}</span></div>
              <div class="field" v-if="item.task_type"><span class="label">分类:</span><span class="value" :title="displayTaskType(item.task_type)">{{ displayTaskType(item.task_type) }}</span></div>
              <div class="field" v-if="item.pretrained_path"><span class="label">预训练:</span><span class="value" :title="item.pretrained_path">{{ truncate(item.pretrained_path) }}</span></div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { FetchArchitectureDetail } from "@/api/index.js";

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
        const fam = it.model_family || '未分类';
        (map[fam] = map[fam] || []).push(it);
      });
      const sizeOrder = { n:0, s:1, m:2, l:3, x:4 };
      const taskOrder = (variant='') => {
        if (variant.endsWith('-seg')) return 2; // 分割最后
        if (variant.endsWith('-cls')) return 1; // 分类居中
        return 0; // 无后缀视作检测最前
      };
      const sizeRank = (variant='') => {
        const base = variant.replace(/-(cls|seg)$/,'');
        const letter = base.slice(-1);
        return letter in sizeOrder ? sizeOrder[letter] : 999;
      };
      return Object.entries(map)
        .sort((a,b)=> a[0] === '未分类' ? 1 : b[0] === '未分类' ? -1 : a[0].localeCompare(b[0],'zh-CN'))
        .map(([family, items]) => ({
          family,
          items: items.slice().sort((a,b)=> {
            const ta = taskOrder(a.model_variant);
            const tb = taskOrder(b.model_variant);
            if (ta !== tb) return ta - tb;
            const sa = sizeRank(a.model_variant);
            const sb = sizeRank(b.model_variant);
            if (sa !== sb) return sa - sb;
            return (a.model_variant || '').localeCompare(b.model_variant || '', 'zh-CN');
          })
        }));
    }
  },
  methods: {
    async fetchArchitectures() {
      this.loading = true;
      this.error = null;
      try {
        const response = await FetchArchitectureDetail();
        this.architectures = response;
      } catch (error) {
        this.error = error.message || "获取失败";
        console.error("获取模型架构失败:", error);
      } finally {
        this.loading = false;
      }
    },
    truncate(str){
      if(!str) return '-';
      return str.length > 40 ? str.slice(0,37)+'...' : str;
    },
    formatVariant(v){
      if(!v) return '';
      return v.replace(/^yolo/i,'YOLO');
    },
    displayTaskType(t){
      if(!t) return '-';
      const norm = String(t).toLowerCase();
      const map = {
        detection: 'detection(目标检测)',
        classify: 'classification(分类)', // 兼容某些后端写法
        classification: 'classification(分类)',
        segment: 'segmentation(实例分割)',
        segmentation: 'segmentation(实例分割)'
      };
      return map[norm] || t; // 未识别则原样返回
    }
  },
  mounted() {
    this.fetchArchitectures();
  },
};
</script>

<style scoped>
.architecture-wrapper {
  padding: 20px;
}
.title {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 16px;
  color: #111f68;
}
.state {
  display: flex;
  align-items: center;
  padding: 40px 10px;
  font-size: 14px;
  color: #666;
}
.state i {
  margin-right: 10px;
  font-size: 18px;
}
.state.error {
  color: #f56c6c;
}
.state.empty {
  color: #909399;
}
.arch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}
.arch-item {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  cursor: pointer;
}
.arch-item:hover {
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
.family-groups {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.family-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.family-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111f68;
  display: flex;
  align-items: center;
  gap: 8px;
}
.family-count {
  font-size: 12px;
  background: #eef2ff;
  color: #4f46e5;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1;
}
.arch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.arch-name {
  font-size: 16px;
  font-weight: 600;
  color: #111f68;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arch-version {
  font-size: 12px;
  background: #eef2ff;
  color: #4f46e5;
  padding: 2px 8px;
  border-radius: 999px;
}
.arch-desc {
  font-size: 13px;
  color: #555;
  margin: 4px 0 10px;
  line-height: 1.4;
  max-height: 3.6em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}
.meta {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}
.meta-row {
  display: flex;
  font-size: 12px;
  line-height: 1.3;
}
.meta-row .k {
  color: #666;
  margin-right: 4px;
  flex: 0 0 auto;
}
.meta-row .v {
  color: #222;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
}
@media (min-width: 640px) {
  .meta {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
