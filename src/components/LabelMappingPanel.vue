<template>
  <div v-loading="loading" class="label-mapping-panel">
    <div class="panel-header">
      <div class="panel-title-row">
        <h3 class="panel-title"><i class="el-icon-s-operation"></i> 标签映射</h3>
        <div class="preset-group">
          <span class="preset-label">快捷预设：</span>
          <el-button-group>
            <el-button v-for="p in presets" :key="p.mode" size="mini" :type="activePreset === p.mode ? 'primary' : ''"
              @click="applyPreset(p.mode)">{{ p.label }}</el-button>
          </el-button-group>
          <div v-show="activePreset === 'level'" class="level-picker">
            <span>取第</span>
            <el-input-number v-model="levelValue" :min="1" :max="maxLevel" size="mini" />
            <span>级</span>
            <el-button size="mini" type="primary" @click="confirmLevel">确定</el-button>
          </div>
        </div>
      </div>
      <div class="panel-sub-row">
        <span class="label-count-hint">共 {{ rows.length }} 个原始标签，按层级树形展示</span>
        <el-input v-model="searchQuery" placeholder="搜索源标签或目标标签..." prefix-icon="el-icon-search" size="mini" clearable
          class="search-input" />
      </div>
    </div>

    <div class="mapping-table-wrap">
      <table class="mapping-table">
        <thead>
          <tr>
            <th class="col-expand"></th>
            <th class="col-source">源标签层级路径</th>
            <th class="col-arrow"></th>
            <th class="col-target">目标映射配置</th>
            <th class="col-count">包含项</th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody class="scrollable-tbody">
          <tr v-for="node in displayNodes" :key="node.key" class="mapping-row" :class="{
            'is-virtual': node.isVirtual,
            'is-discarded': node.isVirtual ? node.allDescendantsDiscarded : node.exactRow.discarded
          }">
            <td class="col-expand">
              <i v-if="node.hasChildren"
                :class="expandedGroups[node.key] ? 'el-icon-arrow-down' : 'el-icon-arrow-right'" class="expand-icon"
                @click="toggleGroup(node.key)" />
            </td>
            <td class="col-source" :style="{ paddingLeft: (node.depth * 24 + 12) + 'px' }">
              <span class="source-label" :class="{ 'line-through': !node.isVirtual && node.exactRow.discarded }">
                <span class="label-part" :class="'depth-' + Math.min(node.depth, 4)">{{ node.segment }}</span>
                <span v-if="node.isVirtual" class="virtual-tag" title="此节点未作为独立标签出现过，仅作为其他标签的共用层级目录">(目录组)</span>
              </span>
            </td>
            <td class="col-arrow">
              <i class="el-icon-right arrow-icon"
                :class="{ 'text-muted': node.isVirtual ? node.allDescendantsDiscarded : node.exactRow.discarded }" />
            </td>
            <td class="col-target">
              <template v-if="node.isVirtual">
                <template v-if="node.allDescendantsDiscarded">
                  <span class="discard-badge">子项全丢弃</span>
                </template>
                <template v-else>
                  <el-select :value="!node.mixedTargets ? node.commonTarget : ''" size="mini"
                    class="target-input virtual-input" :placeholder="node.mixedTargets ? '多种映射 (选中以统一)' : '统一设置所有子项'"
                    filterable allow-create @change="(val) => setCascadeTarget(node, val)">
                    <el-option v-for="opt in node.availableTargets" :key="opt" :label="opt" :value="opt" />
                  </el-select>
                </template>
              </template>

              <template v-else>
                <template v-if="node.exactRow.discarded">
                  <span class="discard-badge">已丢弃</span>
                </template>
                <template v-else>
                  <div class="target-input-group">
                    <el-select v-model="node.exactRow.targetLabel" size="mini" class="target-input" placeholder="映射当前项"
                      filterable allow-create default-first-option @change="onTargetEdited(node.exactRow)" >
                      <el-option v-for="opt in node.availableTargets" :key="opt" :label="opt" :value="opt" />
                    </el-select>
                    <el-tooltip v-if="node.hasChildren" content="将此标签的映射向下应用到所有子项" placement="top">
                      <el-button class="cascade-btn" type="primary" plain icon="el-icon-download" size="mini"
                        @click="setCascadeTarget(node, node.exactRow.targetLabel)" />
                    </el-tooltip>
                  </div>
                </template>
              </template>
            </td>
            <td class="col-count">
              <span v-if="node.isVirtual" class="count-tag">{{ node.descendantCount }} 子项</span>
              <span v-else-if="node.hasChildren" class="count-tag">1 + {{ node.descendantCount }} 子项</span>
              <span v-else class="count-num">1</span>
            </td>
            <td class="col-action">
              <template v-if="node.isVirtual">
                <el-button v-if="!node.allDescendantsDiscarded" type="text" size="mini" class="action-discard"
                  :disabled="hasDiscardedAncestor(node.key)"
                  @click="discardAll(node, true)" title="丢弃所有子项"><i class="el-icon-delete" /></el-button>
                <el-button v-else type="text" size="mini" class="action-restore" :disabled="hasDiscardedAncestor(node.key)"
                  @click="discardAll(node, false)"
                  title="恢复所有子项"><i class="el-icon-refresh-left" /></el-button>
              </template>
              <template v-else>
                <el-button v-if="!node.exactRow.discarded" type="text" size="mini" class="action-discard"
                  :disabled="hasDiscardedAncestor(node.exactRow.sourceLabel)"
                  @click="toggleDiscard(node.exactRow, true)" title="丢弃此标签及所有子项"><i class="el-icon-delete" /></el-button>
                <el-button v-else type="text" size="mini" class="action-restore"
                  :disabled="hasDiscardedAncestor(node.exactRow.sourceLabel)"
                  @click="toggleDiscard(node.exactRow, false)" title="恢复此标签及所有子项"><i
                    class="el-icon-refresh-left" /></el-button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="displayNodes.length === 0 && !loading" class="no-data">
        <i class="el-icon-warning-outline" />
        <span v-if="searchQuery.trim()">没有匹配 "{{ searchQuery }}" 的标签</span>
        <span v-else>暂无标签数据</span>
      </div>
    </div>

    <div class="panel-footer">
      <div class="stats-row">
        <span class="stat"><strong>{{ rows.length }}</strong> 原始标签</span>
        <span class="stat-sep">→</span>
        <span class="stat highlight"><strong>{{ uniqueTargetCount }}</strong> 映射后类别</span>
        <span class="stat-sep">·</span>
        <span class="stat warn"><strong>{{ discardedCount }}</strong> 丢弃</span>
        <div class="categories-preview" v-if="uniqueTargets.length > 0 && uniqueTargets.length <= 20">
          <el-tag v-for="t in uniqueTargets" :key="t" size="mini" type="info" class="cat-tag">{{ t }}</el-tag>
        </div>
      </div>
      <div class="action-row">
        <el-button size="small" :type="sliceParamsConfirmed ? 'success' : ''"
          :icon="sliceParamsConfirmed ? 'el-icon-check' : 'el-icon-setting'" @click="showSliceDialog = true">{{
            sliceParamsConfirmed ? '裁剪参数已设置' : '裁剪参数设置' }}</el-button>
        <el-button size="small" :loading="saving" @click="handleSave" :disabled="!hasValidMapping">
          保存映射
        </el-button>
        <el-button type="primary" size="small" :loading="converting" @click="handleSaveAndConvert"
          :disabled="!hasValidMapping || converting || saving">
          保存并转换
        </el-button>
      </div>
    </div>

    <el-dialog title="裁剪参数设置" :visible.sync="showSliceDialog" width="560px" :close-on-click-modal="false"
      append-to-body>
      <div class="slice-dialog-hint">
        调整大图切片、标注过滤等参数，这些参数会影响最终训练数据的质量。
      </div>
      <div class="params-grid">
        <div class="param-item">
          <label class="param-label">切片尺寸 <span class="param-key">slice_size</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.sliceSize" :min="128" :max="4096" :step="64" size="mini" />
            <span class="param-unit">px</span>
          </div>
          <span class="param-desc">每个切片的像素边长</span>
        </div>
        <div class="param-item">
          <label class="param-label">重叠比例 <span class="param-key">overlap</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.overlap" :min="0" :max="0.9" :step="0.05" :precision="2"
              size="mini" />
          </div>
          <span class="param-desc">相邻切片间的重叠率</span>
        </div>
        <div class="param-item">
          <label class="param-label">内边距 <span class="param-key">padding</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.padding" :min="0" :max="512" :step="8" size="mini" />
            <span class="param-unit">px</span>
          </div>
          <span class="param-desc">标注框周围的额外扩展区域</span>
        </div>
        <div class="param-item">
          <label class="param-label">最小面积比 <span class="param-key">min_area_ratio</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.minAreaRatio" :min="0" :max="1" :step="0.05" :precision="2"
              size="mini" />
          </div>
          <span class="param-desc">标注框须落入切片的最小面积占比</span>
        </div>
        <div class="param-item">
          <label class="param-label">最小可见度 <span class="param-key">min_visibility</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.minVisibility" :min="0" :max="1" :step="0.05" :precision="2"
              size="mini" />
          </div>
          <span class="param-desc">标注框宽/高在切片中的最小可见比例</span>
        </div>
        <div class="param-item">
          <label class="param-label">最小像素 <span class="param-key">min_pixel_size</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.minPixelSize" :min="1" :max="100" :step="1" size="mini" />
            <span class="param-unit">px</span>
          </div>
          <span class="param-desc">切片中标注框宽高的最小像素值</span>
        </div>
        <div class="param-item">
          <label class="param-label">负样本比例 <span class="param-key">negative_ratio</span></label>
          <div class="param-control">
            <el-input-number v-model="sliceParams.negativeRatio" :min="0" :max="1" :step="0.05" :precision="2"
              size="mini" />
          </div>
          <span class="param-desc">无标注切片与有标注切片的比例 (0=不保留)</span>
        </div>
        <div class="param-item">
          <label class="param-label">空正样本处理 <span class="param-key">empty_positive_action</span></label>
          <div class="param-control">
            <el-select v-model="sliceParams.emptyPositiveAction" size="mini" style="width: 120px;">
              <el-option label="丢弃" value="discard" />
              <el-option label="转为负样本" value="negative" />
            </el-select>
          </div>
          <span class="param-desc">原本应包含标注但过滤后为空的切片处理方式</span>
        </div>
      </div>
      <div slot="footer">
        <el-button size="small" @click="showSliceDialog = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmSliceParams">确认参数</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'LabelMappingPanel',
  props: {
    labels: { type: Array, default: () => [] },
    separator: { type: String, default: '%' },
    loading: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
    converting: { type: Boolean, default: false },
    savedMapping: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      rows: [],
      searchQuery: '',
      activePreset: '',
      levelValue: 2,
      showLevelPicker: false,
      expandedGroups: {},
      showSliceDialog: false,
      sliceParamsConfirmed: false,
      pendingConvert: false,
      sliceParams: {
        sliceSize: 1280,
        overlap: 0.2,
        padding: 64,
        minAreaRatio: 0.3,
        minVisibility: 0.15,
        minPixelSize: 5,
        negativeRatio: 0.1,
        emptyPositiveAction: 'discard',
      },
      presets: [
        { mode: 'root', label: '取根节点' },
        { mode: 'leaf', label: '取叶子节点' },
        { mode: 'level', label: '取第N级' },
        { mode: 'full', label: '完整保留' },
      ],
    };
  },
  computed: {
    trie() {
      var root = { children: {}, directRows: [] };
      for (var i = 0; i < this.rows.length; i++) {
        var row = this.rows[i];
        var parts = this.splitLabel(row.sourceLabel);
        var current = root;
        for (var j = 0; j < parts.length; j++) {
          var part = parts[j];
          if (!current.children[part]) {
            current.children[part] = { children: {}, directRows: [] };
          }
          current = current.children[part];
        }
        current.directRows.push(row);
      }
      return root;
    },
    displayNodes() {
      var result = [];
      var sep = this.separator;
      var q = this.searchQuery.trim().toLowerCase();
      var expanded = this.expandedGroups;
      var self = this;

      function getAllRows(node) {
        var rows = node.directRows.slice();
        var keys = Object.keys(node.children);
        for (var i = 0; i < keys.length; i++) {
          rows = rows.concat(getAllRows(node.children[keys[i]]));
        }
        return rows;
      }

      function walk(parentNode, depth, parentParts) {
        var sortedKeys = Object.keys(parentNode.children).sort();
        for (var k = 0; k < sortedKeys.length; k++) {
          var seg = sortedKeys[k];
          var child = parentNode.children[seg];
          var parts = parentParts.concat(seg);
          var key = parts.join(sep);
          var allRows = getAllRows(child);
          var directRows = child.directRows;
          var descendantRows = allRows.filter(function (r) { return directRows.indexOf(r) === -1; });
          var hasChildren = descendantRows.length > 0;
          var isVirtual = directRows.length === 0;

          if (q) {
            var match = false;
            var fullLabel = key.toLowerCase();
            if (fullLabel.includes(q)) match = true;
            else if (allRows.some(function (r) { return r.sourceLabel.toLowerCase().includes(q) || r.targetLabel.toLowerCase().includes(q); })) match = true;
            if (!match) continue;
          }

          var activeDescendants = descendantRows.filter(function (r) { return !r.discarded; });
          var tSet = {};
          activeDescendants.forEach(function (r) { if (r.targetLabel) tSet[r.targetLabel] = true; });
          var tKeys = Object.keys(tSet);

          result.push({
            key: key,
            depth: depth,
            segment: seg,
            parts: parts,
            isVirtual: isVirtual,
            exactRow: isVirtual ? null : directRows[0],
            hasChildren: hasChildren,
            descendantRows: descendantRows,
            descendantCount: descendantRows.length,
            allDescendantsDiscarded: descendantRows.length > 0 && activeDescendants.length === 0,
            commonTarget: tKeys.length === 1 ? tKeys[0] : '',
            mixedTargets: tKeys.length > 1,
            availableTargets: (function () {
              var s = {};
              descendantRows.forEach(function (r) {
                self.splitLabel(r.sourceLabel).forEach(function (p) { s[p] = true; });
              });
              if (!isVirtual && directRows.length > 0) {
                self.splitLabel(directRows[0].sourceLabel).forEach(function (p) { s[p] = true; });
              }
              return Object.keys(s).sort();
            })(),
          });

          if (expanded[key] && hasChildren) {
            walk(child, depth + 1, parts);
          }
        }
      }

      var rootOrphans = this.trie.directRows;
      for (var ri = 0; ri < rootOrphans.length; ri++) {
        var orphan = rootOrphans[ri];
        if (q && !orphan.sourceLabel.toLowerCase().includes(q) && !orphan.targetLabel.toLowerCase().includes(q)) continue;
        result.push({
          key: '__orphan__' + ri,
          depth: 0,
          segment: orphan.sourceLabel || '(空标签)',
          isVirtual: false,
          exactRow: orphan,
          hasChildren: false,
          descendantRows: [],
          descendantCount: 0,
          allDescendantsDiscarded: false,
          mixedTargets: false,
          commonTarget: '',
          availableTargets: [],
        });
      }

      walk(this.trie, 0, []);
      return result;
    },
    discardedCount() {
      return this.rows.filter(function (r) { return r.discarded; }).length;
    },
    activeRows() {
      return this.rows.filter(function (r) { return !r.discarded; });
    },
    uniqueTargets() {
      var set = {};
      this.activeRows.forEach(function (r) {
        var t = r.targetLabel.trim();
        if (t) set[t] = true;
      });
      return Object.keys(set).sort();
    },
    uniqueTargetCount() {
      return this.uniqueTargets.length;
    },
    maxLevel() {
      var max = 1;
      for (var i = 0; i < this.rows.length; i++) {
        var n = this.rows[i].sourceLabel.split(this.separator).length;
        if (n > max) max = n;
      }
      return max;
    },
    hasValidMapping() {
      return this.rows.length > 0 && this.activeRows.every(function (r) { return r.targetLabel.trim() !== ''; });
    },
  },
  watch: {
    labels: {
      handler(newLabels) {
        this.initRows(newLabels);
      },
      immediate: true,
    },
    savedMapping: {
      handler(newMapping) {
        this.$nextTick(function () {
          this.applyExternalMapping(newMapping || {});
        }.bind(this));
      },
      deep: true,
    },
  },
  methods: {
    initRows(labels) {
      if (!labels || !labels.length) {
        this.rows = [];
        return;
      }
      var sep = this.separator;
      this.rows = labels.map(function (label) {
        var parts = label.split(sep).filter(function (p) { return p.trim(); });
        return {
          sourceLabel: label,
          targetLabel: '',
          discarded: parts.length === 0,
          manuallyEdited: false,
        };
      });
      this.activePreset = '';
      this.expandedGroups = {};
      this.$nextTick(function () {
        if (this.rows.length > 0) this.applyPreset('root');
        this.applyExternalMapping(this.savedMapping);
      }.bind(this));
    },
    splitLabel(label) {
      return label.split(this.separator).filter(function (p) { return p.trim(); });
    },
    computeTarget(label, mode, level) {
      var parts = this.splitLabel(label);
      if (!parts.length) return label;
      switch (mode) {
        case 'root': return parts[0];
        case 'leaf': return parts[parts.length - 1];
        case 'level': return parts[Math.min(level - 1, parts.length - 1)];
        case 'full': return parts.join('_');
        default: return label;
      }
    },
    applyPreset(mode) {
      if (mode === 'level') {
        this.activePreset = 'level';
        this.showLevelPicker = true;
        return;
      }
      this.activePreset = mode;
      this.rows.forEach(function (row) {
        if (!row.discarded) {
          row.targetLabel = this.computeTarget(row.sourceLabel, mode, this.levelValue);
          row.manuallyEdited = false;
        }
      }.bind(this));
    },
    confirmLevel() {
      this.showLevelPicker = false;
      this.rows.forEach(function (row) {
        if (!row.discarded) {
          row.targetLabel = this.computeTarget(row.sourceLabel, 'level', this.levelValue);
          row.manuallyEdited = false;
        }
      }.bind(this));
    },
    setCascadeTarget(node, val) {
      if (!val) return;
      if (this.hasDiscardedAncestor(node.key)) return;
      var rows = node.isVirtual ? node.descendantRows : [node.exactRow].concat(node.descendantRows);
      rows.filter(function (row) { return !!row; }).forEach(function (row) {
        row.discarded = false;
        row.targetLabel = val;
        row.manuallyEdited = true;
      });
    },
    discardAll(node, discard) {
      if (!discard && this.hasDiscardedAncestor(node.key)) return;
      this.applyDiscardState(node.descendantRows, discard);
    },
    toggleGroup(key) {
      this.$set(this.expandedGroups, key, !this.expandedGroups[key]);
    },
    onTargetEdited(row) {
      row.manuallyEdited = true;
    },
    toggleDiscard(row, discard) {
      if (!discard && this.hasDiscardedAncestor(row.sourceLabel)) return;
      this.applyDiscardState(this.getSubtreeRows(row.sourceLabel), discard);
    },
    buildMapping() {
      var mapping = {};
      this.rows.forEach(function (row) {
        mapping[row.sourceLabel] = {
          mapped_label: row.discarded ? '' : row.targetLabel.trim(),
          status: row.discarded ? 'delete' : 'keep'
        };
      });
      return mapping;
    },
    buildSliceParams() {
      return {
        slice_size: this.sliceParams.sliceSize,
        overlap: this.sliceParams.overlap,
        padding: this.sliceParams.padding,
        min_area_ratio: this.sliceParams.minAreaRatio,
        min_visibility: this.sliceParams.minVisibility,
        min_pixel_size: this.sliceParams.minPixelSize,
        negative_ratio: this.sliceParams.negativeRatio,
        empty_positive_action: this.sliceParams.emptyPositiveAction,
      };
    },
    handleSave() {
      if (!this.hasValidMapping) return;
      this.$emit('save', this.buildMapping());
    },
    confirmSliceParams() {
      this.sliceParamsConfirmed = true;
      this.showSliceDialog = false;
      if (this.pendingConvert) {
        this.pendingConvert = false;
        this.doSaveAndConvert();
      }
    },
    handleSaveAndConvert() {
      if (!this.hasValidMapping) return;
      if (!this.sliceParamsConfirmed) {
        this.pendingConvert = true;
        this.showSliceDialog = true;
        return;
      }
      this.doSaveAndConvert();
    },
    doSaveAndConvert() {
      this.$emit('save-and-convert', this.buildMapping(), this.buildSliceParams());
    },
    normalizeMappingStatus(status, mappedLabel) {
      var val = String(status || '').trim().toLowerCase();
      if (['delete', 'discard', 'drop', 'remove', '删除', '丢弃', '忽略'].indexOf(val) >= 0) return 'delete';
      if (String(mappedLabel || '').trim() === '__DISCARD__') return 'delete';
      return 'keep';
    },
    normalizeMappingKey(value) {
      if (value === null || value === undefined) return '';
      var s = String(value);
      s = s.replace(/\uFF05/g, '%').replace(/\u3000/g, ' ');
      ['\u200b', '\u200c', '\u200d', '\ufeff'].forEach(function (ch) {
        s = s.split(ch).join('');
      });
      return s.trim();
    },
    getSubtreeRows(sourceLabel) {
      var targetParts = this.splitLabel(sourceLabel);
      if (!targetParts.length) {
        return this.rows.filter(function (row) { return String(row.sourceLabel || '').trim() === String(sourceLabel || '').trim(); });
      }
      return this.rows.filter(function (row) {
        var parts = this.splitLabel(row.sourceLabel);
        if (parts.length < targetParts.length) return false;
        for (var i = 0; i < targetParts.length; i++) {
          if (parts[i] !== targetParts[i]) return false;
        }
        return true;
      }.bind(this));
    },
    getAncestorLabels(sourceLabel) {
      var parts = this.splitLabel(sourceLabel);
      var ancestors = [];
      for (var i = 1; i < parts.length; i++) {
        ancestors.push(parts.slice(0, i).join(this.separator));
      }
      return ancestors;
    },
    hasDiscardedAncestor(sourceLabel) {
      var ancestors = this.getAncestorLabels(sourceLabel);
      if (!ancestors.length) return false;
      return ancestors.some(function (label) {
        return this.rows.some(function (row) {
          return String(row.sourceLabel || '').trim() === label && row.discarded;
        });
      }.bind(this));
    },
    applyDiscardState(rows, discard) {
      var self = this;
      (Array.isArray(rows) ? rows : []).forEach(function (row) {
        row.discarded = discard;
        if (discard) {
          row.targetLabel = '';
        } else if (self.activePreset) {
          row.targetLabel = self.computeTarget(row.sourceLabel, self.activePreset, self.levelValue);
        }
        row.manuallyEdited = true;
      });
    },
    applyExternalMapping(mapping) {
      if (!mapping || typeof mapping !== 'object') {
        return { total: this.rows.length, matched: 0, unmatched: this.rows.length };
      }
      var direct = {};
      var normalized = {};
      Object.keys(mapping).forEach(function (key) {
        var k = String(key || '').trim();
        if (!k) return;
        direct[k] = mapping[key];
        var nk = this.normalizeMappingKey(k);
        if (nk) normalized[nk] = mapping[key];
      }.bind(this));

      var matched = 0;
      var discardRoots = [];
      this.rows.forEach(function (row) {
        var src = String(row.sourceLabel || '').trim();
        var hit = Object.prototype.hasOwnProperty.call(direct, src)
          ? direct[src]
          : normalized[this.normalizeMappingKey(src)];
        if (hit === undefined) return;
        matched += 1;

        // New protocol: { mapped_label, status }
        if (hit && typeof hit === 'object' && !Array.isArray(hit)) {
          var mapped = hit.mapped_label != null ? hit.mapped_label : (hit.target_label != null ? hit.target_label : (hit.target != null ? hit.target : ''));
          var hitStatus = this.normalizeMappingStatus(hit.status, mapped);

          if (hitStatus === 'delete') {
            row.discarded = true;
            row.targetLabel = '';
            discardRoots.push(row.sourceLabel);
          } else {
            row.discarded = false;
            row.targetLabel = String(mapped || '').trim();
          }
          row.manuallyEdited = true;
          return;
        }

        // Legacy protocol: plain string
        var strVal = String(hit).trim();
        if (strVal === '__DISCARD__' || strVal === '') {
          row.discarded = true;
          row.targetLabel = '';
          discardRoots.push(row.sourceLabel);
          row.manuallyEdited = true;
          return;
        }
        row.discarded = false;
        row.targetLabel = strVal;
        row.manuallyEdited = true;
      }.bind(this));

      discardRoots
        .map(function (label) { return String(label || '').trim(); })
        .filter(function (label) { return !!label; })
        .sort(function (a, b) {
          return this.splitLabel(a).length - this.splitLabel(b).length;
        }.bind(this))
        .forEach(function (label) {
          this.applyDiscardState(this.getSubtreeRows(label), true);
        }.bind(this));

      return {
        total: this.rows.length,
        matched: matched,
        unmatched: Math.max(0, this.rows.length - matched),
      };
    },
  },
};
</script>

<style scoped>
.label-mapping-panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.panel-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.panel-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-title i {
  color: #6366f1;
}

.preset-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-label {
  font-size: 0.78rem;
  color: #94a3b8;
  white-space: nowrap;
}

.level-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
}

.panel-sub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 12px;
}

.label-count-hint {
  font-size: 0.78rem;
  color: #94a3b8;
}

.search-input {
  width: 220px;
}

.mapping-table-wrap {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.mapping-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
}

.mapping-table thead,
.mapping-table tbody tr {
  display: table;
  width: 100%;
  table-layout: fixed;
}

.mapping-table th {
  background: #f8fafc;
  color: #64748b;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.mapping-table td {
  padding: 6px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.col-expand {
  width: 32px;
  text-align: center;
}

.col-source {
  min-width: 200px;
}

.col-arrow {
  width: 32px;
  text-align: center;
}

.col-target {
  min-width: 200px;
}

.col-count {
  width: 90px;
  text-align: left;
}

.col-action {
  width: 60px;
  text-align: center;
}

.mapping-row {
  background: #fff;
  transition: background 0.15s;
}

.mapping-row:hover {
  background: #fafbfd;
}

.mapping-row.is-virtual {
  background: #f9fafb;
}

.mapping-row.is-discarded {
  background: #fef2f2;
  opacity: 0.65;
}

.expand-icon {
  cursor: pointer;
  color: #94a3b8;
  font-size: 0.85rem;
  transition: color 0.15s;
}

.expand-icon:hover {
  color: #6366f1;
}

.source-label {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.source-label.line-through {
  text-decoration: line-through;
  opacity: 0.6;
}

.label-part {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 500;
}

.depth-0 {
  background: #dbeafe;
  color: #1e40af;
}

.depth-1 {
  background: #e0e7ff;
  color: #3730a3;
}

.depth-2 {
  background: #ede9fe;
  color: #5b21b6;
}

.depth-3 {
  background: #fae8ff;
  color: #86198f;
}

.depth-4 {
  background: #fce7f3;
  color: #9d174d;
}

.virtual-tag {
  font-size: 0.68rem;
  color: #94a3b8;
  border: 1px solid #cbd5e1;
  padding: 0 4px;
  border-radius: 4px;
  background: #fff;
}

.arrow-icon {
  color: #6366f1;
  font-size: 0.9rem;
}

.arrow-icon.text-muted {
  color: #cbd5e1;
}

.target-input {
  width: 100%;
}

.target-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.virtual-input :deep(.el-input__inner) {
  background-color: transparent;
  border-style: dashed;
}

.virtual-input:hover :deep(.el-input__inner) {
  border-style: solid;
}

.cascade-btn {
  padding: 6px 8px;
}

.count-tag {
  font-size: 0.7rem;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 8px;
  white-space: nowrap;
}

.count-num {
  font-size: 0.78rem;
  color: #64748b;
  padding-left: 6px;
}

.discard-badge {
  display: inline-block;
  padding: 1px 8px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 500;
}

.action-discard {
  color: #94a3b8 !important;
}

.action-discard:hover {
  color: #ef4444 !important;
}

.action-restore {
  color: #6366f1 !important;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px;
  color: #94a3b8;
  font-size: 0.85rem;
}

.no-data i {
  font-size: 1.25rem;
}

.panel-footer {
  padding: 12px 20px;
  border-top: 1px solid #f1f5f9;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  flex-shrink: 0;
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.stat {
  font-size: 0.8rem;
  color: #64748b;
}

.stat strong {
  font-weight: 700;
  color: #334155;
}

.stat.highlight strong {
  color: #2563eb;
}

.stat.warn strong {
  color: #dc2626;
}

.stat-sep {
  color: #cbd5e1;
  font-size: 0.75rem;
}

.categories-preview {
  display: inline-flex;
  gap: 3px;
  flex-wrap: wrap;
  margin-left: 4px;
}

.cat-tag {
  font-size: 0.68rem;
}

.action-row {
  display: flex;
  gap: 8px;
  justify-self: end;
  align-self: end;
  flex-shrink: 0;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .panel-footer {
    grid-template-columns: 1fr;
  }

  .action-row {
    justify-self: end;
  }
}

.slice-dialog-hint {
  font-size: 0.82rem;
  color: #64748b;
  margin-bottom: 16px;
  line-height: 1.5;
}

.params-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.param-label {
  font-size: 0.78rem;
  font-weight: 500;
  color: #334155;
}

.param-key {
  font-size: 0.68rem;
  color: #94a3b8;
  font-weight: 400;
  font-family: monospace;
}

.param-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.param-unit {
  font-size: 0.72rem;
  color: #94a3b8;
}

.param-desc {
  font-size: 0.68rem;
  color: #94a3b8;
  line-height: 1.3;
}

.scrollable-tbody {
  display: block;
  height: 400px;
  overflow-y: auto;
}
</style>
