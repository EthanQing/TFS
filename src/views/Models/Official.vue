<template>
  <div class="official-panel">
    <template v-if="isPaddleEngine">
      <div class="panel-top">
        <div>
          <div class="panel-title">官方模型目录</div>
          <div class="panel-subtitle">{{ frameworkDisplayName }} · {{ normalizedEngine }}</div>
        </div>
        <div class="dataset-chip" v-if="selectedProject">
          <span class="label">数据集</span>
          <span class="value">{{ datasetLabel }}</span>
        </div>
      </div>

      <div class="arch-section">
        <div class="section-title">{{ sectionTitle }}</div>
        <div v-if="archLoading" class="arch-state">
          <i class="el-icon-loading"></i>
          <span>加载架构中...</span>
        </div>
        <div v-else-if="archError" class="arch-state error">
          <i class="el-icon-warning"></i>
          <span>{{ archError }}</span>
          <el-button size="mini" type="primary" @click="reloadArchitectures" style="margin-left: 10px">重试</el-button>
        </div>
        <div v-else-if="architectureGroups.length" class="arch-tabbed">
          <div class="family-tabs">
            <button
              v-for="group in architectureGroups"
              :key="group.family"
              type="button"
              :class="['family-tab', { active: selectedFamily === group.family }]"
              @click="onSelectFamily(group.family)"
            >
              {{ group.family }}
              <span class="tab-count">{{ group.items.length }}</span>
            </button>
          </div>
          <div class="variant-chips">
            <button
              v-for="arch in selectedFamilyItems"
              :key="arch.arch_id || arch.model_variant"
              type="button"
              :class="['arch-chip', { active: selectedModel === arch.model_variant }]"
              @click="onSelectArchitecture(arch)"
            >
              {{ formatVariantShort(arch.model_variant) }}
            </button>
          </div>
        </div>
        <div v-else class="arch-state">
          <i class="el-icon-info"></i>
          <span>暂无可用架构</span>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">准确率</div>
          <div class="metric-value">{{ accuracyLabel }}%</div>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: accuracyWidth + '%' }"></div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">速度(ms)</div>
          <div class="metric-value">{{ speedLabel }}ms</div>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: speedWidth + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="advanced-panel">
        <button class="advanced-toggle" type="button" @click="toggleAdvancedSettings">
          <span>高级设置</span>
          <span class="chevron" :class="{ open: advancedSettingsExpanded }"></span>
        </button>
        <div v-show="advancedSettingsExpanded" class="advanced-grid">
          <div class="field-row">
            <div class="field-label">预训练权重</div>
            <el-switch v-model="pretrainedEnabled"></el-switch>
          </div>
          <div class="field-row" v-if="pretrainedEnabled">
            <div class="field-label">上传预训练权重</div>
            <div class="upload-compact">
              <el-upload
                ref="pretrainUploader"
                action="#"
                :auto-upload="false"
                :on-change="handlePretrainFileChange"
                :show-file-list="false"
                :disabled="uploadingPretrain"
                accept=".pt,.pth,.ckpt,.pdparams"
                class="upload-hidden"
              >
                <el-button size="small" type="primary" :loading="uploadingPretrain" class="browse-btn">
                  <i class="el-icon-folder-opened" v-if="!uploadingPretrain"></i>
                  {{ uploadingPretrain ? "上传中..." : "选择文件" }}
                </el-button>
              </el-upload>
              <span v-if="pretrainedFileName" class="file-name" :title="pretrainedFileName">
                <i class="el-icon-document"></i>
                {{ pretrainedFileName }}
                <i class="el-icon-close remove-icon" @click="removePretrainFile"></i>
              </span>
              <span v-else class="file-hint">.pt / .pth / .ckpt / .pdparams</span>
            </div>
            <div v-if="pretrainUploadError" class="upload-error">{{ pretrainUploadError }}</div>
          </div>
          <div class="field-row">
            <div class="field-label">保存周期 (每隔X轮保存一次 【-1禁用】)</div>
            <el-input v-model="savePeriod" size="small" placeholder="-1" class="field-input">
              <template slot="append">Epochs</template>
            </el-input>
          </div>
          <div class="field-row">
            <div class="field-label">训练轮次</div>
            <el-input v-model="epochs" size="small" placeholder="100" class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label">图像尺寸</div>
            <el-input v-model="imgSize" size="small" placeholder="640" class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label">学习率</div>
            <el-input v-model="learningRate" size="small" placeholder="0.01" class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label-row">
              <span class="field-label">设备</span>
              <el-tooltip effect="dark" placement="top" content="默认使用单卡 GPU 0。多卡请用逗号分隔（如 0,1）。如需仅使用 CPU，请输入 cpu。">
                <i class="el-icon-question hint-icon"></i>
              </el-tooltip>
            </div>
            <el-input v-model="selectedDevice" size="small" placeholder="例: 0 或 0,1 或 cpu" class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label-row">
              <span class="field-label">批次大小</span>
              <el-tooltip effect="dark" placement="top" :content="batchSizeHint">
                <i class="el-icon-question hint-icon"></i>
              </el-tooltip>
            </div>
            <el-input v-model="batchSize" size="small" placeholder="16" class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label">优化器</div>
            <el-select v-model="optimizer" size="small" placeholder="Select">
              <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></el-option>
            </el-select>
          </div>
          <div class="field-row wide">
            <div class="field-label-row">
              <span class="field-label">配置文件路径</span>
              <el-tooltip effect="dark" placement="top" content="PaddleDetection YAML 配置路径，默认来自所选架构。">
                <i class="el-icon-question hint-icon"></i>
              </el-tooltip>
            </div>
            <el-input v-model="configPath" size="small" placeholder="configs/ppyoloe/..." class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label">训练中评估</div>
            <el-switch v-model="evalDuringTrain"></el-switch>
          </div>
          <div class="field-row">
            <div class="field-label">评估间隔(轮)</div>
            <el-input-number
              v-model="evalInterval"
              :min="1"
              :step="1"
              :disabled="!evalDuringTrain"
              size="small"
              controls-position="right"
              class="field-input-number"
            ></el-input-number>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
    <section class="settings-section settings-section--catalog">
      <div class="panel-top">
        <div>
          <div class="settings-section__title">官方模型目录</div>
          <div class="settings-section__subtitle">{{ frameworkDisplayName }} · {{ normalizedEngine }}</div>
        </div>
        <div class="dataset-chip" v-if="selectedProject">
          <span class="label">数据集</span>
          <span class="value">{{ datasetLabel }}</span>
        </div>
      </div>

      <div class="arch-section">
        <div class="section-title">{{ sectionTitle }}</div>
        <div v-if="archLoading" class="arch-state">
          <i class="el-icon-loading"></i>
          <span>加载架构中...</span>
        </div>
        <div v-else-if="archError" class="arch-state error">
          <i class="el-icon-warning"></i>
          <span>{{ archError }}</span>
          <el-button size="mini" type="primary" @click="reloadArchitectures" style="margin-left: 10px">重试</el-button>
        </div>
        <div v-else-if="architectureGroups.length" class="arch-tabbed">
          <div class="family-tabs">
            <button
              v-for="group in architectureGroups"
              :key="group.family"
              type="button"
              :class="['family-tab', { active: selectedFamily === group.family }]"
              @click="onSelectFamily(group.family)"
            >
              {{ group.family }}
              <span class="tab-count">{{ group.items.length }}</span>
            </button>
          </div>
          <div class="variant-chips">
            <button
              v-for="arch in selectedFamilyItems"
              :key="arch.arch_id || arch.model_variant"
              type="button"
              :class="['arch-chip', { active: selectedModel === arch.model_variant }]"
              @click="onSelectArchitecture(arch)"
            >
              {{ formatVariantShort(arch.model_variant) }}
            </button>
          </div>
        </div>
        <div v-else class="arch-state">
          <i class="el-icon-info"></i>
          <span>暂无可用架构</span>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">准确率</div>
          <div class="metric-value">{{ accuracyLabel }}%</div>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: accuracyWidth + '%' }"></div>
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">速度(ms)</div>
          <div class="metric-value">{{ speedLabel }}ms</div>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: speedWidth + '%' }"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">高级设置</div>
          <div class="settings-section__subtitle">默认显示训练轮次、图像尺寸和批次大小，其余配置可按需展开。</div>
        </div>
        <button class="section-action" type="button" @click="toggleAdvancedSettings">
          <span>{{ advancedSettingsExpanded ? "收起" : "展开更多" }}</span>
          <span class="section-chevron" :class="{ open: advancedSettingsExpanded }"></span>
        </button>
      </div>

      <div class="advanced-grid-preview">
        <div class="field-row">
          <div class="field-label">训练轮次</div>
          <el-input v-model="epochs" size="small" placeholder="100" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">图像尺寸</div>
          <el-input v-model="imgSize" size="small" placeholder="640" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label-row">
            <span class="field-label">批次大小</span>
            <el-tooltip effect="dark" placement="top" :content="batchSizeHint">
              <i class="el-icon-question hint-icon"></i>
            </el-tooltip>
          </div>
          <el-input v-model="batchSize" size="small" placeholder="16" class="field-input"></el-input>
        </div>
      </div>

      <div v-show="advancedSettingsExpanded" class="advanced-grid-extra">
        <div class="field-row">
          <div class="field-label">预训练权重</div>
          <el-switch v-model="pretrainedEnabled"></el-switch>
        </div>
        <div class="field-row" v-if="pretrainedEnabled">
          <div class="field-label">上传预训练权重</div>
          <div class="upload-compact">
            <el-upload
              ref="pretrainUploader"
              action="#"
              :auto-upload="false"
              :on-change="handlePretrainFileChange"
              :show-file-list="false"
              :disabled="uploadingPretrain"
              accept=".pt,.pth,.ckpt,.pdparams"
              class="upload-hidden"
            >
              <el-button size="small" type="primary" :loading="uploadingPretrain" class="browse-btn">
                <i class="el-icon-folder-opened" v-if="!uploadingPretrain"></i>
                {{ uploadingPretrain ? "上传中..." : "选择文件" }}
              </el-button>
            </el-upload>
            <span v-if="pretrainedFileName" class="file-name" :title="pretrainedFileName">
              <i class="el-icon-document"></i>
              {{ pretrainedFileName }}
              <i class="el-icon-close remove-icon" @click="removePretrainFile"></i>
            </span>
            <span v-else class="file-hint">.pt / .pth / .ckpt / .pdparams</span>
          </div>
          <div v-if="pretrainUploadError" class="upload-error">{{ pretrainUploadError }}</div>
        </div>
        <div class="field-row">
          <div class="field-label">保存周期 (每隔X轮保存一次 【-1禁用】)</div>
          <el-input v-model="savePeriod" size="small" placeholder="-1" class="field-input">
            <template slot="append">Epochs</template>
          </el-input>
        </div>
        <div class="field-row" v-if="isUltralyticsEngine">
          <div class="field-label">耐心值</div>
          <el-input v-model="patience" size="small" placeholder="100" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">学习率</div>
          <el-input v-model="learningRate" size="small" placeholder="0.01" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label-row">
            <span class="field-label">设备</span>
            <el-tooltip effect="dark" placement="top" content="默认使用单卡 GPU 0。多卡请用逗号分隔（如 0,1）。如需仅使用 CPU，请输入 cpu。">
              <i class="el-icon-question hint-icon"></i>
            </el-tooltip>
          </div>
          <el-input v-model="selectedDevice" size="small" placeholder="例: 0 或 0,1 或 cpu" class="field-input"></el-input>
        </div>
        <div class="field-row">
          <div class="field-label">优化器</div>
          <el-select v-model="optimizer" size="small" placeholder="Select">
            <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></el-option>
          </el-select>
        </div>
        <template v-if="isPaddleEngine">
          <div class="field-row wide">
            <div class="field-label-row">
              <span class="field-label">配置文件路径</span>
              <el-tooltip effect="dark" placement="top" content="PaddleDetection YAML 配置路径，默认来自所选架构。">
                <i class="el-icon-question hint-icon"></i>
              </el-tooltip>
            </div>
            <el-input v-model="configPath" size="small" placeholder="configs/ppyoloe/..." class="field-input"></el-input>
          </div>
          <div class="field-row">
            <div class="field-label">训练中评估</div>
            <el-switch v-model="evalDuringTrain"></el-switch>
          </div>
          <div class="field-row">
            <div class="field-label">评估间隔(轮)</div>
            <el-input-number
              v-model="evalInterval"
              :min="1"
              :step="1"
              :disabled="!evalDuringTrain"
              size="small"
              controls-position="right"
              class="field-input-number"
            ></el-input-number>
          </div>
        </template>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">数据增强设置</div>
          <div class="settings-section__subtitle">
            默认显示色彩空间增强、几何变换增强和组合增强 3 个子模块，点击子模块可查看详细参数。
          </div>
        </div>
        <div v-if="isUltralyticsEngine && groupedAugmentationOptions.length > 0" class="settings-switch">
          <span>启用自定义数据增强</span>
          <el-switch v-model="augmentationEnabled"></el-switch>
        </div>
      </div>

      <div v-if="!isUltralyticsEngine" class="augmentation-state">
        <i class="el-icon-info"></i>
        <span>当前框架暂不支持训练时数据增强配置</span>
      </div>
      <div v-else-if="archLoading || augmentationLoadingForCurrentArchitecture" class="augmentation-state">
        <i class="el-icon-loading"></i>
        <span>正在加载数据增强配置...</span>
      </div>
      <div v-else-if="augmentationError" class="augmentation-state error">
        <i class="el-icon-warning"></i>
        <span>{{ augmentationError }}，可继续创建任务但不会提交增强参数。</span>
      </div>
      <div v-else-if="!selectedArchitectureId" class="augmentation-state">
        <i class="el-icon-info"></i>
        <span>请先选择模型架构后查看数据增强设置</span>
      </div>
      <div v-else-if="!augmentationResolvedForCurrentArchitecture" class="augmentation-state">
        <i class="el-icon-loading"></i>
        <span>正在加载数据增强配置...</span>
      </div>
      <div v-else-if="!groupedAugmentationOptions.length" class="augmentation-state">
        <i class="el-icon-info"></i>
        <span>当前训练框架暂不支持训练时数据增强配置</span>
      </div>
      <div v-else class="augmentation-groups">
        <section
          v-for="group in primaryAugmentationGroups"
          :key="group.key"
          class="augmentation-group"
        >
          <button class="augmentation-group__toggle" type="button" @click="toggleAugmentationGroup(group.key)">
            <span class="augmentation-group__title">{{ group.label }}</span>
            <span class="augmentation-group__actions">
              <span class="group-count">{{ group.items.length }} 项</span>
              <span class="section-chevron" :class="{ open: isAugmentationGroupExpanded(group.key) }"></span>
            </span>
          </button>
          <div v-show="isAugmentationGroupExpanded(group.key)" class="augmentation-group__body">
            <div class="augmentation-group__grid">
              <article
                v-for="field in group.items"
                :key="field.key"
                class="augmentation-item"
              >
                <div class="augmentation-item__top">
                  <div>
                    <div class="augmentation-item__label">{{ field.label || field.key }}</div>
                    <div class="augmentation-item__meta">
                      <span>参数名：{{ field.key }}</span>
                      <span>默认值：{{ formatFieldValue(field.default) }}</span>
                      <span v-if="field.value_type === 'enum'">
                        {{ formatAugmentationOptionsText(field) }}
                      </span>
                      <span v-else>
                        {{ formatFieldRange(field) }}
                      </span>
                    </div>
                  </div>
                  <el-button
                    type="text"
                    size="mini"
                    :disabled="!isAugmentationFieldTouched(field.key)"
                    @click="resetAugmentationField(field)"
                  >
                    恢复默认
                  </el-button>
                </div>
                <div v-if="field.description" class="augmentation-item__desc">
                  {{ field.description }}
                </div>
                <div class="augmentation-item__control">
                  <el-select
                    v-if="field.value_type === 'enum'"
                    :value="getAugmentationFieldValue(field)"
                    :disabled="!augmentationEnabled || augmentationLoading"
                    :clearable="!!field.nullable"
                    size="small"
                    class="augmentation-select"
                    placeholder="请选择"
                    @input="onAugmentationChanged(field, $event)"
                  >
                    <el-option
                      v-for="option in normalizeAugmentationOptions(field.options)"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    ></el-option>
                  </el-select>
                  <div v-else class="augmentation-number-control">
                    <el-slider
                      :value="getAugmentationNumericValue(field)"
                      :min="getAugmentationFieldMin(field)"
                      :max="getAugmentationFieldMax(field)"
                      :step="getAugmentationFieldStep(field)"
                      :disabled="!augmentationEnabled || augmentationLoading"
                      @input="onAugmentationChanged(field, $event)"
                    ></el-slider>
                    <el-input-number
                      :value="getAugmentationNumericValue(field)"
                      :min="getAugmentationFieldMin(field)"
                      :max="getAugmentationFieldMax(field)"
                      :step="getAugmentationFieldStep(field)"
                      :precision="getAugmentationFieldPrecision(field)"
                      :step-strictly="field.value_type === 'integer'"
                      :disabled="!augmentationEnabled || augmentationLoading"
                      size="small"
                      class="augmentation-input"
                      @change="onAugmentationChanged(field, $event)"
                    ></el-input-number>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <div v-if="extraAugmentationGroups.length" class="augmentation-extra">
          <button class="section-action section-action--full" type="button" @click="toggleExtraAugmentationGroups">
            <span>{{ extraAugmentationGroupsExpanded ? "收起更多增强设置" : "展开更多增强设置" }}</span>
            <span class="section-chevron" :class="{ open: extraAugmentationGroupsExpanded }"></span>
          </button>
          <div v-show="extraAugmentationGroupsExpanded" class="augmentation-extra__body">
            <section
              v-for="group in extraAugmentationGroups"
              :key="group.key"
              class="augmentation-group"
            >
              <button class="augmentation-group__toggle" type="button" @click="toggleAugmentationGroup(group.key)">
                <span class="augmentation-group__title">{{ group.label }}</span>
                <span class="augmentation-group__actions">
                  <span class="group-count">{{ group.items.length }} 项</span>
                  <span class="section-chevron" :class="{ open: isAugmentationGroupExpanded(group.key) }"></span>
                </span>
              </button>
              <div v-show="isAugmentationGroupExpanded(group.key)" class="augmentation-group__body">
                <div class="augmentation-group__grid">
                  <article
                    v-for="field in group.items"
                    :key="field.key"
                    class="augmentation-item"
                  >
                    <div class="augmentation-item__top">
                      <div>
                        <div class="augmentation-item__label">{{ field.label || field.key }}</div>
                        <div class="augmentation-item__meta">
                          <span>参数名：{{ field.key }}</span>
                          <span>默认值：{{ formatFieldValue(field.default) }}</span>
                          <span v-if="field.value_type === 'enum'">
                            {{ formatAugmentationOptionsText(field) }}
                          </span>
                          <span v-else>
                            {{ formatFieldRange(field) }}
                          </span>
                        </div>
                      </div>
                      <el-button
                        type="text"
                        size="mini"
                        :disabled="!isAugmentationFieldTouched(field.key)"
                        @click="resetAugmentationField(field)"
                      >
                        恢复默认
                      </el-button>
                    </div>
                    <div v-if="field.description" class="augmentation-item__desc">
                      {{ field.description }}
                    </div>
                    <div class="augmentation-item__control">
                      <el-select
                        v-if="field.value_type === 'enum'"
                        :value="getAugmentationFieldValue(field)"
                        :disabled="!augmentationEnabled || augmentationLoading"
                        :clearable="!!field.nullable"
                        size="small"
                        class="augmentation-select"
                        placeholder="请选择"
                        @input="onAugmentationChanged(field, $event)"
                      >
                        <el-option
                          v-for="option in normalizeAugmentationOptions(field.options)"
                          :key="option.value"
                          :label="option.label"
                          :value="option.value"
                        ></el-option>
                      </el-select>
                      <div v-else class="augmentation-number-control">
                        <el-slider
                          :value="getAugmentationNumericValue(field)"
                          :min="getAugmentationFieldMin(field)"
                          :max="getAugmentationFieldMax(field)"
                          :step="getAugmentationFieldStep(field)"
                          :disabled="!augmentationEnabled || augmentationLoading"
                          @input="onAugmentationChanged(field, $event)"
                        ></el-slider>
                        <el-input-number
                          :value="getAugmentationNumericValue(field)"
                          :min="getAugmentationFieldMin(field)"
                          :max="getAugmentationFieldMax(field)"
                          :step="getAugmentationFieldStep(field)"
                          :precision="getAugmentationFieldPrecision(field)"
                          :step-strictly="field.value_type === 'integer'"
                          :disabled="!augmentationEnabled || augmentationLoading"
                          size="small"
                          class="augmentation-input"
                          @change="onAugmentationChanged(field, $event)"
                        ></el-input-number>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <div class="settings-section__header">
        <div>
          <div class="settings-section__title">损失权重设置</div>
          <div class="settings-section__subtitle">默认直接显示 3 个可配置的 YOLO Loss 权重选项。</div>
        </div>
        <div v-if="isUltralyticsEngine && visibleLossWeightOptions.length > 0" class="settings-switch">
          <span>启用自定义 Loss 权重</span>
          <el-switch v-model="lossWeightsEnabled"></el-switch>
        </div>
      </div>

      <div v-if="!isUltralyticsEngine" class="loss-weight-state">
        <i class="el-icon-info"></i>
        <span>当前框架暂不支持 YOLO Loss 权重配置</span>
      </div>
      <div v-else-if="archLoading || lossWeightLoadingForCurrentArchitecture" class="loss-weight-state">
        <i class="el-icon-loading"></i>
        <span>正在加载 Loss 权重配置...</span>
      </div>
      <div v-else-if="lossWeightError" class="loss-weight-state error">
        <i class="el-icon-warning"></i>
        <span>{{ lossWeightError }}，可继续创建任务但不会提交 Loss 权重。</span>
      </div>
      <div v-else-if="!selectedArchitectureId" class="loss-weight-state">
        <i class="el-icon-info"></i>
        <span>请先选择模型架构后查看 YOLO Loss 权重设置</span>
      </div>
      <div v-else-if="!lossWeightResolvedForCurrentArchitecture" class="loss-weight-state">
        <i class="el-icon-loading"></i>
        <span>正在加载 Loss 权重配置...</span>
      </div>
      <div v-else-if="!visibleLossWeightOptions.length" class="loss-weight-state">
        <i class="el-icon-info"></i>
        <span>当前训练框架暂不支持 YOLO Loss 权重配置</span>
      </div>
      <div v-else class="loss-weight-grid">
        <article
          v-for="field in visibleLossWeightOptions"
          :key="field.key"
          class="loss-weight-item"
        >
          <div class="loss-weight-item__top">
            <div>
              <div class="loss-weight-item__label">{{ getLossWeightLabel(field) }}</div>
              <div class="loss-weight-item__meta">
                <span>参数名：{{ field.key }}</span>
                <span>默认值：{{ formatFieldValue(field.default) }}</span>
                <span>{{ formatFieldRange(field) }}</span>
              </div>
            </div>
            <el-button
              type="text"
              size="mini"
              :disabled="!isLossWeightFieldTouched(field.key)"
              @click="resetLossWeightField(field)"
            >
              恢复默认
            </el-button>
          </div>
          <div class="loss-weight-item__desc">
            {{ getLossWeightDescription(field) }}
          </div>
          <div class="loss-weight-item__control">
            <el-input-number
              :value="getLossWeightFieldValue(field)"
              :min="getFieldMin(field)"
              :step="getFieldStep(field, 0.1)"
              :precision="getFieldPrecision(field, 0.1)"
              :disabled="!lossWeightsEnabled || lossWeightLoading"
              size="small"
              class="loss-weight-input"
              @change="onLossWeightChanged(field, $event)"
            ></el-input-number>
          </div>
        </article>
      </div>
    </section>
    </template>
  </div>
</template>

<script>
import { referenceStore, loadArchitectures } from "@/store/referenceStore";
import {
  fetchTrainingAugmentationOptions,
  fetchTrainingLossWeightOptions,
  uploadPretrainedWeights,
} from "@/api/training";

const AUGMENTATION_GROUP_ORDER = [
  "color",
  "geometry",
  "mix",
  "segmentation",
  "classification",
];

const PRIMARY_AUGMENTATION_GROUP_KEYS = ["color", "geometry", "mix"];

const AUGMENTATION_GROUP_LABELS = {
  color: "色彩空间增强",
  geometry: "几何变换增强",
  mix: "组合增强",
  segmentation: "分割增强",
  classification: "分类增强",
};

const LOSS_WEIGHT_LABELS = {
  box: "边界框损失权重",
  cls: "分类损失权重",
  dfl: "DFL 损失权重",
};

const LOSS_WEIGHT_HINTS = {
  box: "控制框回归损失占比",
  cls: "控制分类损失占比",
  dfl: "控制分布焦点损失占比",
};

export default {
  name: "OfficialPanel",
  props: {
    selectedProject: {
      type: Object,
      default: null
    },
    taskType: {
      type: String,
      default: 'detection'
    },
    engine: {
      type: String,
      default: "ultralytics-yolo"
    }
  },
  data() {
    return {
      ref: referenceStore,
      selectedModel: null,
      selectedArchitectureId: null,
      selectedFamily: null,
      advancedSettingsExpanded: false,
      epochs: "100",
      imgSize: "640",
      patience: "100",
      learningRate: "0.01",
      selectedDevice: "0",
      batchSize: "16",
      options: [
        { value: "Auto", label: "Auto" },
        { value: "Adam", label: "Adam" },
        { value: "AdamW", label: "AdamW" },
        { value: "SGD", label: "SGD" }
      ],
      optimizer: "Auto",
      pretrainedEnabled: true,
      pretrainedFileName: "",
      pretrainedPath: "",
      uploadingPretrain: false,
      pretrainUploadError: "",
      modelMetrics: {
        // YOLO26 series (benchmark mAP@50-95 / T4 TensorRT10 FP16 ms)
        YOLO26n: { accuracy: 40.5, speedMs: 1.7 },
        YOLO26s: { accuracy: 48.0, speedMs: 2.9 },
        YOLO26m: { accuracy: 52.5, speedMs: 4.7 },
        YOLO26l: { accuracy: 54.6, speedMs: 7.0 },
        YOLO26x: { accuracy: 56.9, speedMs: 11.8 },
        // YOLO12 series (benchmark mAP@50-95 / T4 TensorRT10 FP16 ms)
        YOLO12n: { accuracy: 40.6, speedMs: 1.6 },
        YOLO12s: { accuracy: 48.0, speedMs: 2.6 },
        YOLO12m: { accuracy: 52.5, speedMs: 4.9 },
        YOLO12l: { accuracy: 53.7, speedMs: 6.8 },
        YOLO12x: { accuracy: 55.2, speedMs: 11.2 },
        // YOLO11 series (benchmark mAP@50-95 / T4 TensorRT10 FP16 ms)
        YOLO11n: { accuracy: 39.5, speedMs: 1.5 },
        YOLO11s: { accuracy: 47.0, speedMs: 2.5 },
        YOLO11m: { accuracy: 51.5, speedMs: 4.7 },
        YOLO11l: { accuracy: 53.4, speedMs: 6.2 },
        YOLO11x: { accuracy: 54.7, speedMs: 11.3 },
        // YOLOv10 series (benchmark mAP@50-95 / T4 TensorRT FP16 ms)
        YOLOv10n: { accuracy: 38.5, speedMs: 1.8 },
        YOLOv10s: { accuracy: 46.3, speedMs: 2.5 },
        YOLOv10m: { accuracy: 51.1, speedMs: 4.7 },
        YOLOv10l: { accuracy: 53.2, speedMs: 7.3 },
        YOLOv10x: { accuracy: 54.4, speedMs: 10.7 },
        YOLOv10b: { accuracy: 52.5, speedMs: 5.7 },
        // YOLOv9 series (benchmark mAP@50-95 / T4 TensorRT FP16 ms)
        YOLOv9s: { accuracy: 46.8, speedMs: 3.5 },
        YOLOv9m: { accuracy: 51.4, speedMs: 6.4 },
        YOLOv9c: { accuracy: 53.0, speedMs: 7.2 },
        YOLOv9e: { accuracy: 55.6, speedMs: 15.8 },
        YOLOv9t: { accuracy: 38.3, speedMs: 2.3 },
        // YOLOv8 series (benchmark mAP@50-95 / T4 TensorRT FP16 ms)
        YOLOv8n: { accuracy: 37.3, speedMs: 7.2 },
        YOLOv8s: { accuracy: 44.9, speedMs: 10.8 },
        YOLOv8m: { accuracy: 50.2, speedMs: 15.9 },
        YOLOv8l: { accuracy: 52.9, speedMs: 22.5 },
        YOLOv8x: { accuracy: 53.9, speedMs: 29.8 },
        // RT-DETR series (benchmark mAP@50-95 / T4 TensorRT FP16 ms)
        "RT-DETR-l": { accuracy: 53.0, speedMs: 8.7 },
        "RT-DETR-x": { accuracy: 54.8, speedMs: 13.5 },
        // YOLOv8-seg series
        "YOLOv8n-seg": { accuracy: 30.5, speedMs: 8.1 },
        "YOLOv8s-seg": { accuracy: 36.8, speedMs: 12.3 },
        "YOLOv8m-seg": { accuracy: 40.2, speedMs: 20.4 },
        "YOLOv8l-seg": { accuracy: 42.1, speedMs: 35.6 },
        "YOLOv8x-seg": { accuracy: 43.4, speedMs: 48.2 },
        // PaddleDetection PP-YOLOE+ series (benchmark mAP / T4 FP16 ms)
        "PP-YOLOE_s": { accuracy: 43.1, speedMs: 8.5 },
        "PP-YOLOE_m": { accuracy: 48.9, speedMs: 14.2 },
        "PP-YOLOE_l": { accuracy: 51.4, speedMs: 20.8 },
        "PP-YOLOE_x": { accuracy: 53.3, speedMs: 32.1 },
        // PaddleDetection PicoDet series
        "PicoDet_s": { accuracy: 29.1, speedMs: 3.5 },
        "PicoDet_l": { accuracy: 36.6, speedMs: 6.8 },
      },
      savePeriod: "-1",
      augmentationEnabled: false,
      augmentationOptions: [],
      augmentationValues: {},
      augmentationTouched: {},
      augmentationLoading: false,
      augmentationError: "",
      augmentationLastRequestedArchitectureId: "",
      augmentationLastResolvedArchitectureId: "",
      augmentationExpandedGroups: {},
      extraAugmentationGroupsExpanded: false,
      lossWeightsEnabled: false,
      lossWeightOptions: [],
      lossWeightValues: {},
      lossWeightTouched: {},
      lossWeightLoading: false,
      lossWeightError: "",
      lossWeightLastRequestedArchitectureId: "",
      lossWeightLastResolvedArchitectureId: "",
      configPath: "",
      evalDuringTrain: true,
      evalInterval: 1,
    };
  },
  computed: {
    normalizedEngine() {
      return String(this.engine || "ultralytics-yolo").trim().toLowerCase();
    },
    isUltralyticsEngine() {
      return this.normalizedEngine === "ultralytics-yolo";
    },
    isPaddleEngine() {
      return this.normalizedEngine === "paddle-det";
    },
    frameworkDisplayName() {
      if (this.isPaddleEngine) return "PaddleDetection";
      if (this.isUltralyticsEngine) return "Ultralytics YOLO";
      return this.normalizedEngine || "Unknown Engine";
    },
    batchSizeHint() {
      if (this.isUltralyticsEngine) {
        return "设置为 -1 可开启批次大小自适应（仅单卡 Ultralytics 训练支持）";
      }
      return "PaddleDetection 需要固定正整数 batch size。";
    },
    datasetLabel() {
      return this.selectedProject?.dataset?.dataset_name || "No standard dataset linked";
    },
    sectionTitle() {
      return this.taskType === 'segmentation' ? '分割架构' : '检测架构';
    },
    archLoading() {
      return !!this.ref?.loading?.architectures;
    },
    archError() {
      return this.ref?.error?.architectures || "";
    },
    normalizedSelectedArchitectureId() {
      return this.normalizeArchitectureId(this.selectedArchitectureId);
    },
    architectureGroups() {
      const list = Array.isArray(this.ref?.architectures) ? this.ref.architectures : [];

      const currentEngineArchitectures = list.filter((it) => {
        const engine = String(it?.engine || "ultralytics-yolo").trim().toLowerCase();
        return engine === this.normalizedEngine;
      });

      const detected = currentEngineArchitectures.filter((it) => {
        const tt = String(it?.task_type || "").toLowerCase();
        // Backend usually returns 'detection' or 'segmentation'
        // If empty, assume detection for BC
        const target = this.taskType === 'segmentation' ? 'segmentation' : 'detection';
        return tt === target || (!tt && target === 'detection');
      });
      const map = {};
      detected.forEach((it) => {
        const fam = it.model_family || it.family || "Uncategorized";
        (map[fam] = map[fam] || []).push(it);
      });

      const sizeOrder = { t: 0, n: 1, s: 2, m: 3, b: 4, l: 5, x: 6, c: 7, e: 8 };
      const sizeRank = (variant = "") => {
        const base = String(variant || "").toLowerCase().replace(/-(cls|seg)$/i, "");
        const rtDetr = base.match(/^rtdetr-([a-z0-9]+)$/);
        if (rtDetr && rtDetr[1] in sizeOrder) return sizeOrder[rtDetr[1]];
        const letter = base.slice(-1).toLowerCase();
        return letter in sizeOrder ? sizeOrder[letter] : 999;
      };

      // Version-based family order
      const yoloFamilyOrder = ['YOLOv8', 'YOLOv9', 'YOLOv10', 'YOLO11', 'YOLO12', 'YOLO26', 'RT-DETR'];
      const paddleFamilyOrder = ['PP-YOLOE', 'PicoDet'];
      const familyOrder = this.isPaddleEngine ? paddleFamilyOrder : yoloFamilyOrder;
      const familyRank = (name) => {
        const idx = familyOrder.indexOf(name);
        return idx >= 0 ? idx : 999;
      };

      return Object.entries(map)
        .sort((a, b) => {
          if (a[0] === "Uncategorized") return 1;
          if (b[0] === "Uncategorized") return -1;
          const ra = familyRank(a[0]);
          const rb = familyRank(b[0]);
          if (ra !== rb) return ra - rb;
          return String(a[0]).localeCompare(String(b[0]), "en");
        })
        .map(([family, arr]) => ({
          family,
          items: arr.slice().sort((a, b) => {
            const sa = sizeRank(a.model_variant);
            const sb = sizeRank(b.model_variant);
            if (sa !== sb) return sa - sb;
            return String(a.model_variant || "").localeCompare(String(b.model_variant || ""), "en");
          })
        }));
    },
    selectedFamilyItems() {
      if (!this.selectedFamily) return [];
      const group = this.architectureGroups.find(g => g.family === this.selectedFamily);
      return group ? group.items : [];
    },
    groupedAugmentationOptions() {
      const filtered = this.filterFieldsByTask(this.augmentationOptions);

      const groupMap = new Map();
      filtered.forEach((field) => {
        const key = String(field?.group || "other").trim() || "other";
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(field);
      });

      return Array.from(groupMap.entries())
        .sort((a, b) => {
          const left = AUGMENTATION_GROUP_ORDER.indexOf(a[0]);
          const right = AUGMENTATION_GROUP_ORDER.indexOf(b[0]);
          const leftRank = left >= 0 ? left : Number.MAX_SAFE_INTEGER;
          const rightRank = right >= 0 ? right : Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) return leftRank - rightRank;
          return String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN");
        })
        .map(([key, items]) => ({
          key,
          label: AUGMENTATION_GROUP_LABELS[key] || key,
          items,
        }));
    },
    primaryAugmentationGroups() {
      return PRIMARY_AUGMENTATION_GROUP_KEYS
        .map((key) => this.groupedAugmentationOptions.find((group) => group.key === key))
        .filter(Boolean);
    },
    extraAugmentationGroups() {
      return this.groupedAugmentationOptions.filter(
        (group) => !PRIMARY_AUGMENTATION_GROUP_KEYS.includes(group.key)
      );
    },
    augmentationLoadingForCurrentArchitecture() {
      return (
        this.augmentationLoading &&
        this.augmentationLastRequestedArchitectureId === this.normalizedSelectedArchitectureId
      );
    },
    augmentationResolvedForCurrentArchitecture() {
      return (
        !!this.normalizedSelectedArchitectureId &&
        this.augmentationLastResolvedArchitectureId === this.normalizedSelectedArchitectureId
      );
    },
    visibleLossWeightOptions() {
      return this.filterFieldsByTask(this.lossWeightOptions);
    },
    lossWeightLoadingForCurrentArchitecture() {
      return (
        this.lossWeightLoading &&
        this.lossWeightLastRequestedArchitectureId === this.normalizedSelectedArchitectureId
      );
    },
    lossWeightResolvedForCurrentArchitecture() {
      return (
        !!this.normalizedSelectedArchitectureId &&
        this.lossWeightLastResolvedArchitectureId === this.normalizedSelectedArchitectureId
      );
    },
    metrics() {
      const def = { accuracy: 37.3, speedMs: 80.4 };
      if (!this.selectedModel) return def;
      const key = this.formatVariantKey(this.selectedModel);
      return this.modelMetrics[key] || def;
    },
    currentSeriesKey() {
      const m = this.formatVariantKey(this.selectedModel);
      const prefixes = ["PP-YOLOE", "PicoDet", "YOLO26", "YOLO12", "YOLO11", "YOLOv10", "YOLOv9", "YOLOv8", "RT-DETR"];
      for (const prefix of prefixes) {
        if (m.startsWith(prefix)) return prefix;
      }
      return null;
    },
    seriesModelEntries() {
      const all = Object.entries(this.modelMetrics || {});
      if (!this.currentSeriesKey) return all;
      return all.filter(([name]) => name.startsWith(this.currentSeriesKey));
    },
    seriesMetricsList() {
      return this.seriesModelEntries.map(([, v]) => v);
    },
    seriesTopAccuracy() {
      const list = this.seriesMetricsList;
      if (!list.length) return 100;
      return list.reduce((m, it) => Math.max(m, Number(it.accuracy) || 0), 0) || 100;
    },
    seriesMinAccuracy() {
      const vals = this.seriesMetricsList
        .map(m => Number(m.accuracy))
        .filter(v => Number.isFinite(v));
      if (!vals.length) return Number(this.metrics.accuracy) || 0;
      return Math.min(...vals);
    },
    seriesMinSpeedMs() {
      const vals = this.seriesMetricsList
        .map(m => Number(m.speedMs))
        .filter(v => Number.isFinite(v));
      if (!vals.length) return Number(this.metrics.speedMs) || 0;
      return Math.min(...vals);
    },
    seriesMaxSpeedMs() {
      const vals = this.seriesMetricsList
        .map(m => Number(m.speedMs))
        .filter(v => Number.isFinite(v));
      if (!vals.length) return Number(this.metrics.speedMs) || 0;
      return Math.max(...vals);
    },
    accuracyLabel() {
      return Number(this.metrics.accuracy).toFixed(1);
    },
    speedLabel() {
      return Number(this.metrics.speedMs).toFixed(1);
    },
    accuracyWidth() {
      const acc = Number(this.metrics.accuracy) || 0;
      const minAcc = Number(this.seriesMinAccuracy);
      const maxAcc = Number(this.seriesTopAccuracy) || 100;
      const range = maxAcc - minAcc;
      if (range <= 0) return 50;
      const normalized = (acc - minAcc) / range;
      const visMin = 15;
      const visMax = 90;
      const pct = visMin + normalized * (visMax - visMin);
      return Math.max(0, Math.min(100, pct));
    },
    speedWidth() {
      const ms = Number(this.metrics.speedMs) || 0;
      const minMs = Number(this.seriesMinSpeedMs);
      const maxMs = Number(this.seriesMaxSpeedMs);
      const range = maxMs - minMs;
      if (range <= 0) return 50;
      const normalized = (maxMs - ms) / range;
      const visMin = 15;
      const visMax = 90;
      const pct = visMin + normalized * (visMax - visMin);
      return Math.max(0, Math.min(100, pct));
    }
  },
  watch: {
    "ref.architectures": {
      handler() {
        this.initializeDefaultArchitecture();
      },
      immediate: true
    },
    taskType(newType) {
      if (newType) {
        this.advancedSettingsExpanded = false;
        this.resetArchitectureSelection();
        this.resetAugmentationState();
        this.resetLossWeightState();
        this.initializeDefaultArchitecture();
      }
    },
    engine() {
      this.advancedSettingsExpanded = false;
      this.resetArchitectureSelection();
      this.resetAugmentationState();
      this.resetLossWeightState();
      this.configPath = "";
      this.evalDuringTrain = true;
      this.evalInterval = 1;
      this.initializeDefaultArchitecture();
      this.emitConfigChange();
    },
    epochs() {
      this.emitConfigChange();
    },
    imgSize() {
      this.emitConfigChange();
    },
    patience() {
      this.emitConfigChange();
    },
    learningRate() {
      this.emitConfigChange();
    },
    batchSize() {
      this.emitConfigChange();
    },
    selectedDevice() {
      this.emitConfigChange();
    },
    optimizer() {
      this.emitConfigChange();
    },
    pretrainedEnabled() {
      if (!this.pretrainedEnabled) {
        this.pretrainedFileName = "";
        this.pretrainedPath = "";
        this.pretrainUploadError = "";
      }
      this.emitConfigChange();
    },
    savePeriod() {
        this.emitConfigChange();
    },
    augmentationEnabled() {
      this.emitConfigChange();
    },
    lossWeightsEnabled() {
      this.emitConfigChange();
    },
    configPath() {
      this.emitConfigChange();
    },
    evalDuringTrain() {
      this.emitConfigChange();
    },
    evalInterval() {
      this.emitConfigChange();
    }
  },
  methods: {
    reloadArchitectures() {
      loadArchitectures({ force: true });
    },
    normalizeArchitectureId(value) {
      return String(value ?? "").trim();
    },
    getArchitectureId(arch) {
      if (!arch || typeof arch !== "object") return null;
      return arch.arch_id ?? arch.architecture_id ?? arch.id ?? null;
    },
    isCurrentArchitecture(architectureId) {
      return this.normalizeArchitectureId(architectureId) === this.normalizedSelectedArchitectureId;
    },
    resetArchitectureSelection() {
      this.selectedModel = null;
      this.selectedArchitectureId = null;
      this.selectedFamily = null;
    },
    async handlePretrainFileChange(file) {
      const raw = file && (file.raw || file);
      if (!raw) return;
      this.pretrainUploadError = "";
      this.uploadingPretrain = true;
      try {
        const res = await uploadPretrainedWeights(raw);
        this.pretrainedFileName = res?.filename || raw.name || "";
        this.pretrainedPath = res?.token || res?.path || "";
        this.emitConfigChange();
      } catch (err) {
        const msg = err?.message || "无法上传预训练权重";
        this.pretrainUploadError = msg;
        this.pretrainedFileName = "";
        this.pretrainedPath = "";
        this.emitConfigChange();
      } finally {
        this.uploadingPretrain = false;
      }
    },
    removePretrainFile() {
      this.pretrainedFileName = "";
      this.pretrainedPath = "";
      this.pretrainUploadError = "";
      this.emitConfigChange();
    },
    emitModelSelected() {
      if (!this.selectedModel) return;
      const architecture = this.findArchitectureByVariant(this.selectedModel);
      this.$emit("model-selected", {
        model: this.selectedModel,
        architecture_id: this.selectedArchitectureId || null,
        engine: this.normalizedEngine,
        architecture
      });
    },
    findArchitectureByVariant(variant) {
      const target = String(variant || "").trim().toLowerCase();
      if (!target) return null;
      for (const group of this.architectureGroups) {
        const found = (group.items || []).find(
          (item) => String(item?.model_variant || "").trim().toLowerCase() === target
        );
        if (found) return found;
      }
      return null;
    },
    initializeDefaultArchitecture() {
      if (this.archLoading) return;
      if (!this.architectureGroups.length) {
        this.resetArchitectureSelection();
        this.resetAugmentationState();
        this.resetLossWeightState();
        return;
      }
      if (this.selectedModel) {
        const matched = this.findArchitectureByVariant(this.selectedModel);
        if (matched) {
          this.selectArchitecture(matched);
          return;
        }
      }
      const first = this.architectureGroups?.[0]?.items?.[0];
      if (first) this.selectArchitecture(first);
    },
    onSelectFamily(family) {
      this.selectedFamily = family;
    },
    onSelectArchitecture(arch) {
      this.selectArchitecture(arch, { forceReload: true });
    },
    selectArchitecture(arch, { forceReload = false } = {}) {
      if (!arch) return;
      const nextFamily = arch?.model_family || arch?.family || this.selectedFamily;
      const nextArchitectureId = this.getArchitectureId(arch);
      const nextModel = arch?.model_variant || null;
      const previousArchitectureId = this.normalizedSelectedArchitectureId;
      const normalizedNextArchitectureId = this.normalizeArchitectureId(nextArchitectureId);
      const architectureChanged = previousArchitectureId !== normalizedNextArchitectureId;
      const modelChanged = this.selectedModel !== nextModel;

      this.selectedFamily = nextFamily;
      this.selectedArchitectureId = nextArchitectureId;
      this.selectedModel = nextModel;
      this.applyArchitectureDefaults(arch);

      if (nextModel && (architectureChanged || modelChanged)) {
        this.emitModelSelected();
      }

      if (!normalizedNextArchitectureId) {
        this.resetAugmentationState();
        this.resetLossWeightState();
        this.emitConfigChange();
        return;
      }

      if (!this.isUltralyticsEngine) {
        this.resetAugmentationState();
        this.resetLossWeightState();
        this.emitConfigChange();
        return;
      }

      const augmentationPendingForCurrentArchitecture =
        this.augmentationLoading &&
        this.augmentationLastRequestedArchitectureId === normalizedNextArchitectureId;
      const lossWeightPendingForCurrentArchitecture =
        this.lossWeightLoading &&
        this.lossWeightLastRequestedArchitectureId === normalizedNextArchitectureId;
      const needsAugmentationLoad =
        (
          forceReload && !augmentationPendingForCurrentArchitecture
        ) ||
        (
          !augmentationPendingForCurrentArchitecture &&
          (
            architectureChanged ||
            this.augmentationLastResolvedArchitectureId !== normalizedNextArchitectureId
          )
        );
      const needsLossWeightLoad =
        (
          forceReload && !lossWeightPendingForCurrentArchitecture
        ) ||
        (
          !lossWeightPendingForCurrentArchitecture &&
          (
            architectureChanged ||
            this.lossWeightLastResolvedArchitectureId !== normalizedNextArchitectureId
          )
        );

      if (needsAugmentationLoad) {
        this.loadAugmentationOptions(nextArchitectureId);
      }
      if (needsLossWeightLoad) {
        this.loadLossWeightOptions(nextArchitectureId);
      }
      if (!needsAugmentationLoad && !needsLossWeightLoad) {
        this.emitConfigChange();
      }
    },
    applyArchitectureDefaults(arch) {
      if (!this.isPaddleEngine) return;
      const defaults = arch?.default_params && typeof arch.default_params === "object"
        ? arch.default_params
        : {};
      this.configPath = defaults.config_path || "";
    },
    formatVariantKey(v) {
      const s = String(v || "").trim();
      if (!s) return "";
      return s
        .replace(/^rtdetr-/i, "RT-DETR-")
        .replace(/^ppyoloe/i, "PP-YOLOE")
        .replace(/^picodet/i, "PicoDet")
        .replace(/^yolov8/i, "YOLOv8")
        .replace(/^yolov9/i, "YOLOv9")
        .replace(/^yolov10/i, "YOLOv10")
        .replace(/^yolo11/i, "YOLO11")
        .replace(/^yolo12/i, "YOLO12")
        .replace(/^yolo26/i, "YOLO26")
        .replace(/^yolo/i, "YOLO");
    },
    formatVariantShort(v) {
      const full = this.formatVariantKey(v);
      const family = this.selectedFamily || '';
      const sizeNames = {
        't': 'Tiny', 'n': 'Nano', 's': 'Small', 'm': 'Medium',
        'b': 'Base', 'l': 'Large', 'x': 'Extra', 'c': 'Compact', 'e': 'Extreme'
      };
      if (full.startsWith(family)) {
        const suffix = full.slice(family.length);
        // e.g. suffix = "n", "s", "m", "l", "x", "-seg", "n-seg"
        const normalizedSuffix = suffix.replace(/^[-_]/, '');
        const baseSuffix = normalizedSuffix.replace(/-(seg|cls)$/i, '');
        const taskSuffix = suffix.includes('-seg') ? ' Seg' : suffix.includes('-cls') ? ' Cls' : '';
        const sizeName = sizeNames[baseSuffix.toLowerCase()];
        if (sizeName) return sizeName + taskSuffix;
        // For RT-DETR variants like "-l", "-x"
        if (baseSuffix.startsWith('-') && sizeNames[baseSuffix.slice(1).toLowerCase()]) {
          return sizeNames[baseSuffix.slice(1).toLowerCase()] + taskSuffix;
        }
        return suffix || full;
      }
      return full;
    },
    formatVariant(v) {
      const k = this.formatVariantKey(v);
      return k;
    },
    filterFieldsByTask(fields) {
      const currentTask = String(this.taskType || "").toLowerCase();
      const items = Array.isArray(fields) ? fields : [];
      return items.filter((field) => {
        if (!Array.isArray(field?.tasks) || !field.tasks.length) return true;
        return field.tasks.map((it) => String(it || "").toLowerCase()).includes(currentTask);
      });
    },
    toggleAdvancedSettings() {
      this.advancedSettingsExpanded = !this.advancedSettingsExpanded;
      if (!this.advancedSettingsExpanded) return;

      this.initializeDefaultArchitecture();
      if (!this.isUltralyticsEngine || !this.normalizedSelectedArchitectureId) return;

      if (
        !this.augmentationLoadingForCurrentArchitecture &&
        this.augmentationLastResolvedArchitectureId !== this.normalizedSelectedArchitectureId
      ) {
        this.loadAugmentationOptions(this.selectedArchitectureId);
      }
      if (
        !this.lossWeightLoadingForCurrentArchitecture &&
        this.lossWeightLastResolvedArchitectureId !== this.normalizedSelectedArchitectureId
      ) {
        this.loadLossWeightOptions(this.selectedArchitectureId);
      }
    },
    toggleAugmentationGroup(groupKey) {
      if (!groupKey) return;
      this.$set(
        this.augmentationExpandedGroups,
        groupKey,
        !this.isAugmentationGroupExpanded(groupKey)
      );
    },
    isAugmentationGroupExpanded(groupKey) {
      if (!groupKey) return false;
      return !!this.augmentationExpandedGroups[groupKey];
    },
    toggleExtraAugmentationGroups() {
      this.extraAugmentationGroupsExpanded = !this.extraAugmentationGroupsExpanded;
    },
    getNumericFieldDefaultValue(field, fallback = 0) {
      if (!field || typeof field !== "object") return fallback;
      const numericDefault = Number(field.default);
      return Number.isFinite(numericDefault) ? numericDefault : fallback;
    },
    buildFieldInitialValues(fields, resolver) {
      const getValue = typeof resolver === "function"
        ? resolver
        : (field) => this.getNumericFieldDefaultValue(field);
      return (Array.isArray(fields) ? fields : []).reduce((acc, field) => {
        acc[field.key] = getValue(field);
        return acc;
      }, {});
    },
    buildTouchedPayload(enabled, touched, values) {
      if (!enabled) return null;

      const out = {};
      Object.keys(touched || {}).forEach((key) => {
        const value = values?.[key];
        if (value === "" || value === null || value === undefined) return;
        out[key] = Number.isFinite(Number(value)) ? Number(value) : value;
      });

      return Object.keys(out).length ? out : null;
    },
    getNumericFieldValue(field, values, resolver) {
      if (!field) return undefined;
      if (Object.prototype.hasOwnProperty.call(values || {}, field.key)) {
        return values[field.key];
      }
      const getValue = typeof resolver === "function"
        ? resolver
        : (it) => this.getNumericFieldDefaultValue(it);
      return getValue(field);
    },
    getFieldMin(field, fallback = 0) {
      const min = Number(field?.min);
      return Number.isFinite(min) ? min : fallback;
    },
    getFieldStep(field, fallback = 0.01) {
      const step = Number(field?.step);
      if (Number.isFinite(step) && step > 0) return step;
      return fallback;
    },
    getFieldPrecision(field, fallback = 0.01) {
      const step = String(this.getFieldStep(field, fallback));
      if (!step.includes(".")) return 0;
      return step.split(".")[1].length;
    },
    formatFieldValue(value) {
      if (value === null || value === undefined || value === "") return "未设置";
      return String(value);
    },
    formatFieldRange(field) {
      const min = field?.min;
      const max = field?.max;
      const step = field?.step;
      const parts = [];
      if (min !== undefined && max !== undefined) {
        parts.push(`范围：${min ?? "-∞"} ~ ${max ?? "+∞"}`);
      } else if (min !== undefined) {
        parts.push(`最小值：${min}`);
      } else if (max !== undefined) {
        parts.push(`最大值：${max}`);
      }
      if (step !== undefined) {
        parts.push(`步长：${step}`);
      }
      return parts.join(" · ");
    },
    getAugmentationDefaultValue(field) {
      if (!field || typeof field !== "object") return 0;
      if (field.default !== undefined) return field.default;
      if (field.value_type === "enum") {
        const options = this.normalizeAugmentationOptions(field.options);
        return options.length ? options[0].value : "";
      }
      return this.getNumericFieldDefaultValue(field, 0);
    },
    buildAugmentationInitialValues(fields) {
      return this.buildFieldInitialValues(fields, (field) => this.getAugmentationDefaultValue(field));
    },
    resetAugmentationState() {
      this.augmentationEnabled = false;
      this.augmentationOptions = [];
      this.augmentationValues = {};
      this.augmentationTouched = {};
      this.augmentationLoading = false;
      this.augmentationError = "";
      this.augmentationLastRequestedArchitectureId = "";
      this.augmentationLastResolvedArchitectureId = "";
      this.augmentationExpandedGroups = {};
      this.extraAugmentationGroupsExpanded = false;
    },
    async loadAugmentationOptions(architectureId = this.selectedArchitectureId) {
      const normalizedArchitectureId = this.normalizeArchitectureId(architectureId);

      this.augmentationEnabled = false;
      this.augmentationOptions = [];
      this.augmentationValues = {};
      this.augmentationTouched = {};
      this.augmentationLoading = false;
      this.augmentationError = "";
      this.augmentationLastRequestedArchitectureId = normalizedArchitectureId;
      this.augmentationLastResolvedArchitectureId = "";
      this.augmentationExpandedGroups = {};
      this.extraAugmentationGroupsExpanded = false;
      this.emitConfigChange();

      if (!this.isUltralyticsEngine) return;
      if (!normalizedArchitectureId) return;

      this.augmentationLoading = true;
      try {
        const data = await fetchTrainingAugmentationOptions({
          architecture_id: architectureId
        });
        if (!this.isCurrentArchitecture(architectureId)) return;
        const fields = Array.isArray(data?.fields) ? data.fields : [];
        this.augmentationOptions = fields;
        this.augmentationValues = this.buildAugmentationInitialValues(fields);
        this.augmentationTouched = {};
        this.augmentationLastResolvedArchitectureId = normalizedArchitectureId;
        this.augmentationError = "";
      } catch (error) {
        if (!this.isCurrentArchitecture(architectureId)) return;
        this.augmentationOptions = [];
        this.augmentationValues = {};
        this.augmentationTouched = {};
        this.augmentationError = error?.message || "加载数据增强配置失败";
        this.augmentationLastResolvedArchitectureId = normalizedArchitectureId;
      } finally {
        if (this.isCurrentArchitecture(architectureId)) {
          this.augmentationLoading = false;
          this.emitConfigChange();
        }
      }
    },
    normalizeAugmentationOptions(options) {
      return (Array.isArray(options) ? options : []).map((option) => {
        if (option && typeof option === "object") {
          const value = option.value ?? option.key ?? option.id ?? "";
          return {
            value,
            label: option.label ?? option.name ?? String(value),
          };
        }
        return {
          value: option,
          label: String(option),
        };
      });
    },
    getAugmentationFieldValue(field) {
      if (!field) return undefined;
      if (Object.prototype.hasOwnProperty.call(this.augmentationValues, field.key)) {
        return this.augmentationValues[field.key];
      }
      return this.getAugmentationDefaultValue(field);
    },
    getAugmentationNumericValue(field) {
      return this.getNumericFieldValue(
        field,
        this.augmentationValues,
        (it) => this.getAugmentationDefaultValue(it)
      );
    },
    getAugmentationFieldMin(field) {
      return this.getFieldMin(field, 0);
    },
    getAugmentationFieldMax(field) {
      const max = Number(field?.max);
      if (Number.isFinite(max)) return max;
      const current = this.getAugmentationNumericValue(field);
      const min = this.getAugmentationFieldMin(field);
      return Math.max(current, min + 1);
    },
    getAugmentationFieldStep(field) {
      return this.getFieldStep(field, field?.value_type === "integer" ? 1 : 0.01);
    },
    getAugmentationFieldPrecision(field) {
      if (field?.value_type === "integer") return 0;
      return this.getFieldPrecision(field, 0.01);
    },
    formatAugmentationOptionsText(field) {
      const labels = this.normalizeAugmentationOptions(field?.options).map((option) => option.label);
      return labels.length ? `选项：${labels.join(" / ")}` : "选项：-";
    },
    isAugmentationFieldTouched(key) {
      return !!this.augmentationTouched[key];
    },
    onAugmentationChanged(field, value) {
      if (!field?.key) return;
      let nextValue = value;
      if (field.value_type === "integer" && value !== null && value !== undefined && value !== "") {
        const n = Number(value);
        nextValue = Number.isFinite(n) ? Math.round(n) : value;
      }
      this.$set(this.augmentationValues, field.key, nextValue);
      this.$set(this.augmentationTouched, field.key, true);
      this.emitConfigChange();
    },
    resetAugmentationField(field) {
      if (!field?.key) return;
      this.$set(this.augmentationValues, field.key, this.getAugmentationDefaultValue(field));
      this.$delete(this.augmentationTouched, field.key);
      this.emitConfigChange();
    },
    buildAugmentationPayload() {
      return this.buildTouchedPayload(
        this.augmentationEnabled,
        this.augmentationTouched,
        this.augmentationValues
      );
    },
    getLossWeightDefaultValue(field) {
      return this.getNumericFieldDefaultValue(field, 0);
    },
    buildLossWeightInitialValues(fields) {
      return this.buildFieldInitialValues(fields, (field) => this.getLossWeightDefaultValue(field));
    },
    resetLossWeightState() {
      this.lossWeightsEnabled = false;
      this.lossWeightOptions = [];
      this.lossWeightValues = {};
      this.lossWeightTouched = {};
      this.lossWeightLoading = false;
      this.lossWeightError = "";
      this.lossWeightLastRequestedArchitectureId = "";
      this.lossWeightLastResolvedArchitectureId = "";
    },
    async loadLossWeightOptions(architectureId = this.selectedArchitectureId) {
      const normalizedArchitectureId = this.normalizeArchitectureId(architectureId);

      this.lossWeightsEnabled = false;
      this.lossWeightOptions = [];
      this.lossWeightValues = {};
      this.lossWeightTouched = {};
      this.lossWeightLoading = false;
      this.lossWeightError = "";
      this.lossWeightLastRequestedArchitectureId = normalizedArchitectureId;
      this.lossWeightLastResolvedArchitectureId = "";
      this.emitConfigChange();

      if (!this.isUltralyticsEngine) return;
      if (!normalizedArchitectureId) return;

      this.lossWeightLoading = true;
      try {
        const data = await fetchTrainingLossWeightOptions({
          architecture_id: architectureId
        });
        if (!this.isCurrentArchitecture(architectureId)) return;
        const fields = Array.isArray(data?.fields) ? data.fields : [];
        this.lossWeightOptions = fields;
        this.lossWeightValues = this.buildLossWeightInitialValues(fields);
        this.lossWeightTouched = {};
        this.lossWeightLastResolvedArchitectureId = normalizedArchitectureId;
        this.lossWeightError = "";
      } catch (error) {
        if (!this.isCurrentArchitecture(architectureId)) return;
        this.lossWeightOptions = [];
        this.lossWeightValues = {};
        this.lossWeightTouched = {};
        this.lossWeightError = error?.message || "加载 Loss 权重配置失败";
        this.lossWeightLastResolvedArchitectureId = normalizedArchitectureId;
      } finally {
        if (this.isCurrentArchitecture(architectureId)) {
          this.lossWeightLoading = false;
          this.emitConfigChange();
        }
      }
    },
    getLossWeightLabel(field) {
      const key = String(field?.key || "").trim();
      return LOSS_WEIGHT_LABELS[key] || field?.label || key || "Loss Weight";
    },
    getLossWeightDescription(field) {
      const key = String(field?.key || "").trim();
      return LOSS_WEIGHT_HINTS[key] || field?.description || "";
    },
    getLossWeightFieldValue(field) {
      return this.getNumericFieldValue(
        field,
        this.lossWeightValues,
        (it) => this.getLossWeightDefaultValue(it)
      );
    },
    isLossWeightFieldTouched(key) {
      return !!this.lossWeightTouched[key];
    },
    onLossWeightChanged(field, value) {
      if (!field?.key) return;
      this.$set(this.lossWeightValues, field.key, value);
      this.$set(this.lossWeightTouched, field.key, true);
      this.emitConfigChange();
    },
    resetLossWeightField(field) {
      if (!field?.key) return;
      this.$set(this.lossWeightValues, field.key, this.getLossWeightDefaultValue(field));
      this.$delete(this.lossWeightTouched, field.key);
      this.emitConfigChange();
    },
    buildLossWeightsPayload() {
      return this.buildTouchedPayload(
        this.lossWeightsEnabled,
        this.lossWeightTouched,
        this.lossWeightValues
      );
    },
    emitConfigChange() {
      const augmentation = this.isUltralyticsEngine ? this.buildAugmentationPayload() : null;
      const lossWeights = this.isUltralyticsEngine ? this.buildLossWeightsPayload() : null;
      const parsedImageSize = parseInt(this.imgSize, 10) || 640;

      const configData = {
        engine: this.normalizedEngine,
        epochs: parseInt(this.epochs, 10) || 100,
        img_size: parsedImageSize,
        input_size: parsedImageSize,
        patience: parseInt(this.patience, 10) || 100,
        learning_rate: parseFloat(this.learningRate) || 0.01,
        batch_size: this.batchSize != null && String(this.batchSize).trim() !== '' ? parseInt(this.batchSize, 10) : 16,
        device: this.getDeviceValue(),
        optimizer: String(this.optimizer || "auto").toLowerCase(),
        use_pretrained: this.pretrainedEnabled,
        pretrained_model_path: this.pretrainedEnabled ? this.pretrainedPath : "",
        dataset_name: this.selectedProject?.dataset?.dataset_name || "",
        save_period: parseInt(this.savePeriod, 10),
        augmentation,
        loss_weights: lossWeights,
      };
      if (this.isPaddleEngine) {
        configData.config_path = String(this.configPath || "").trim();
        configData.eval_during_train = !!this.evalDuringTrain;
        configData.eval_interval = Math.max(1, parseInt(this.evalInterval, 10) || 1);
      } else {
        configData.config_path = "";
      }

      this.$emit("config-changed", configData);
    },
    getDeviceValue() {
      const val = String(this.selectedDevice || "").trim();
      return val || "0";
    }
  },
  mounted() {
    loadArchitectures();
    this.$nextTick(() => {
      this.initializeDefaultArchitecture();
      this.emitConfigChange();
    });
  }
};
</script>

<style scoped>
.official-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: #111315;
  width: 100%;
  max-width: 100%;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border: 1px solid #e4e7ee;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
}

.settings-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.settings-section__title {
  font-size: 16px;
  font-weight: 700;
  color: #111315;
}

.settings-section__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6a7482;
  line-height: 1.6;
}

.settings-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #2b3a67;
}

.panel-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #111315;
}

.panel-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #6a7482;
}

.dataset-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(79, 99, 199, 0.1);
  color: #2b3a67;
  font-size: 12px;
}

.dataset-chip .label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 10px;
}

.arch-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #3e4a5b;
}

.arch-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6a7482;
  font-size: 12px;
}

.arch-state.error {
  color: #d64545;
}

.arch-tabbed {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Family tab bar */
.family-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 2px;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.family-tabs::-webkit-scrollbar {
  display: none;
}

.family-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #6a7482;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.family-tab:hover {
  background: #f0f2f8;
  color: #3e4a5b;
}

.family-tab.active {
  background: linear-gradient(135deg, #eef0ff 0%, #e4e8ff 100%);
  border-color: #c5cdff;
  color: #2b3a67;
  font-weight: 600;
}

.tab-count {
  font-size: 10px;
  background: #e4e7ee;
  color: #6a7482;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 600;
  line-height: 1.4;
}

.family-tab.active .tab-count {
  background: rgba(79, 99, 199, 0.2);
  color: #3b4fb8;
}

/* Variant chips row */
.variant-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.arch-chip {
  border: 1px solid #e4e7ee;
  background: #f6f7fb;
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: #3e4a5b;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.5px;
}

.arch-chip:hover {
  border-color: #9bb0ff;
  color: #2b3a67;
  background: #eef1ff;
}

.arch-chip.active {
  background: linear-gradient(135deg, rgba(79, 99, 199, 0.18), rgba(79, 99, 199, 0.12));
  border-color: #4f63c7;
  color: #2b3a67;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(79, 99, 199, 0.18);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.metric-card {
  background: #f7f8fc;
  border-radius: 14px;
  padding: 12px;
}

.metric-label {
  font-size: 11px;
  color: #6a7482;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  margin-top: 6px;
  color: #111315;
}

.metric-bar {
  margin-top: 8px;
  height: 10px;
  background: #e4e7ee;
  border-radius: 999px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f63c7, #9bb0ff);
  transition: width 0.4s ease;
}

.advanced-panel {
  border-top: 1px solid #e4e7ee;
  padding-top: 12px;
}

.advanced-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: #2b3a67;
  cursor: pointer;
  padding: 6px 0;
}

.chevron {
  width: 10px;
  height: 10px;
  border-right: 2px solid #4f63c7;
  border-bottom: 2px solid #4f63c7;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.chevron.open {
  transform: rotate(-135deg);
}

.advanced-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.section-action {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #d7def0;
  border-radius: 999px;
  background: #f7f9ff;
  color: #2b3a67;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 14px;
  transition: all 0.2s ease;
}

.section-action:hover {
  border-color: #b7c3f5;
  background: #eef2ff;
}

.section-action--full {
  justify-content: space-between;
  width: 100%;
}

.section-chevron {
  width: 10px;
  height: 10px;
  border-right: 2px solid #4f63c7;
  border-bottom: 2px solid #4f63c7;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.section-chevron.open {
  transform: rotate(-135deg);
}

.advanced-grid-preview,
.advanced-grid-extra {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.advanced-grid-extra {
  padding-top: 4px;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f6f7fb;
  border: 1px solid #e4e7ee;
}

.field-row.wide {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6a7482;
}

.field-input ::v-deep .el-input__inner {
  border-radius: 10px;
}

.field-input-number {
  width: 100%;
}

.augmentation-state,
.loss-weight-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed #cfd6e6;
  border-radius: 12px;
  background: #fff;
  color: #6a7482;
  font-size: 12px;
}

.augmentation-state.error,
.loss-weight-state.error {
  border-color: rgba(214, 69, 69, 0.35);
  color: #d64545;
}

.augmentation-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.augmentation-group {
  border: 1px solid #e4e7ee;
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
}

.augmentation-group__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.augmentation-group__title {
  font-size: 13px;
  font-weight: 700;
  color: #2b3a67;
}

.augmentation-group__actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #6a7482;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #f2f4fb;
  font-size: 11px;
  font-weight: 600;
}

.augmentation-group__body {
  padding: 0 14px 14px;
}

.augmentation-group__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.augmentation-extra {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.augmentation-extra__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.augmentation-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e4e7ee;
  border-radius: 12px;
  background: #f9fafc;
}

.augmentation-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.augmentation-item__label {
  font-size: 14px;
  font-weight: 600;
  color: #111315;
}

.augmentation-item__meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 11px;
  color: #6a7482;
}

.augmentation-item__desc {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.5;
}

.augmentation-item__control {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.augmentation-number-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.augmentation-select {
  width: 100%;
}

.augmentation-input {
  width: 128px;
}

.loss-weight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.loss-weight-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e4e7ee;
  border-radius: 12px;
  background: #fff;
}

.loss-weight-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.loss-weight-item__label {
  font-size: 14px;
  font-weight: 600;
  color: #111315;
}

.loss-weight-item__meta {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 11px;
  color: #6a7482;
}

.loss-weight-item__desc {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.5;
}

.loss-weight-item__control {
  display: flex;
  justify-content: flex-start;
}

.loss-weight-input {
  width: 180px;
}

/* Compact upload row */
.upload-compact {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-hidden ::v-deep .el-upload {
  display: inline-block;
}

.browse-btn {
  border-radius: 8px !important;
  background: linear-gradient(135deg, #111f68 0%, #0d1554 100%) !important;
  border-color: #111f68 !important;
  color: #fff !important;
  font-weight: 500;
  padding: 8px 14px;
}

.browse-btn:hover {
  background: linear-gradient(135deg, #1a2d8a 0%, #111f68 100%) !important;
}

.file-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #2b3a67;
  background: #fff;
  border: 1px solid #e4e7ee;
  border-radius: 8px;
  padding: 6px 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-name .el-icon-document {
  color: #4f63c7;
}

.remove-icon {
  cursor: pointer;
  color: #d64545;
  margin-left: 4px;
}

.remove-icon:hover {
  color: #b33c3c;
}

.file-hint {
  font-size: 12px;
  color: #9ca3af;
}

.upload-error {
  font-size: 11px;
  color: #d64545;
  margin-top: 4px;
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hint-icon {
  font-size: 14px;
  color: #9ca3af;
  cursor: help;
  transition: color 0.2s ease;
}

.hint-icon:hover {
  color: #4f63c7;
}

@media (max-width: 720px) {
  .panel-top {
    flex-direction: column;
    align-items: flex-start;
  }
  .settings-section__header,
  .augmentation-group__toggle,
  .augmentation-item__top,
  .loss-weight-item__top,
  .augmentation-number-control {
    flex-direction: column;
    align-items: stretch;
  }
  .advanced-grid {
    grid-template-columns: 1fr;
  }
  .advanced-grid-preview,
  .advanced-grid-extra,
  .metric-grid,
  .augmentation-group__grid,
  .loss-weight-grid {
    grid-template-columns: 1fr;
  }
  .augmentation-input,
  .loss-weight-input {
    width: 100%;
  }
}
</style>
