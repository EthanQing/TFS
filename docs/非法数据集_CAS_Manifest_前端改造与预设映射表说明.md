# 非法数据集 CAS + Manifest 前端说明

适用范围：`TFS` 前端，非法数据集详情页、标签映射预设导入。

后端已将非法数据集版本从“版本快照目录”改为“CAS 内容存储 + Manifest 版本清单”。前端不需要理解 CAS，也不需要读取 Manifest。当前非法数据集已经彻底取消浏览型能力，只保留元信息、标签映射、版本、事件和发布转换工作流。

---

## 1. 核心改造原则

### 必须遵守

1. **不要再拼 `/static/datasets/...`**
   - 非法数据集版本的新文件不再保证存在于版本快照目录。
   - 非法数据集前端不再提供文件打开、下载或图片查看入口。

2. **不要依赖 `version.snapshot_path` 做文件访问**
   - 新版本的 `snapshot_path` 可能是 `null`。
   - 版本列表可以展示 `version_id`、`version`、`file_count`、`size_bytes`、`manifest_path` 等元信息，但不要用 `snapshot_path` 拼文件路径。

3. **不要再接入非法数据集浏览型接口**
   - `GET /api/v3/illegal-datasets/{id}/files` 已禁用。
   - `GET /api/v3/illegal-datasets/{id}/versions/{version_id}/files/{file_path}` 已禁用。
   - `GET /api/v3/illegal-datasets/{id}/image-annotations` 已禁用。
   - `GET /api/v3/illegal-datasets/{id}/view` 仅保留兼容空响应，新前端不要调用。

4. **不要再使用非法数据集缩略图或样本预览**
   - `GET /api/v3/thumbnails/illegal/...` 不再生成缩略图；标准数据集缩略图不受影响。
   - 数据集列表中的非法数据集卡片统一使用占位图。

5. **保留轻量工作流**
   - 详情、原始标签、标签映射、保存映射、版本切换、事件记录和发布为标准数据集仍使用后端接口。
   - 发布转换由后端内部读取 Manifest 和源文件，前端不需要展示或遍历文件。

---

## 2. 需要检查/修改的前端文件

### 2.1 `src/api/illegalDatasets.js`

保留以下轻量封装：

- `fetchIllegalDatasets`
- `fetchIllegalDatasetDetail`
- `fetchIllegalDatasetRawLabels`
- `fetchIllegalDatasetLabelMappings`
- `saveIllegalDatasetLabelMappings`
- `fetchIllegalDatasetVersions`
- `activateIllegalDatasetVersion`
- `fetchIllegalDatasetEvents`
- `fetchIllegalDatasetPublishJobs`
- `createIllegalDatasetPublishJob`
- `resumeIllegalDatasetPublishJob`

不要恢复 `buildIllegalVersionFileUrl`、`fetchIllegalDatasetFiles`、`fetchIllegalDatasetAnnotations` 或基于非法缩略图的 URL helper。

---

### 2.2 `src/views/Datasets/IllegalDatasetDetail.vue`

#### A. 数据内容

非法数据集详情页已移除样本预览和文件列表。数据内容区域展示轻量事件记录，不再提供图片网格、文件表格、打开原图或标注查看入口。

#### B. 基础信息中的 `storage_path`

`dataset.storage_path` 现在只代表当前工作目录，不代表版本数据源。可以继续展示，但建议文案改为：

```text
当前工作目录
```

不要在页面上展示 `snapshot_path` 作为文件访问入口。

#### C. 版本列表

版本切换仍使用：

```js
activateIllegalDatasetVersion(datasetId, versionId)
```

切换后重新调用详情接口并刷新标签映射。前端不用关心后端是从快照目录复制，还是从 Manifest/CAS 硬链接重建。

---

## 3. 接口返回字段使用约定

### 3.1 保留的前端接口

| 接口 | 用途 |
|---|---|
| `GET /api/v3/illegal-datasets/{dataset_id}/detail` | 详情、版本、事件 |
| `GET /api/v3/illegal-datasets/{dataset_id}/raw-labels` | 原始标签 |
| `GET /api/v3/illegal-datasets/{dataset_id}/label-mappings` | 已保存映射 |
| `PUT /api/v3/illegal-datasets/{dataset_id}/label-mappings` | 保存映射 |
| `POST /api/v3/illegal-datasets/{dataset_id}/versions/{version_id}/activate` | 切换当前版本 |
| `GET /api/v3/illegal-datasets/{dataset_id}/publish-jobs` | 发布任务 |
| `POST /api/v3/illegal-datasets/{dataset_id}/publish-jobs` | 创建发布任务 |

### 3.2 禁用的浏览型接口

| 接口 | 当前约定 |
|---|---|
| `GET /api/v3/illegal-datasets/{dataset_id}/view` | 仅兼容空响应，新前端不调用 |
| `GET /api/v3/illegal-datasets/{dataset_id}/files` | 不再提供 |
| `GET /api/v3/illegal-datasets/{dataset_id}/versions/{version_id}/files/{file_path}` | 不再提供 |
| `GET /api/v3/illegal-datasets/{dataset_id}/image-annotations` | 不再提供 |
| `GET /api/v3/thumbnails/illegal/...` | 快速返回不可用，不生成缩略图 |

---

## 4. 预设映射表 XLSX 格式更新

新版预设映射表使用显式 `status` 列表示保留或丢弃，不再要求在 `target_label` 中填写特殊丢弃值。

样例文件：

```text
TFS/docs/illegal_label_mapping_preset_sample_status.xlsx
```

> 说明：原文件 `illegal_label_mapping_preset_sample.xlsx` 如果被 Excel/WPS 打开，会被系统锁定；关闭后可用上述新文件覆盖原文件。

### 4.1 检测映射 Sheet

推荐 Sheet 名：

```text
检测映射
```

推荐表头：

| source_label | target_label | status | note |
|---|---|---|---|
| 车辆%乘用车%小汽车 | car | keep | 保留并映射为 car |
| 车辆%商用车%货车 | truck | keep | 保留并映射为 truck |
| 低质量%严重遮挡 |  | delete | 丢弃，不进入训练集 |

字段说明：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `source_label` | 是 | 原始标签路径，通常用 `%` 分隔层级 |
| `target_label` | `status=keep` 时必填 | 映射后的目标标签 |
| `status` | 否 | `keep`=保留，`delete`=丢弃；为空默认按 `keep` 处理 |
| `note` | 否 | 备注，前端导入时可忽略 |

### 4.2 分类映射 Sheet

推荐 Sheet 名：

```text
分类映射
```

推荐表头：

| category | source_label | target_label | status | note |
|---|---|---|---|---|
| 机动车 | 车辆%乘用车%小汽车 | car | keep | 保留 |
| 非机动车 | 车辆%非机动车%自行车 | bicycle | keep | 保留 |
| 忽略 | 低质量%严重遮挡 |  | delete | 丢弃 |

字段说明：

- `status=delete` 时，`target_label` 可以留空。
- `status=keep` 且 `target_label` 为空时，前端可默认使用 `category` 作为目标标签。
- 后端仍兼容历史特殊丢弃值，但新表不再推荐使用。
