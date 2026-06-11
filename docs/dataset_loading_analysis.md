# 数据集模块前端加载问题分析文档

> 生成日期: 2026-05-20
> 目的: 梳理所有数据集相关前端加载路径，标注已修复问题和待排查的后端瓶颈，供与后端接口对接使用。

---

## 一、加载路径全量清单

### 1.1 应用启动预加载（所有页面触发）

| 调用链 | 接口 | 参数 | 触发时机 |
|--------|------|------|----------|
| `main.js:53` → `preloadReferenceData()` → `referenceStore.loadDatasets()` | `GET /api/v3/standard-datasets` | `page=1, page_size=100` | 应用启动 |
| `main.js:53` → `preloadReferenceData()` → `referenceStore.loadProjects()` | `GET /api/v3/projects` | `page=1, page_size=100` | 应用启动 |
| `main.js:53` → `preloadReferenceData()` → `referenceStore.loadArchitectures()` | `GET /api/v3/architectures` | - | 应用启动 |

**已修复**: `page_size` 已从 500 降至 100（2026-05-20）。

**影响**: 任意页面打开时都会触发这三条请求，数据集列表页和详情页自身也会发请求，浏览器连接池（~6 并发）被抢占。

---

### 1.2 数据集列表页 (`/datasets`)

**页面**: `src/views/Datasets/index.vue`

| # | 调用方法 | 接口 | 参数 | 触发时机 |
|---|----------|------|------|----------|
| 1 | `fetchDatasetsList()` → `fetchStandardDatasets()` | `GET /api/v3/standard-datasets` | `page=1, page_size=50` | 切换到"标准数据集" tab |
| 2 | `fetchDatasetsList()` → `fetchIllegalDatasets()` | `GET /api/v3/illegal-datasets` | `page=1, page_size=50` | 切换到"原始数据集" tab |

**请求量**: 每次切 tab 1 个请求。每条数据集记录含 `statistics`（total_images / total_size_mb / num_classes）。

**当前状态**: 🟡 `page_size=50` 本身不算大，但后端需要在列表查询中计算每个数据集的 statistics。如果后端是对每个数据集单独查统计，则 50 条 = 50 次子查询。

---

### 1.3 标准数据集详情页 (`/standard-dataset-detail`)

**页面**: `src/views/Datasets/StandardDatasetDetail.vue`

**初始化加载 `loadAll()`**：

| # | 调用方法 | 接口 | 参数 | 说明 |
|---|----------|------|------|------|
| 1 | `fetchStandardDatasetDetail()` | `GET /api/v3/standard-datasets/{id}/detail` | `events_limit=20` | 数据集详情 + 统计 + 最近 20 条事件 |
| 2 | `fetchStandardDatasetView()` | `GET /api/v3/standard-datasets/{id}/view` | `page=1, page_size=120` | 第 1 页图片列表 + 类别列表 |
| 3 | `fetchStandardDatasetSplitSummary()` | `GET /api/v3/standard-datasets/{id}/split` | `page=1, page_size=1` | 数据集划分摘要 |

加载顺序: 接口 1 先执行 → 接口 2 和 3 并行。

**自动补页 `loadMoreImages()`**（初始加载后自动触发）：

| # | 接口 | 参数 | 说明 |
|---|------|------|------|
| 4 | `GET .../view` | `page=2, page_size=120` | 并行加载 |
| 5 | `GET .../view` | `page=3, page_size=120` | 并行加载 |

**已修复**: 旧代码串行拉取全部 84 页（10,000 张图 = 84 次串行请求 + 10,000 DOM 节点），现改为首屏 3 页（360 张）+「加载更多」按钮。

**按类别筛选**（点击左侧类别）：

| # | 接口 | 参数 | 说明 |
|---|------|------|------|
| 1 | `GET .../view` | `class_id={N}, page=1, page_size=120` | 重新请求第 1 页 |
| 2-3 | `GET .../view` | `class_id={N}, page=2-3, page_size=120` | 自动补页 |

**点击图片预览标注**：

| # | 接口 | 参数 |
|---|------|------|
| 1 | `GET /api/v3/standard-datasets/{id}/image-annotations` | `image_path={path}` |

**首屏总计: 5 个 HTTP 请求** (1 detail + 3 view pages + 1 split)。

---

### 1.4 非法数据集详情页 (`/illegal-dataset-detail`)

**页面**: `src/views/Datasets/IllegalDatasetDetail.vue`

**初始化加载 `loadAll()`**：

| # | 调用方法 | 接口 | 参数 | 说明 |
|---|----------|------|------|------|
| 1 | `fetchIllegalDatasetDetail()` | `GET /api/v3/illegal-datasets/{id}/detail` | `versions_limit=50, events_limit=50` | 详情 + 版本列表 + 事件 |
| 2 | `fetchIllegalDatasetRawLabels()` | `GET /api/v3/illegal-datasets/{id}/raw-labels` | - | 所有不重复原始标签 |
| 3 | `fetchIllegalDatasetLabelMappings()` | `GET /api/v3/illegal-datasets/{id}/label-mappings` | - | 已保存映射关系 |

非法数据集已取消样本预览、缩略图、文件列表、原图打开和图片标注查看。详情页不再调用 `/view`、`/files`、`/versions/{version_id}/files/{file_path}`、`/image-annotations` 或非法缩略图接口。

**首屏总计: 3 个 HTTP 请求**。

---

### 1.5 项目详情页 (`/projectsdetail`)

**页面**: `src/views/Projects/ProjectDetail.vue`

| # | 调用方法 | 接口 | 参数 | 说明 |
|---|----------|------|------|------|
| 1 | `loadDatasets()` (referenceStore) | `GET /api/v3/standard-datasets` | `page=1, page_size=100` | 获取数据集名称映射 |
| 2 | `fetchProjects()` | `GET /api/v3/projects` | `page=1, page_size=100` | 项目列表 |

---

### 1.6 项目列表页 (`/projects`)

**页面**: `src/views/Projects/index.vue`

| # | 接口 | 参数 | 说明 |
|---|------|------|------|
| 1 | `GET /api/v3/standard-datasets` | `page=1, page_size=50` | 填充创建项目时的数据集下拉框 |

---

### 1.7 数据增强面板

**组件**: `src/views/Datasets/components/ManualAugmentationPanel.vue`

| 调用方法 | 接口 | 触发时机 |
|----------|------|----------|
| `previewStandardAugmentation()` | `POST .../augmentations/preview` | 用户调整增强参数 |
| `createStandardAugmentationJob()` | `POST .../augmentations` | 用户点击"开始增强" |
| `openStandardAugmentationStream()` | WebSocket `.../augmentations/{jobId}/stream` | 增强任务实时进度 |

---

## 二、已修复问题

| # | 问题 | 文件 | 修复内容 | 日期 |
|---|------|------|----------|------|
| 1 | 详情页串行加载全部图片导致卡死 | `StandardDatasetDetail.vue` | `loadRemainingViewPages` 串行 84 页 → `loadMoreImages` 并行 2 页/批 + 首屏仅 3 页 + 加载更多按钮 | 2026-05-20 |
| 2 | 应用启动 pageSize=500 预加载 | `referenceStore.js` | `page_size: 500` → `100` | 2026-05-20 |
| 3 | 类别列表 class_id=0 误匹配 | `StandardDatasetDetail.vue` | `isSelectedClass` 增加 `null`/`undefined` 提前返回 | 2026-05-20 |
| 4 | 刷新后任务轮询状态丢失 | `apiUtils.js` + `Upload/index.vue` | 新增 `saveUploadTask`/`loadUploadTask`，`mounted` 自动恢复轮询 | 2026-05-20 |
| 5 | 分片上传不支持断点续传 | `apiUtils.js` | `chunkedUpload` 新增 `resumeSessionId`、`onSessionCreated`、`onTaskReady` | 2026-05-20 |

---

## 三、待排查后端瓶颈（请用 Network 面板逐一验证）

### 高优先级

| # | 接口 | 现象 | 排查方向 |
|---|------|------|----------|
| 1 | `GET /api/v3/standard-datasets/{id}/view?page=1&page_size=120` | 响应时间长（用户反馈"很久之后才接收到返回"） | 检查后端是否对全量图片做了 COUNT 或排序后才分页；检查 thumbnail_url 是否实时生成 |
| 2 | `GET /api/v3/standard-datasets/{id}/detail?events_limit=20` | 含 statistics（total_images / total_size_mb / total_objects），大数据集扫描慢 | 检查 statistics 是否实时计算（如遍历文件系统），建议改为缓存/异步更新 |
| 3 | `GET /api/v3/illegal-datasets/{id}/detail?versions_limit=50&events_limit=50` | 同上 + 版本列表 | 检查版本列表查询是否有关联子查询 |
| 4 | `GET /api/v3/standard-datasets?page=1&page_size=50` | 列表页加载慢 | 检查列表查询是否为每个数据集单独查 statistics（N+1 问题），建议 statistics 存表而非实时计算 |

### 中优先级

| # | 接口 | 现象 | 排查方向 |
|---|------|------|----------|
| 5 | `GET /api/v3/illegal-datasets/{id}/raw-labels` | 大 ZIP 可能上万个标签，返回全量 | 检查是否全量返回；建议加分页或限制 |
| 6 | `GET /api/v3/standard-datasets/{id}/view?class_id={N}` | class_id 过滤可能未生效 | 验证带 class_id 参数的响应体 items 是否确实被过滤 |

### 低优先级

| # | 接口 | 说明 |
|---|------|------|
| 7 | `GET .../split?page_size=1` | 轻量，仅 1 条记录 |
| 8 | `GET .../label-mappings` | 仅返回已保存映射，通常量不大 |
| 9 | `GET /api/v3/standard-datasets/{id}/image-annotations?image_path=...` | 标准数据集单张图片标注，按需触发 |

---

## 四、前端并发请求分析

### 标准数据集详情页首屏并发

```
时间线:
  t=0   → detail 请求发出
  t=detail_done → view(page=1) + split 并行发出
  t=view_p1_done → view(page=2) + view(page=3) 并行发出
  t=all_done → 渲染完成

总计: 1 + 2 + 2 = 5 个 HTTP 请求（2 个串行阶段）
```

### 非法数据集详情页首屏并发

```
时间线:
  t=0   → detail 请求发出
  t=detail_done → raw-labels + label-mappings 并行发出
  t=all_done → 渲染完成

总计: 1 + 2 = 3 个 HTTP 请求（2 个串行阶段）
```

### 瓶颈分析

两个详情页都有 2-3 个串行阶段。关键是**第一阶段**（detail 接口）不返回，后续所有请求都被阻塞。

建议后端优先优化：
1. `/detail` 接口 — 将 statistics 缓存或异步更新
2. 标准数据集 `/view` 接口 — 分页使用数据库 LIMIT/OFFSET，避免全量扫描后内存分页

---

## 五、未被调用的 API 函数（可考虑清理）

以下函数在 `standardDatasets.js` / `illegalDatasets.js` 中有定义，但前端无任何调用方：

- `fetchStandardDataset` (单条查询)
- `fetchStandardDatasetStatistics` (单独统计)
- `fetchStandardDatasetFiles` (文件列表)
- `fetchStandardDatasetEvents` (事件分页)
- `fetchIllegalDataset` (单条查询)
- `fetchIllegalDatasetStatistics` (单独统计)
- `fetchIllegalDatasetVersions` (版本分页)
- `fetchIllegalDatasetEvents` (事件分页)
非法数据集文件浏览和图片标注封装已删除，不再作为待启用死代码保留。以上函数目前属于死代码，如果后端对应接口也不存在或未优化，无需关注。如果要后续使用，届时再接入。

---

## 六、前端优化建议（后续迭代）

| 建议 | 说明 |
|------|------|
| 虚拟滚动 | 图片列表使用 `vue-virtual-scroller` 替代 `v-for` 全量渲染，可支持任意数量图片 |
| 缩略图懒加载增强 | 当前已用 `loading="lazy"`，可进一步用 IntersectionObserver 只在可视区域加载 |
| 预加载按需化 | `preloadReferenceData()` 改为路由守卫触发，只在进入 Projects/Architecture 页面时才加载，数据集页面不加载 |
| 骨架屏 | 详情页加载中用骨架屏替代 loading spinner，视觉体验更好 |
