<template>
    <div class="framework-registry">
        <div class="top-bar">
            <div>
                <h3>训练框架插件</h3>
                <p class="subtitle">查看后端已注册的训练插件、配置 Schema，并验证插件配置。</p>
            </div>
            <el-button :loading="listLoading" class="outline-button" @click="reloadFrameworks">
                <i class="el-icon-refresh"></i> 刷新
            </el-button>
        </div>

        <div v-if="listError" class="state-message error-message">{{ listError }}</div>

        <div class="content-wrapper">
            <section class="section-card plugin-panel">
                <div class="panel-header">
                    <h4><i class="el-icon-box"></i> 已注册插件</h4>
                    <span class="badge">{{ frameworks.length }}</span>
                </div>
                <div v-if="listLoading && !frameworks.length" class="state-message">正在加载插件列表...</div>
                <div v-else-if="!listError && !frameworks.length" class="state-message">暂无已注册插件</div>
                <div v-else class="plugin-list">
                    <div
                        v-for="plugin in frameworks"
                        :key="plugin.plugin_id"
                        class="plugin-card"
                        :class="{ active: plugin.plugin_id === selectedPluginId }"
                        role="button"
                        :aria-disabled="listLoading ? 'true' : 'false'"
                        :tabindex="listLoading ? -1 : 0"
                        @click="selectPlugin(plugin)"
                        @keydown.enter.prevent="selectPlugin(plugin)"
                        @keydown.space.prevent="selectPlugin(plugin)"
                    >
                        <div class="plugin-heading">
                            <strong>{{ plugin.display_name || plugin.name || plugin.plugin_id }}</strong>
                            <el-tag :type="plugin.implemented === true ? 'success' : 'info'" size="mini">
                                {{ plugin.implemented === true ? '已实现' : '未实现' }}
                            </el-tag>
                        </div>
                        <div class="plugin-field"><span>plugin_id</span>{{ plugin.plugin_id }}</div>
                        <div class="plugin-field"><span>name</span>{{ plugin.name || '-' }}</div>
                    </div>
                </div>
            </section>

            <div class="details-panel">
                <section class="section-card">
                    <div class="panel-header">
                        <h4><i class="el-icon-document"></i> Config Schema</h4>
                        <span v-if="selectedPlugin" class="plugin-id">{{ selectedPlugin.plugin_id }}</span>
                    </div>
                    <div v-if="!selectedPlugin" class="state-message">请选择一个插件</div>
                    <template v-else>
                        <div class="selected-meta">
                            <span>plugin_id: {{ selectedPlugin.plugin_id }}</span>
                            <el-tag :type="selectedPlugin.implemented === true ? 'success' : 'info'" size="mini">
                                {{ selectedPlugin.implemented === true ? '已实现' : '未实现' }}
                            </el-tag>
                        </div>
                        <div v-if="schemaLoading" class="state-message">正在加载配置 Schema...</div>
                        <div v-else-if="schemaError" class="state-message error-message">{{ schemaError }}</div>
                        <pre v-else-if="configSchema !== null" class="json-viewer">{{ formattedSchema }}</pre>
                    </template>
                </section>

                <section class="section-card">
                    <div class="panel-header">
                        <h4><i class="el-icon-edit-outline"></i> JSON 配置</h4>
                    </div>
                    <el-input
                        v-model="configText"
                        type="textarea"
                        :rows="10"
                        :disabled="!selectedPlugin || listLoading || validating"
                        placeholder="{}"
                        @input="handleConfigInput"
                    />
                    <div class="editor-actions">
                        <el-button :disabled="!selectedPlugin || listLoading || validating" @click="resetConfig">重置配置</el-button>
                        <el-button type="primary" :loading="validating" :disabled="!canValidate" @click="validateConfig">
                            验证配置
                        </el-button>
                    </div>
                    <div v-if="validationError" class="state-message error-message">{{ validationError }}</div>
                    <div v-if="normalizedConfig !== null" class="normalized-result">
                        <div class="success-message"><i class="el-icon-success"></i> 配置校验通过</div>
                        <h5>规范化配置</h5>
                        <pre class="json-viewer">{{ formattedNormalizedConfig }}</pre>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>

<script>
import {
    fetchFrameworkConfigSchema,
    fetchFrameworks,
    validateFrameworkConfig,
} from '@/api/frameworks';

export default {
    name: 'ModelFrameSelect',
    data() {
        return {
            frameworks: [],
            selectedPluginId: null,
            configSchema: null,
            configText: '{}',
            normalizedConfig: null,
            listLoading: false,
            listError: '',
            schemaLoading: false,
            schemaError: '',
            validating: false,
            validationError: '',
            listGeneration: 0,
            schemaGeneration: 0,
            validationGeneration: 0,
        };
    },
    computed: {
        selectedPlugin() {
            return this.frameworks.find(plugin => plugin.plugin_id === this.selectedPluginId) || null;
        },
        canValidate() {
            return Boolean(this.selectedPlugin && this.selectedPlugin.implemented === true && !this.listLoading &&
                this.configSchema !== null && !this.schemaLoading && !this.schemaError && !this.validating);
        },
        formattedSchema() {
            return JSON.stringify(this.configSchema, null, 2);
        },
        formattedNormalizedConfig() {
            return JSON.stringify(this.normalizedConfig, null, 2);
        },
    },
    mounted() {
        this.reloadFrameworks();
    },
    beforeDestroy() {
        this.listGeneration += 1;
        this.schemaGeneration += 1;
        this.validationGeneration += 1;
    },
    methods: {
        invalidateValidation() {
            this.validationGeneration += 1;
            this.validating = false;
            this.normalizedConfig = null;
            this.validationError = '';
        },
        clearPluginState() {
            this.schemaGeneration += 1;
            this.schemaLoading = false;
            this.schemaError = '';
            this.configSchema = null;
            this.configText = '{}';
            this.invalidateValidation();
        },
        async reloadFrameworks() {
            const generation = ++this.listGeneration;
            const previousPluginId = this.selectedPluginId;
            this.listLoading = true;
            this.listError = '';
            this.clearPluginState();
            try {
                const frameworks = await fetchFrameworks();
                if (generation !== this.listGeneration) return;
                this.frameworks = frameworks;
                const previousPlugin = frameworks.find(plugin => plugin.plugin_id === previousPluginId);
                const nextPlugin = previousPlugin || frameworks.find(plugin => plugin.implemented === true) || null;
                this.selectedPluginId = nextPlugin ? nextPlugin.plugin_id : null;
                if (nextPlugin) this.loadConfigSchema(nextPlugin.plugin_id);
            } catch (error) {
                if (generation !== this.listGeneration) return;
                this.frameworks = [];
                this.selectedPluginId = null;
                this.listError = error.message || '插件列表加载失败';
            } finally {
                if (generation === this.listGeneration) this.listLoading = false;
            }
        },
        selectPlugin(plugin) {
            if (this.listLoading || !plugin || plugin.plugin_id === this.selectedPluginId) return;
            this.selectedPluginId = plugin.plugin_id;
            this.clearPluginState();
            this.loadConfigSchema(plugin.plugin_id);
        },
        async loadConfigSchema(pluginId) {
            const generation = ++this.schemaGeneration;
            this.schemaLoading = true;
            this.schemaError = '';
            this.configSchema = null;
            try {
                const response = await fetchFrameworkConfigSchema(pluginId);
                if (generation !== this.schemaGeneration || pluginId !== this.selectedPluginId) return;
                this.configSchema = response.config_schema;
            } catch (error) {
                if (generation !== this.schemaGeneration || pluginId !== this.selectedPluginId) return;
                this.schemaError = error.message || '配置 Schema 加载失败';
            } finally {
                if (generation === this.schemaGeneration && pluginId === this.selectedPluginId) this.schemaLoading = false;
            }
        },
        handleConfigInput() {
            this.invalidateValidation();
        },
        resetConfig() {
            this.configText = '{}';
            this.invalidateValidation();
        },
        async validateConfig() {
            if (!this.canValidate) return;
            let config;
            try {
                config = JSON.parse(this.configText);
            } catch (_) {
                this.validationError = 'JSON 格式错误';
                this.normalizedConfig = null;
                return;
            }
            if (config === null || Array.isArray(config) || typeof config !== 'object') {
                this.validationError = 'JSON 格式错误：顶层必须是 object';
                this.normalizedConfig = null;
                return;
            }
            const pluginId = this.selectedPluginId;
            const generation = ++this.validationGeneration;
            this.validating = true;
            this.validationError = '';
            this.normalizedConfig = null;
            try {
                const response = await validateFrameworkConfig(pluginId, config);
                if (generation !== this.validationGeneration || pluginId !== this.selectedPluginId) return;
                this.normalizedConfig = response.normalized_config;
            } catch (error) {
                if (generation !== this.validationGeneration || pluginId !== this.selectedPluginId) return;
                this.validationError = error.message || '配置校验失败';
            } finally {
                if (generation === this.validationGeneration && pluginId === this.selectedPluginId) this.validating = false;
            }
        },
    },
};
</script>

<style scoped>
.framework-registry { display: flex; flex-direction: column; gap: 16px; padding-right: 6px; }
.top-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.top-bar h3 { margin: 0; color: #111f68; font-size: 22px; }
.subtitle { margin: 4px 0 0; color: #6c757d; font-size: 13px; }
.content-wrapper { display: grid; grid-template-columns: minmax(300px, 38fr) minmax(0, 62fr); gap: 16px; }
.section-card { padding: 16px; border: 1px solid #e8ecef; border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.plugin-panel, .details-panel { min-width: 0; }
.details-panel { display: flex; flex-direction: column; gap: 16px; }
.panel-header, .plugin-heading, .selected-meta, .editor-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.panel-header { margin-bottom: 12px; color: #111f68; }
.panel-header h4 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; }
.badge { padding: 4px 10px; border-radius: 12px; color: #fff; background: #111f68; font-size: 12px; }
.plugin-list { display: grid; gap: 10px; }
.plugin-card { padding: 13px; border: 1.5px solid #e1e6ee; border-radius: 10px; background: #fafbfc; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s; }
.plugin-card:hover, .plugin-card:focus { border-color: #111f68; box-shadow: 0 4px 14px rgba(17, 31, 104, 0.12); outline: none; }
.plugin-card.active { border-color: #111f68; background: #f1f3fb; box-shadow: inset 3px 0 #111f68; }
.plugin-heading { color: #111f68; }
.plugin-field { margin-top: 8px; color: #344054; font-size: 13px; overflow-wrap: anywhere; }
.plugin-field span { display: inline-block; width: 76px; color: #8490a3; }
.plugin-id { color: #6c757d; font-family: Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
.selected-meta { margin-bottom: 10px; color: #44506a; font-size: 13px; }
.json-viewer { max-height: 360px; margin: 0; padding: 14px; overflow: auto; border: 1px solid #dfe4ec; border-radius: 8px; color: #26324b; background: #f7f8fa; font: 12px/1.6 Consolas, Monaco, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.editor-actions { justify-content: flex-end; margin-top: 12px; }
.state-message { padding: 14px; color: #6c757d; text-align: center; }
.error-message { color: #c0392b; background: #fff4f2; border-radius: 8px; }
.normalized-result { margin-top: 14px; }
.normalized-result h5 { margin: 10px 0 8px; color: #111f68; }
.success-message { color: #15945b; font-size: 14px; }
.outline-button { border-color: #111f68; color: #111f68; }
@media (max-width: 1000px) { .content-wrapper { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .top-bar { align-items: flex-start; flex-direction: column; } .top-bar .el-button { margin-left: 0; } }
</style>
