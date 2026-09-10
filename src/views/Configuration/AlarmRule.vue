<template>
  <div class="alarm">
    <header>
      <h3>告警规则</h3>
      <el-button :disabled="!!busy" :loading="loadingAny" @click="bootstrap">
        刷新
      </el-button>
      <el-button
        :loading="busy === 'eval'"
        :disabled="loadingAny || (!!busy && busy !== 'eval')"
        @click="evaluate"
      >
        立即评估
      </el-button>
      <el-button
        type="primary"
        :disabled="!canCreate || !!busy || loadingAny"
        @click="openCreate"
      >
        新建规则
      </el-button>
      <span v-if="catalogLoaded && rulesLoaded && !canCreate">
        所有告警规则类型均已配置
      </span>
    </header>
    <el-alert
      v-for="error in errorMessages"
      :key="error"
      type="error"
      :closable="false"
      :title="error"
      show-icon
    />
    <div v-loading="loading.summary" class="summary">
      <span>
        活跃总数 {{ summary.active_total == null ? "-" : summary.active_total }}
      </span>
      <span v-for="severity in severities" :key="severity.value">
        {{ severity.label }}
        {{
          summary.by_severity && summary.by_severity[severity.value] != null
            ? summary.by_severity[severity.value]
            : "-"
        }}
      </span>
    </div>
    <main>
      <section class="config-section">
        <h4>规则配置</h4>
        <el-input v-model="search" placeholder="搜索规则" clearable />
        <div v-loading="loading.rules">
          <article
            v-for="rule in filteredRules"
            :key="rule.rule_id"
            :class="{ selected: selected && selected.rule_id === rule.rule_id }"
            @click="selected = rule"
          >
            <b>{{ rule.name }}</b>
            <el-tag :type="severityTagType(rule.severity)" size="small">
              {{ severityLabel(rule.severity) }}
            </el-tag>
            <el-switch
              :value="rule.enabled"
              :disabled="!!busy || loadingAny"
              @click.native.stop
              @change="(value) => toggle(rule, value)"
            />
            <p>
              {{ ruleTypeLabel(rule.rule_type) }} · 冷却
              {{ rule.cooldown_seconds }} 秒
            </p>
            <p v-if="rule.rule_type === 'training_run_stale'">
              心跳超时：{{ stale(rule) }} 秒
            </p>
            <small>
              {{ rule.description || ruleTypeDescription(rule.rule_type) }}
            </small>
            <div>
              <el-button
                type="text"
                :disabled="!!busy || loadingAny"
                @click.stop="openEdit(rule)"
              >
                编辑
              </el-button>
              <el-button
                type="text"
                :disabled="!!busy || loadingAny"
                @click.stop="remove(rule)"
              >
                删除
              </el-button>
            </div>
          </article>
          <el-empty
            v-if="!loading.rules && !errors.rules && !filteredRules.length"
            description="暂无规则"
          />
        </div>
      </section>
      <aside>
        <section>
          <h4>
            活跃告警
            <el-badge
              :value="summary.active_total == null ? '-' : summary.active_total"
            />
          </h4>
          <div v-loading="loading.active">
            <article v-for="alert in active" :key="alert.alert_id">
              <b>{{ alert.title }}</b>
              <el-tag :type="severityTagType(alert.severity)" size="small">
                {{ severityLabel(alert.severity) }}
              </el-tag>
              <p>{{ alert.message }}</p>
              <small>
                任务：{{ alert.source_id || "-" }} · 触发次数：{{
                  alert.trigger_count
                }}
                · 最近触发：{{ formatDateTime(alert.last_triggered_at) }}
              </small>
              <p v-if="alert.acked_at">
                已确认 · {{ alert.acked_by || "-" }} ·
                {{ formatDateTime(alert.acked_at) }}
              </p>
              <el-button
                v-else
                size="mini"
                :loading="busy === alert.alert_id"
                :disabled="!!busy || loading.active"
                @click="ack(alert)"
              >
                确认已知晓
              </el-button>
            </article>
            <el-empty
              v-if="!loading.active && !errors.active && !active.length"
              description="暂无活跃告警"
            />
          </div>
          <el-pagination
            layout="prev,pager,next,total"
            :page-size="activePageSize"
            :current-page="activePage"
            :total="activeTotal"
            @current-change="
              (page) => {
                activePage = page;
                loadActive();
              }
            "
          />
        </section>
        <section>
          <h4>告警历史</h4>
          <div class="filters">
            <el-select
              v-model="filter.severity"
              clearable
              placeholder="严重级别"
              @change="filterHistory"
            >
              <el-option
                v-for="severity in severities"
                :key="severity.value"
                :label="severity.label"
                :value="severity.value"
              />
            </el-select>
            <el-select
              v-model="filter.ruleType"
              clearable
              placeholder="规则类型"
              @change="filterHistory"
            >
              <el-option
                v-for="type in types"
                :key="type.rule_type"
                :label="type.name || type.rule_type"
                :value="type.rule_type"
              />
            </el-select>
            <el-input
              v-model="filter.sourceId"
              clearable
              placeholder="Training Run ID"
              @keyup.enter.native="filterHistory"
              @clear="filterHistory"
            />
            <el-button icon="el-icon-search" @click="filterHistory">
              查询
            </el-button>
          </div>
          <div v-loading="loading.history">
            <article v-for="alert in history" :key="alert.alert_id">
              <b>{{ alert.title }}</b>
              <el-tag :type="severityTagType(alert.severity)" size="small">
                {{ severityLabel(alert.severity) }}
              </el-tag>
              <p>{{ alert.message }}</p>
              <small>
                任务：{{ alert.source_id || "-" }} · 触发
                {{ alert.trigger_count }} 次
              </small>
              <p class="timestamps">
                首次：{{ formatDateTime(alert.first_triggered_at) }} · 最近：{{
                  formatDateTime(alert.last_triggered_at)
                }}
                · 恢复：{{ formatDateTime(alert.resolved_at) }}
              </p>
              <small v-if="alert.acked_by">确认人：{{ alert.acked_by }}</small>
            </article>
            <el-empty
              v-if="!loading.history && !errors.history && !history.length"
              description="暂无告警历史"
            />
          </div>
          <el-pagination
            layout="prev,pager,next,total"
            :page-size="historyPageSize"
            :current-page="historyPage"
            :total="historyTotal"
            @current-change="
              (page) => {
                historyPage = page;
                loadHistory();
              }
            "
          />
        </section>
      </aside>
    </main>
    <el-dialog
      :title="mode === 'create' ? '新建规则' : '编辑规则'"
      :visible.sync="dialog"
      width="650px"
      :before-close="closeDialog"
      :close-on-click-modal="!busy"
      :close-on-press-escape="!busy"
      :show-close="!busy"
    >
      <el-form
        ref="form"
        :model="form"
        :rules="rules"
        :disabled="!!busy"
        label-width="110px"
      >
        <el-form-item label="规则类型" prop="rule_type">
          <el-select
            v-if="mode === 'create'"
            v-model="form.rule_type"
            @change="defaults"
          >
            <el-option
              v-for="type in types"
              :key="type.rule_type"
              :label="type.name || type.rule_type"
              :value="type.rule_type"
              :disabled="existing.includes(type.rule_type)"
            />
          </el-select>
          <el-input v-else :value="ruleTypeLabel(form.rule_type)" disabled />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" />
        </el-form-item>
        <el-form-item label="严重级别" prop="severity">
          <el-select v-model="form.severity">
            <el-option
              v-for="severity in severities"
              :key="severity.value"
              :label="severity.label"
              :value="severity.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="冷却时间" prop="cooldown_seconds">
          <el-input-number
            v-model="form.cooldown_seconds"
            :min="0"
            :max="86400"
            :precision="0"
          />
          秒
          <div class="help">同一活跃告警再次触发时的最小更新时间间隔</div>
        </el-form-item>
        <el-form-item
          v-if="form.rule_type === 'training_run_stale'"
          label="心跳超时"
          prop="stale_after_seconds"
        >
          <el-input-number
            v-model="form.stale_after_seconds"
            :min="1"
            :max="86400"
            :precision="0"
            :placeholder="staleDefault"
            @change="staleChanged = true"
          />
          秒
          <div class="help">{{ staleDescription }}</div>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button :disabled="!!busy" @click="dialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="busy === 'save'"
          :disabled="loadingAny || (!!busy && busy !== 'save')"
          @click="save"
        >
          保存
        </el-button>
      </span>
    </el-dialog>
  </div>
</template>
<script>
import * as api from "@/api/alarms";
export default {
  name: "AlarmRule",
  data() {
    const integerRange = (minimum, maximum) => (rule, value, callback) => {
      if (Number.isInteger(value) && value >= minimum && value <= maximum)
        callback();
      else callback(new Error(`请输入 ${minimum} 到 ${maximum} 的整数`));
    };
    return {
      types: [],
      rulesList: [],
      rulesTotal: 0,
      active: [],
      history: [],
      summary: {},
      errors: { types: "", rules: "", active: "", history: "", summary: "" },
      search: "",
      selected: null,
      dialog: false,
      mode: "create",
      form: {},
      editing: null,
      staleChanged: false,
      busy: null,
      loading: {
        types: false,
        rules: false,
        active: false,
        history: false,
        summary: false,
      },
      catalogLoaded: false,
      rulesLoaded: false,
      activePage: 1,
      activePageSize: 20,
      historyPage: 1,
      historyPageSize: 20,
      activeTotal: 0,
      historyTotal: 0,
      activeReq: 0,
      historyReq: 0,
      filter: { severity: "", ruleType: "", sourceId: "" },
      appliedFilter: { severity: "", ruleType: "", sourceId: "" },
      severities: [
        { value: "critical", label: "严重" },
        { value: "high", label: "高" },
        { value: "medium", label: "中" },
        { value: "low", label: "低" },
      ],
      rules: {
        rule_type: [{ required: true, message: "请选择规则类型" }],
        name: [{ required: true, whitespace: true, message: "请输入名称" }],
        severity: [{ required: true, message: "请选择严重级别" }],
        cooldown_seconds: [
          { validator: integerRange(0, 86400), trigger: "change" },
        ],
        stale_after_seconds: [
          {
            validator: (rule, value, callback) =>
              this.mode === "edit" && !this.staleChanged && value == null
                ? callback()
                : integerRange(1, 86400)(rule, value, callback),
            trigger: "change",
          },
        ],
      },
    };
  },
  computed: {
    loadingAny() {
      return Object.values(this.loading).some(Boolean);
    },
    errorMessages() {
      return Object.values(this.errors).filter(Boolean);
    },
    ruleTypeMetaMap() {
      const metadata = {};
      this.types.forEach((type) => {
        metadata[type.rule_type] = type;
      });
      return metadata;
    },
    existing() {
      return this.rulesList.map((x) => x.rule_type);
    },
    canCreate() {
      return (
        this.catalogLoaded &&
        this.rulesLoaded &&
        this.types.some((x) => !this.existing.includes(x.rule_type))
      );
    },
    filteredRules() {
      let q = this.search.toLowerCase();
      return this.rulesList.filter((x) =>
        (x.name + " " + this.ruleTypeLabel(x.rule_type))
          .toLowerCase()
          .includes(q)
      );
    },
    staleDescription() {
      return (
        this.ruleTypeMetaMap.training_run_stale?.config_schema
          ?.stale_after_seconds?.description || ""
      );
    },
    staleDefault() {
      const value =
        this.ruleTypeMetaMap.training_run_stale?.config_schema
          ?.stale_after_seconds?.default;
      return value == null ? "" : String(value);
    },
  },
  mounted() {
    this.bootstrap();
  },
  methods: {
    err(e) {
      return e?.message || "请求失败";
    },
    severityLabel(v) {
      return this.severities.find((x) => x.value === v)?.label || v;
    },
    severityTagType(v) {
      return (
        { critical: "danger", high: "warning", medium: "", low: "info" }[v] ||
        "info"
      );
    },
    ruleTypeLabel(v) {
      return this.ruleTypeMetaMap[v]?.name || v;
    },
    ruleTypeDescription(v) {
      return this.ruleTypeMetaMap[v]?.description || "";
    },
    formatDateTime(v) {
      if (!v) return "-";
      let d = new Date(v);
      return isNaN(d) ? v : d.toLocaleString("zh-CN", { hour12: false });
    },
    stale(r) {
      return r.config?.stale_after_seconds ?? (this.staleDefault || "-");
    },
    async bootstrap() {
      if (this.busy || this.loadingAny) return;
      await Promise.all([
        this.loadTypes(),
        this.loadRules(),
        this.loadActive(),
        this.loadHistory(),
        this.loadSummary(),
      ]);
    },
    async loadTypes() {
      this.loading.types = true;
      try {
        const data = await api.fetchAlarmRuleTypes();
        this.types = Array.isArray(data) ? data : data.items || [];
        this.catalogLoaded = true;
        this.errors.types = "";
      } catch (error) {
        this.catalogLoaded = false;
        this.errors.types = "规则类型加载失败：" + this.err(error);
      } finally {
        this.loading.types = false;
      }
    },
    async loadRules() {
      this.loading.rules = true;
      try {
        let d = await api.fetchAlarmRules({ page: 1, pageSize: 500 });
        this.rulesList = d.items || [];
        this.rulesTotal = d.meta?.total || 0;
        this.rulesLoaded = true;
        this.errors.rules = "";
        if (this.selected) {
          this.selected =
            this.rulesList.find(
              (item) => item.rule_id === this.selected.rule_id
            ) || null;
        }
      } catch (error) {
        this.rulesLoaded = false;
        this.errors.rules = "规则加载失败：" + this.err(error);
      } finally {
        this.loading.rules = false;
      }
    },
    async loadActive() {
      let id = ++this.activeReq;
      this.loading.active = true;
      try {
        let d = await api.fetchActiveAlarms({
          page: this.activePage,
          pageSize: this.activePageSize,
        });
        if (id !== this.activeReq) return;
        this.errors.active = "";
        this.active = d.items || [];
        this.activeTotal = d.meta?.total || 0;
        let max = Math.max(
          1,
          Math.ceil(this.activeTotal / this.activePageSize)
        );
        if (this.activePage > max) {
          this.activePage = max;
          return this.loadActive();
        }
      } catch (error) {
        if (id === this.activeReq) {
          this.active = [];
          this.errors.active = "活跃告警加载失败：" + this.err(error);
        }
      } finally {
        if (id === this.activeReq) this.loading.active = false;
      }
    },
    async loadHistory() {
      let id = ++this.historyReq;
      this.loading.history = true;
      try {
        let d = await api.fetchAlarmHistory({
          page: this.historyPage,
          pageSize: this.historyPageSize,
          ...this.appliedFilter,
        });
        if (id !== this.historyReq) return;
        this.errors.history = "";
        this.history = d.items || [];
        this.historyTotal = d.meta?.total || 0;
        let max = Math.max(
          1,
          Math.ceil(this.historyTotal / this.historyPageSize)
        );
        if (this.historyPage > max) {
          this.historyPage = max;
          return this.loadHistory();
        }
      } catch (error) {
        if (id === this.historyReq) {
          this.history = [];
          this.errors.history = "告警历史加载失败：" + this.err(error);
        }
      } finally {
        if (id === this.historyReq) this.loading.history = false;
      }
    },
    async loadSummary() {
      this.loading.summary = true;
      try {
        this.summary = await api.fetchAlarmSummary();
        this.errors.summary = "";
      } catch (error) {
        this.summary = {};
        this.errors.summary = "汇总加载失败：" + this.err(error);
      } finally {
        this.loading.summary = false;
      }
    },
    openCreate() {
      if (this.busy || this.loadingAny || !this.canCreate) return;
      this.mode = "create";
      this.staleChanged = false;
      this.form = {
        rule_type: "",
        name: "",
        description: "",
        severity: "",
        enabled: true,
        cooldown_seconds: 0,
        stale_after_seconds: undefined,
      };
      this.dialog = true;
      this.$nextTick(() => this.$refs.form.clearValidate());
    },
    openEdit(r) {
      if (this.busy || this.loadingAny) return;
      this.mode = "edit";
      this.editing = r.rule_id;
      this.staleChanged = false;
      this.form = {
        rule_type: r.rule_type,
        name: r.name,
        description: r.description || "",
        severity: r.severity,
        enabled: r.enabled,
        cooldown_seconds: r.cooldown_seconds,
        stale_after_seconds: r.config?.stale_after_seconds,
      };
      this.dialog = true;
      this.$nextTick(() => this.$refs.form.clearValidate());
    },
    defaults(v) {
      let m = this.ruleTypeMetaMap[v],
        s = m?.config_schema || {};
      Object.assign(this.form, {
        name: m.name,
        description: m.description || "",
        severity: m.default_severity,
        enabled: m.default_enabled,
        cooldown_seconds: m.default_cooldown_seconds,
        stale_after_seconds: s.stale_after_seconds?.default ?? null,
      });
      this.staleChanged = v === "training_run_stale";
    },
    save() {
      if (this.busy || this.loadingAny) return;
      this.$refs.form.validate(async (ok) => {
        if (!ok || this.busy) return;
        this.busy = "save";
        try {
          let p = {
            name: this.form.name.trim(),
            description: this.form.description,
            severity: this.form.severity,
            enabled: this.form.enabled,
            cooldown_seconds: this.form.cooldown_seconds,
          };
          if (this.mode === "create")
            await api.createAlarmRule({
              rule_type: this.form.rule_type,
              ...p,
              config:
                this.form.rule_type === "training_run_stale"
                  ? { stale_after_seconds: this.form.stale_after_seconds }
                  : {},
            });
          else {
            if (this.form.rule_type === "training_run_failed") p.config = {};
            else if (this.staleChanged)
              p.config = { stale_after_seconds: this.form.stale_after_seconds };
            await api.updateAlarmRule(this.editing, p);
          }
          this.dialog = false;
          await this.loadRules();
          this.$message.success("保存成功");
        } catch (e) {
          this.$message.error(this.err(e));
        } finally {
          this.busy = null;
        }
      });
    },
    async toggle(r, v) {
      if (this.busy || this.loading.rules) return;
      let old = r.enabled;
      this.$set(r, "enabled", v);
      this.busy = r.rule_id;
      try {
        await api.updateAlarmRule(r.rule_id, { enabled: v });
      } catch (e) {
        this.$set(r, "enabled", old);
        this.$message.error(this.err(e));
        this.busy = null;
        return;
      }
      try {
        await this.loadRules();
      } catch (e) {
        this.$message.error("规则已更新，但刷新失败：" + this.err(e));
      } finally {
        this.busy = null;
      }
    },
    async remove(r) {
      if (this.busy || this.loading.rules) return;
      this.busy = r.rule_id;
      try {
        await this.$confirm("确认删除规则“" + r.name + "”吗？", "删除规则", {
          type: "warning",
        });
      } catch (_) {
        this.busy = null;
        return;
      }
      try {
        await api.deleteAlarmRule(r.rule_id);
        if (this.selected?.rule_id === r.rule_id) this.selected = null;
        await this.loadRules();
      } catch (e) {
        this.$message.error(this.err(e));
      } finally {
        this.busy = null;
      }
    },
    async evaluate() {
      if (this.busy || this.loadingAny) return;
      this.busy = "eval";
      try {
        let r = await api.evaluateAlarms({ runIds: [] });
        await Promise.all([
          this.loadRules(),
          this.loadActive(),
          this.loadHistory(),
          this.loadSummary(),
        ]);
        this.$message.success(
          `评估完成：新增 ${r.triggered_new || 0}，更新 ${
            r.touched_active || 0
          }，恢复 ${r.resolved || 0}`
        );
      } catch (e) {
        this.$message.error(this.err(e));
      } finally {
        this.busy = null;
      }
    },
    async ack(a) {
      if (this.busy || a.acked_at || this.loading.active) return;
      this.busy = a.alert_id;
      try {
        await api.ackAlarmAlert(a.alert_id, { ackedBy: "管理员" });
        await this.loadActive();
      } catch (e) {
        this.$message.error(this.err(e));
      } finally {
        this.busy = null;
      }
    },
    filterHistory() {
      this.appliedFilter = {
        ...this.filter,
        sourceId: this.filter.sourceId.trim(),
      };
      this.historyPage = 1;
      return this.loadHistory();
    },
    closeDialog(done) {
      if (!this.busy) done();
    },
  },
};
</script>
<style scoped>
.alarm {
  margin: 10px;
  min-width: 800px;
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
header h3 {
  margin-right: auto;
  color: #111f68;
}
.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 25px;
  padding: 14px;
  background: #fff;
  border: 1px solid #eee;
}
main {
  display: flex;
  gap: 20px;
  margin-top: 15px;
}
main > section {
  width: 35%;
  max-width: 400px;
  align-self: flex-start;
}
aside {
  flex: 1;
  min-width: 0;
}
section {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 15px;
  margin-bottom: 15px;
}
article {
  padding: 12px;
  margin: 10px 0;
  background: #f8fafc;
  border-left: 4px solid #111f68;
  overflow-wrap: anywhere;
}
article.selected {
  background: #e8ecf5;
}
article .el-switch {
  float: right;
}
small {
  color: #64748b;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filters > * {
  flex: 1;
}
.el-pagination {
  text-align: right;
}
.help,
.timestamps {
  font-size: 12px;
  color: #64748b;
}
@media (max-width: 1400px) {
  main {
    flex-direction: column;
  }
  main > section {
    width: 100%;
    max-width: none;
    box-sizing: border-box;
  }
}
</style>
