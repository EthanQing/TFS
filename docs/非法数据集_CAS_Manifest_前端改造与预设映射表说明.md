# 非法数据集 CAS + Manifest 改造后的前端改造说明

适用范围：`TFS` 前端，非法数据集详情页、文件列表、标签映射预设导入。

后端已将非法数据集版本从“版本快照目录”改为“CAS 内容存储 + Manifest 版本清单”。前端不需要理解 CAS，也不需要读取 Manifest；只需要使用后端接口返回的 URL。

---

## 1. 核心改造原则

### 必须做

1. **不要再拼 `/static/datasets/...`**
   - 非法数据集版本的新文件不再保证存在于版本快照目录。
   - 文件打开/下载都应直接使用后端返回的 URL。

2. **不要依赖 `version.snapshot_path`**
   - 新版本的 `snapshot_path` 可能是 `null`。
   - 版本列表可以展示 `version_id`、`version`、`file_count`、`size_bytes`、`manifest_path`，但不要用 `snapshot_path` 拼文件路径。

3. **所有非法数据集版本文件访问使用新接口**

   ```http
   GET /api/v3/illegal-datasets/{dataset_id}/versions/{version_id}/files/{file_path}
   ```

4. **不要再使用非法数据集缩略图**
   - 非法数据集已取消样本预览和缩略图展示。
   - `GET /api/v3/thumbnails/illegal/...` 不再生成缩略图；标准数据集缩略图不受影响。

### 建议做

- 在 `src/api/illegalDatasets.js` 中统一归一化后端 URL，页面组件只消费文件列表的 `url` 和标注接口的 `image_url`。
- 文件列表返回的 `url` 也应转成绝对地址，兼容前后端不同域名部署。

---

## 2. 需要检查/修改的前端文件

### 2.1 `src/api/illegalDatasets.js`

#### A. 新增版本文件 URL helper

用于前端确实需要手动打开某个版本文件时使用。

```js
export function buildIllegalVersionFileUrl(datasetId, versionId, relPath) {
  if (!datasetId || !versionId || !relPath) return '';
  const cleanRelPath = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleanRelPath) return '';
  return toAbsUrl(
    `/api/v3/illegal-datasets/${encodeURIComponent(datasetId)}` +
    `/versions/${encodeURIComponent(versionId)}` +
    `/files/${encodePathSegments(cleanRelPath)}`
  );
}
```

#### B. `fetchIllegalDatasetView`：兼容旧接口即可

非法数据集详情页不再调用 `/view`。后端保留该接口壳并返回空预览结果，前端不要再基于它展示样本预览或拼缩略图 URL。

#### C. `fetchIllegalDatasetAnnotations`：保持使用 `data.image_url`

确认不要自己拼图像地址：

```js
image_url: toAbsUrl(data?.image_url || ''),
```

#### D. `fetchIllegalDatasetFiles`：归一化文件 URL

推荐从直接返回改成：

```js
export async function fetchIllegalDatasetFiles(datasetId, { page = 1, pageSize = 100, versionId = null } = {}) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  if (versionId != null && versionId !== '') params.set('version_id', String(versionId));

  const url = `${PREFIX}/${encodeURIComponent(datasetId)}/files?${params.toString()}`;
  const data = await getJson(url);
  return {
    ...data,
    items: (data.items || []).map(file => ({
      ...file,
      url: file.url ? toAbsUrl(file.url) : '',
    })),
  };
}
```

---

### 2.2 `src/views/Datasets/IllegalDatasetDetail.vue`

#### A. 样本预览

非法数据集详情页已移除样本预览，不要重新接入 `/view` 或 `/api/v3/thumbnails/illegal/...`。

#### B. 文件列表

保持使用后端返回的 `scope.row.url`：

```vue
<el-link v-if="scope.row.url" :href="scope.row.url" target="_blank" type="primary">打开</el-link>
```

如果需要“下载”而不是“打开”，可以加：

```vue
<el-link v-if="scope.row.url" :href="scope.row.url" target="_blank" download type="primary">下载</el-link>
```

#### C. 基础信息中的 `storage_path`

`dataset.storage_path` 现在只代表当前工作目录，不代表版本数据源。可以继续展示，但建议文案改为：

```text
当前工作目录
```

不要在页面上展示 `snapshot_path` 作为文件访问入口。

#### D. 版本列表

版本切换仍使用：

```js
activateIllegalDatasetVersion(datasetId, versionId)
```

切换后重新调用详情接口，并在用户切换到文件列表时重新加载文件列表。前端不用关心后端是从快照目录复制，还是从 Manifest/CAS 硬链接重建。

---

## 3. 接口返回字段使用约定

### 3.1 预览接口

```http
GET /api/v3/illegal-datasets/{dataset_id}/view?version_id={version_id}
```

该接口仅为兼容旧调用保留，返回空 `categories` 和 `items`。新页面不要依赖它展示非法数据集样本。

### 3.2 标注接口

```http
GET /api/v3/illegal-datasets/{dataset_id}/image-annotations?version_id={version_id}&image_path={path}
```

前端使用：

| 字段 | 用途 |
|---|---|
| `image_url` | 原图 URL |
| `boxes` | 标注框 |
| `width` / `height` | 图片尺寸 |

### 3.3 文件列表接口

```http
GET /api/v3/illegal-datasets/{dataset_id}/files?version_id={version_id}
```

前端使用：

| 字段 | 用途 |
|---|---|
| `path` | 相对路径 |
| `size_bytes` | 文件大小 |
| `mtime` | 修改时间戳，秒 |
| `url` | 可打开文件的后端 URL，图片文件通常有值 |
| `exists` | CAS 文件是否存在，`false` 说明后端数据异常 |

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
