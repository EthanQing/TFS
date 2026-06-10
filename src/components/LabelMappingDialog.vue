<template>
  <el-dialog
    title="标签映射"
    :visible="visible"
    @close="handleClose"
    width="900px"
    :close-on-click-modal="false"
    :append-to-body="true"
    class="label-mapping-dialog"
  >
    <div v-loading="loading" class="mapping-body">
      <!-- Toolbar -->
      <div class="mapping-toolbar">
        <div class="toolbar-left">
          <span class="toolbar-label">快捷预设：</span>
          <el-button-group>
            <el-button
              v-for="p in presets"
              :key="p.mode"
              size="small"
              :type="activePreset === p.mode ? 'primary' : ''"
              @click="applyPreset(p.mode)"
            >{{ p.label }}</el-button>
          </el-button-group>
          <el-popover
            v-if="activePreset === 'level'"
            placement="bottom"
            trigger="manual"
            :value="showLevelPicker"
            @hide="showLevelPicker = false"
          >
            <div class="level-picker">
              <span>取第</span>
              <el-input-number v-model="levelValue" :min="1" :max="maxLevel" size="mini" />
              <span>级</span>
              <el-button size="mini" type="primary" @click="confirmLevel">确定</el-button>
            </div>
          </el-popover>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="searchQuery"
            placeholder="搜索标签..."
            prefix-icon="el-icon-search"
            size="small"
            clearable
            class="search-input"
          />
        </div>
      </div>

      <!-- Batch actions -->
      <div class="batch-bar" v-show="checkedCount > 0">
        <span class="batch-info">已选 {{ checkedCount }} 项</span>
        <el-button size="mini" type="danger" plain @click="batchDiscard">丢弃选中</el-button>
        <el-button size="mini" plain @click="batchRestore">恢复选中</el-button>
        <el-popover placement="bottom" trigger="click" v-model="showBatchTarget">
          <div class="batch-target-picker">
            <el-input v-model="batchTargetValue" size="small" placeholder="输入目标标签" />
            <el-button size="small" type="primary" @click="applyBatchTarget" :disabled="!batchTargetValue.trim()">应用</el-button>
          </div>
          <el-button slot="reference" size="mini" plain>批量设置目标</el-button>
        </el-popover>
      </div>

      <!-- Mapping Table -->
      <div class="mapping-table-wrap">
        <table class="mapping-table">
          <thead>
            <tr>
              <th class="col-check"><el-checkbox :indeterminate="isIndeterminate" v-model="checkAll" @change="handleCheckAllChange" /></th>
              <th class="col-source">源标签（原始）</th>
              <th class="col-arrow"></th>
              <th class="col-target">目标标签（YOLO）</th>
              <th class="col-action">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredRows"
              :key="row.sourceLabel"
              :class="{ 'is-discarded': row.discarded, 'is-edited': row.manuallyEdited }"
            >
              <td class="col-check">
                <el-checkbox v-model="row.checked" />
              </td>
              <td class="col-source">
                <span class="source-label" :class="{ 'line-through': row.discarded }">
                  <template v-for="(part, pi) in splitLabel(row.sourceLabel)">
                    <span :key="'p-'+pi" class="label-part" :class="'depth-' + Math.min(pi, 4)">{{ part }}</span>
                    <span v-if="pi < splitLabel(row.sourceLabel).length - 1" :key="'s-'+pi" class="label-sep">›</span>
                  </template>
                </span>
              </td>
              <td class="col-arrow">
                <i class="el-icon-right arrow-icon" :class="{ 'text-muted': row.discarded }" />
              </td>
              <td class="col-target">
                <template v-if="row.discarded">
                  <span class="discard-badge">已丢弃</span>
                </template>
                <template v-else>
                  <el-select
                    v-model="row.targetLabel"
                    size="small"
                    class="target-input"
                    placeholder="选择目标标签"
                    filterable
                    allow-create
                    @change="onTargetEdited(row)"
                  >
                    <el-option
                      v-for="opt in splitLabel(row.sourceLabel)"
                      :key="opt"
                      :label="opt"
                      :value="opt"
                    />
                  </el-select>
                </template>
              </td>
              <td class="col-action">
                <el-button
                  v-if="!row.discarded"
                  type="text"
                  size="small"
                  class="action-discard"
                  @click="toggleDiscard(row, true)"
                  title="丢弃此标签"
                >
                  <i class="el-icon-delete" />
                </el-button>
                <el-button
                  v-else
                  type="text"
                  size="small"
                  class="action-restore"
                  @click="toggleDiscard(row, false)"
                  title="恢复此标签"
                >
                  <i class="el-icon-refresh-left" />
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredRows.length === 0 && !loading" class="no-data">
          <i class="el-icon-warning-outline" />
          <span v-if="searchQuery.trim()">没有匹配 "{{ searchQuery }}" 的标签</span>
          <span v-else>暂无标签数据</span>
        </div>
      </div>

      <!-- Stats Panel -->
      <div class="stats-panel">
        <div class="stat-item">
          <span class="stat-num">{{ rows.length }}</span>
          <span class="stat-desc">原始标签</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-num highlight">{{ uniqueTargetCount }}</span>
          <span class="stat-desc">映射后类别</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-num warn">{{ discardedCount }}</span>
          <span class="stat-desc">丢弃</span>
        </div>
        <div class="stat-categories" v-if="uniqueTargets.length > 0 && uniqueTargets.length <= 30">
          <span class="cat-label">映射后类别：</span>
          <el-tag
            v-for="t in uniqueTargets"
            :key="t"
            size="mini"
            type="info"
            class="cat-tag"
          >{{ t }}</el-tag>
        </div>
      </div>
    </div>

    <div slot="footer" class="dialog-footer">
      <el-button @click="handleClose" :disabled="saving">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave" :disabled="!hasValidMapping">
        保存映射
      </el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'LabelMappingDialog',
  props: {
    visible: { type: Boolean, default: false },
    datasetId: { type: [String, Number], default: '' },
    labels: { type: Array, default: () => [] },
    separator: { type: String, default: '%' },
    loading: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
  },
  data() {
    return {
      rows: [],
      searchQuery: '',
      activePreset: '',
      levelValue: 2,
      showLevelPicker: false,
      batchTargetValue: '',
      showBatchTarget: false,
      checkAll: false,
      presets: [
        { mode: 'root',  label: '取根节点' },
        { mode: 'leaf',  label: '取叶子节点' },
        { mode: 'level', label: '取第N级' },
        { mode: 'full',  label: '完整保留' },
      ],
    };
  },
  computed: {
    filteredRows() {
      if (!this.searchQuery.trim()) return this.rows;
      const q = this.searchQuery.toLowerCase();
      return this.rows.filter(r =>
        r.sourceLabel.toLowerCase().includes(q) ||
        r.targetLabel.toLowerCase().includes(q)
      );
    },
    checkedCount() {
      return this.rows.filter(r => r.checked).length;
    },
    isIndeterminate() {
      const c = this.checkedCount;
      return c > 0 && c < this.rows.length;
    },
    discardedCount() {
      return this.rows.filter(r => r.discarded).length;
    },
    activeRows() {
      return this.rows.filter(r => !r.discarded);
    },
    uniqueTargets() {
      const set = new Set();
      this.activeRows.forEach(r => {
        const t = r.targetLabel.trim();
        if (t) set.add(t);
      });
      return Array.from(set).sort();
    },
    uniqueTargetCount() {
      return this.uniqueTargets.length;
    },
    maxLevel() {
      let max = 1;
      this.rows.forEach(r => {
        const n = r.sourceLabel.split(this.separator).length;
        if (n > max) max = n;
      });
      return max;
    },
    hasValidMapping() {
      return this.rows.length > 0 && this.activeRows.every(r => r.targetLabel.trim() !== '');
    },
  },
  watch: {
    labels: {
      handler(newLabels) {
        this.initRows(newLabels);
      },
      immediate: true,
    },
    visible(val) {
      if (val) {
        this.initRows(this.labels);
        // Default: apply 'root' preset
        if (this.rows.length > 0 && !this.activePreset) {
          this.applyPreset('root');
        }
      }
    },
  },
  methods: {
    initRows(labels) {
      if (!labels || !labels.length) {
        this.rows = [];
        return;
      }
      this.rows = labels.map(label => ({
        sourceLabel: label,
        targetLabel: '',
        discarded: false,
        manuallyEdited: false,
        checked: false,
      }));
      this.activePreset = '';
    },
    splitLabel(label) {
      return label.split(this.separator).filter(p => p.trim());
    },
    computeTarget(label, mode, level) {
      const parts = this.splitLabel(label);
      if (!parts.length) return label;
      switch (mode) {
        case 'root':  return parts[0];
        case 'leaf':  return parts[parts.length - 1];
        case 'level': return parts[Math.min(level - 1, parts.length - 1)];
        case 'full':  return parts.join('_');
        default:      return label;
      }
    },
    applyPreset(mode) {
      if (mode === 'level') {
        this.activePreset = 'level';
        this.showLevelPicker = true;
        return;
      }
      this.activePreset = mode;
      this.rows.forEach(row => {
        if (!row.discarded) {
          row.targetLabel = this.computeTarget(row.sourceLabel, mode, this.levelValue);
          row.manuallyEdited = false;
        }
      });
    },
    confirmLevel() {
      this.showLevelPicker = false;
      this.rows.forEach(row => {
        if (!row.discarded) {
          row.targetLabel = this.computeTarget(row.sourceLabel, 'level', this.levelValue);
          row.manuallyEdited = false;
        }
      });
    },
    onTargetEdited(row) {
      row.manuallyEdited = true;
    },
    toggleDiscard(row, discard) {
      row.discarded = discard;
      if (discard) {
        row.targetLabel = '';
      } else if (this.activePreset) {
        row.targetLabel = this.computeTarget(row.sourceLabel, this.activePreset, this.levelValue);
      }
    },
    handleCheckAllChange(val) {
      this.rows.forEach(r => { r.checked = val; });
    },
    batchDiscard() {
      this.rows.filter(r => r.checked).forEach(r => {
        r.discarded = true;
        r.targetLabel = '';
        r.checked = false;
      });
      this.checkAll = false;
    },
    batchRestore() {
      this.rows.filter(r => r.checked).forEach(r => {
        r.discarded = false;
        if (this.activePreset) {
          r.targetLabel = this.computeTarget(r.sourceLabel, this.activePreset, this.levelValue);
        }
        r.checked = false;
      });
      this.checkAll = false;
    },
    applyBatchTarget() {
      const target = this.batchTargetValue.trim();
      if (!target) return;
      this.rows.filter(r => r.checked).forEach(r => {
        r.discarded = false;
        r.targetLabel = target;
        r.manuallyEdited = true;
        r.checked = false;
      });
      this.checkAll = false;
      this.showBatchTarget = false;
      this.batchTargetValue = '';
    },
    queryTargetSuggestions(queryString, cb) {
      // Suggest existing target labels for autocomplete
      const existing = this.uniqueTargets;
      const q = (queryString || '').toLowerCase();
      const results = q
        ? existing.filter(t => t.toLowerCase().includes(q)).map(t => ({ value: t }))
        : existing.map(t => ({ value: t }));
      cb(results);
    },
    buildMapping() {
      const mapping = {};
      this.rows.forEach(row => {
        mapping[row.sourceLabel] = row.discarded ? '__DISCARD__' : row.targetLabel.trim();
      });
      return mapping;
    },
    handleSave() {
      const mapping = this.buildMapping();
      // Validate: all active rows must have a non-empty target
      const emptyTargets = this.activeRows.filter(r => !r.targetLabel.trim());
      if (emptyTargets.length > 0) {
        this.$message.warning(`还有 ${emptyTargets.length} 个标签未设置目标`);
        return;
      }
      this.$emit('save', mapping);
    },
    handleClose() {
      this.$emit('update:visible', false);
      this.$emit('close');
    },
  },
};
</script>

<style scoped>
.label-mapping-dialog .mapping-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Toolbar */
.mapping-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar-label {
  font-size: 0.85rem;
  color: #64748b;
  white-space: nowrap;
}
.toolbar-right {
  display: flex;
  align-items: center;
}
.search-input {
  width: 200px;
}
.level-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

/* Batch bar */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  font-size: 0.85rem;
}
.batch-info {
  color: #2563eb;
  font-weight: 600;
  margin-right: 4px;
}
.batch-target-picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Mapping Table */
.mapping-table-wrap {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  max-height: 420px;
  overflow-y: auto;
}
.mapping-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.mapping-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
}
.mapping-table th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}
.mapping-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}
.mapping-table tbody tr {
  transition: background 0.15s;
}
.mapping-table tbody tr:hover {
  background: #fafbfd;
}
.mapping-table tbody tr.is-discarded {
  background: #fef2f2;
  opacity: 0.7;
}
.mapping-table tbody tr.is-discarded:hover {
  opacity: 0.85;
}

.col-check { width: 40px; text-align: center; }
.col-source { min-width: 250px; }
.col-arrow { width: 36px; text-align: center; }
.col-target { min-width: 180px; }
.col-action { width: 50px; text-align: center; }

/* Source label parts */
.source-label {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
}
.source-label.line-through {
  text-decoration: line-through;
  opacity: 0.6;
}
.label-part {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.82rem;
  font-weight: 500;
}
.depth-0 { background: #dbeafe; color: #1e40af; }
.depth-1 { background: #e0e7ff; color: #3730a3; }
.depth-2 { background: #ede9fe; color: #5b21b6; }
.depth-3 { background: #fae8ff; color: #86198f; }
.depth-4 { background: #fce7f3; color: #9d174d; }
.label-sep {
  color: #94a3b8;
  margin: 0 2px;
  font-size: 0.75rem;
}

/* Arrow */
.arrow-icon {
  color: #6366f1;
  font-size: 1rem;
}
.arrow-icon.text-muted {
  color: #cbd5e1;
}

/* Target input */
.target-input {
  width: 100%;
}

/* Discard badge */
.discard-badge {
  display: inline-block;
  padding: 2px 10px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 500;
}

/* Action buttons */
.action-discard {
  color: #94a3b8 !important;
}
.action-discard:hover {
  color: #ef4444 !important;
}
.action-restore {
  color: #6366f1 !important;
}

/* No data */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
  color: #94a3b8;
  font-size: 0.9rem;
}
.no-data i {
  font-size: 1.5rem;
}

/* Stats panel */
.stats-panel {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.stat-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.stat-num {
  font-size: 1.1rem;
  font-weight: 700;
  color: #334155;
}
.stat-num.highlight { color: #2563eb; }
.stat-num.warn { color: #dc2626; }
.stat-desc {
  font-size: 0.78rem;
  color: #94a3b8;
}
.stat-divider {
  width: 1px;
  height: 18px;
  background: #d1d5db;
}
.stat-categories {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.cat-label {
  font-size: 0.78rem;
  color: #94a3b8;
  white-space: nowrap;
}
.cat-tag {
  font-size: 0.72rem;
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
