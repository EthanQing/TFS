# 项目结构重构建议书

这份文档旨在为 `Training-Platform` 项目提供一个清晰、可维护、符合 Vue 最佳实践的目录结构规范。

## 1. 核心改进目标

*   **分离关注点**：明确区分 **页面 (Views)** 和 **组件 (Components)**。
*   **统一资源管理**：解决图片、样式文件散落在各处的问题。
*   **模块化 API**：避免单文件 `api/index.js` 过于臃肿。
*   **命名规范**：统一文件夹和文件命名风格（PascalCase）。

## 2. 理想目录结构图

```text
src/
├── api/                        # [重构] API 接口统一管理
│   ├── index.js                # 基础配置 (axios 拦截器等)
│   ├── datasets.js             # 数据集相关接口
│   ├── projects.js             # 项目管理相关接口
│   ├── models.js               # 模型相关接口
│   └── user.js                 # 用户/登录相关接口
│
├── assets/                     # [重构] 静态资源 (会被 webpack 处理)
│   ├── images/                 # 所有图片资源
│   │   ├── common/             # 通用图标/图片
│   │   ├── projects/           # 项目模块专用图片
│   │   └── backgrounds/        # 背景图
│   └── icons/                  # SVG 图标等
│
├── components/                 # [重构] 全局 **通用** 组件 (Dumb Components)
│   │                           # 这里的组件不应该包含具体的业务逻辑，只负责展示
│   ├── Chart/                  # (原 chart/CustomChart) 图表封装
│   │   └── BaseChart.vue
│   ├── Navigation/             # 导航栏
│   │   └── TopNav.vue
│   ├── Upload/                 # (原 UploadZip) 上传组件
│   └── Common/                 # 其他小颗粒度组件
│
├── views/                      # [新增] 页面级组件 (Smart Components)
│   │                           # 直接对应路由 (Router) 的页面
│   ├── Dashboard/              # 首页/概览
│   │   └── index.vue
│   ├── Datasets/               # 数据集模块
│   │   ├── index.vue           # 数据集列表页
│   │   ├── DatasetDetail.vue   # (原 DataDetail)
│   │   └── components/         # **页面独有** 的组件放这里，不要污染全局 components
│   │       └── DataConversion.vue
│   ├── Projects/               # 项目模块
│   │   ├── index.vue           # 项目列表
│   │   ├── ProjectDetail.vue
│   │   └── ProjectCharts.vue
│   ├── Models/                 # 模型模块
│   │   ├── index.vue
│   │   ├── CreateModel/        # 包含 Step1, Step2 的复杂流程
│   │   │   ├── index.vue       # 主容器
│   │   │   ├── Step1.vue
│   │   │   └── Step2.vue
│   │   └── VersionManager.vue
│   └── Training/               # 训练模块
│       └── TrainManager.vue
│
├── router/                     # 路由配置
│   ├── index.js                # 路由入口 (建议使用懒加载 import)
│   └── routes.js               # (可选) 路由表分离
│
├── store/                      # Vuex 状态管理
│   ├── index.js
│   ├── modules/                # 模块化 Store
│   │   ├── user.js
│   │   └── project.js
│   └── getters.js
│
├── styles/                     # 全局样式
│   ├── global.css              # (修正拼写 globol.css -> global.css)
│   ├── reset.css               # (从 public 移入)
│   ├── variables.scss          # (可选) SCSS 变量
│   └── mixins.scss             # (可选) SCSS 混合
│
├── utils/                      # [新增] 工具函数目录
│   ├── request.js              # axios 封装
│   ├── format.js               # 数据格式化工具
│   └── validate.js             # 正则校验工具
│
├── App.vue                     # 根组件
└── main.js                     # 入口文件
```

## 3. 详细说明

### 3.1 Views vs Components
这是当前项目最混乱的地方。
*   **src/views/**: 存放所有的“页面”。判断标准：如果这个 `.vue` 文件是被 `router/index.js` 直接引用的，它就应该在 `views` 下。
*   **src/components/**: 存放“零件”。判断标准：如果在多个页面中都会用到（比如图表组件、上传按钮、顶部导航），它就在这里。
*   **局部组件**: 如果 `ModelsStep1` 只有在 `Models` 页面用到，建议在 `src/views/Models/` 下新建 `components` 文件夹存放，尽量保持全局 `src/components` 干净。

### 3.2 资源文件 (Assets)
*   **现状**: `public/images`, `assets/images`, `components/xx/img` 满天飞。
*   **规范**: 统一移动到 `src/assets/images`。在 Vue 组件中引用时使用 `@/assets/images/xxx.png`。
*   `public/` 目录只应该存放 `favicon.ico` 或如果不经打包直接引用的第三方巨型 js 库。

### 3.3 API 管理
*   不要把所有借口写在一个 `index.js` 里。
*   按功能模块拆分文件，例如 `user.js` (登录/注册), `data.js` (数据处理)。
*   在组件中引入：`import { getProjectList } from '@/api/projects'`。

### 3.4 命名规范 (Naming Convention)
*   **文件夹**: 统一使用 **PascalCase** (大驼峰)，例如 `DataDetail`, `UserBoard`。
*   **Vue 文件**: 统一使用 **PascalCase**，例如 `ProjectList.vue`。
*   **JS/资源文件**: 使用 **camelCase** (小驼峰) 或 **kebab-case** (串式)，例如 `userProfile.js` 或 `global.css`。

## 4. 迁移/重构建议步骤

1.  **创建文件夹结构**: 先在 `src` 下建立 `views`, `utils` 等空文件夹。
2.  **样式归位**: 重命名 `globol.css` -> `global.css`，将 `reset.css` 移入 `src/styles`并在 `main.js` 引入。
3.  **拆分页面**: 按照 `router/index.js` 的配置，将对应的组件从 `components/` 移动到 `views/`。
    *   *注意：移动后需要批量更新 import 路径。*
4.  **图片归位**: 将分散的图片移动到 `assets/images` 并更新引用。
5.  **重构路由**: 修改 `router/index.js` 指向新的 `views` 路径，并开启路由懒加载。
