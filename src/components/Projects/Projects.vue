<template>
  <div class="projects">
    <!-- 顶部区域 -->
    <div class="top">
      <h3>项目</h3>
      <button @click="dialogFormVisible = true">创建项目</button>
    </div>

    <!-- 搜索和导航区域 -->
    <div class="secondFloor">
      <!-- <i class="el-icon-s-operation" @click="changeShow"></i> -->
      <el-input
        v-model="searchQuery"
        placeholder="请输入项目名称"
        class="input"
      ></el-input>
      <div class="topNavigation">
        <el-menu
          :default-active="activeIndex"
          class="el-menu-demo"
          mode="horizontal"
          @select="handleSelect"
        >
          <el-menu-item index="1" class="nav-item">全部</el-menu-item>
        </el-menu>
      </div>
    </div>

    <!-- 项目列表区域 -->
    <div class="showList">
      <div class="project-grid">
        <div
          v-for="project in filteredProjects"
          :key="project.project_id"
          @click="goProjectsDetail(project)"
          class="project-card"
        >
          <div class="card-header">
            <div class="project-image">
              <img :src="getImageSource(project.imageUrl)" alt="项目图片" />
            </div>
            <div class="status-badge">
              <i class="el-icon-unlock"></i>
            </div>
          </div>
          
          <div class="card-content">
            <h3 class="project-title">{{ project.project_name }}</h3>
            <p class="project-description">{{ project.description && project.description.trim() ? project.description : '暂无描述' }}</p>
            <p class="project-dataset-name">关联的数据集：{{ project.dataset?.dataset_name || '无' }}</p>
            
            <div class="project-meta">
              <div class="meta-item">
                <i class="el-icon-time"></i>
                <span>{{ formatDate(project.created_at) }}</span>
              </div>
            </div>
            
            <div class="project-stats">
              <div class="stat-item">
                <span class="stat-value">{{ project.completed_models_count }}</span>
                <span class="stat-label">模型</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ formatSize(project.total_size_mb) }}</span>
                <span class="stat-label">大小</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建项目对话框 -->
    <el-dialog title="创建项目" :visible.sync="dialogFormVisible" width="800px">
      <el-form :model="form" :rules="rules" ref="formRef">
        <span class="dialog-description">使用项目将相似模型组合在一起</span>
        <el-form-item
          label="项目名称"
          :label-width="formLabelWidth"
          prop="name"
        >
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item
          label="描述"
          :label-width="formLabelWidth"
          prop="description"
        >
          <el-input v-model="form.description" autocomplete="off"></el-input>
        </el-form-item>

        <!-- 数据集关联部分 -->
        <el-form-item
          label="关联数据集"
          :label-width="formLabelWidth"
          prop="dataset"
        >
          <el-select
            v-model="form.dataset"
            placeholder="请选择数据集"
            clearable
            filterable
          >
            <el-option
              v-for="dataset in datasetList"
              :key="dataset.dataset_id"
              :label="dataset.dataset_name"
              :value="dataset.dataset_id"
            >
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogFormVisible = false">取 消</el-button>
        <el-button type="primary" @click="handleCreateProject">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { fetchProjects, fetchDatasets, createProject, FetchProjectModelsSize } from "@/api";
export default {
  name: "Projects",
  data() {
    return {
      searchQuery: "", // 搜索关键词
      activeIndex: "1",
      isShow: true,
      activeButton: "model",
      dialogFormVisible: false,
      form: { name: "", description: "", dataset: "" , user: "" },
      formLabelWidth: "120px",
      projects: [],
      datasetList: [],
      rules: {
        name: [{ required: true, message: "请输入项目名称", trigger: "blur" }],
        description: [
          {message: "请输入项目描述", trigger: "blur" },
        ],
  "dataset": [{ required: true, message: "请选择数据集", trigger: "blur" }]
      },
    };
  },
  computed: {
    // 实时筛选项目列表
    filteredProjects() {
      // 如果没有搜索关键词，返回所有项目
      if (!this.searchQuery) {
        return this.projects;
      }
      
      // 转换为小写以实现不区分大小写的搜索
      const query = this.searchQuery.toLowerCase();
      
      // 只根据项目名称进行筛选
      return this.projects.filter(project => 
        project.project_name.toLowerCase().includes(query)
      );
    }
  },
  methods: {
    // 处理图片路径（支持本地和网络图片）
    getImageSource(src) {
      // 使用静态导入避免 webpack 警告
      const defaultImage = require("../Models/images/image.png");
      
      if (!src) return defaultImage;
      if (src.startsWith("data:image") || src.startsWith("http")) return src;
      
      // 对于相对路径，直接返回默认图片避免动态 require
      return defaultImage;
    },

    // 导航菜单选择
    handleSelect(key, keyPath) {
      this.activeIndex = key;
    },

    // 切换分类方式显示
    changeShow() {
      this.isShow = !this.isShow;
    },

    // 设置激活的分类按钮
    setActiveButton(button) {
      this.activeButton = button;
    },

    // 跳转到项目详情
    async goProjectsDetail(project) {
      // 确保项目对象已经包含最新的模型数量和大小信息
      if (project.project_id && (project.completed_models_count === undefined || !project.total_size_mb)) {
        console.log("项目缺少模型数量或大小信息，重新获取:", project.project_id);
        try {
          // 直接获取项目模型大小信息
          const sizeResult = await FetchProjectModelsSize(project.project_id);
          console.log("获取到的项目模型信息:", sizeResult);
          
          // 更新项目对象
          project.completed_models_count = sizeResult.completed_models_count || 0;
          project.total_size_mb = sizeResult.total_size_mb || '0MB';
          
          // 立即保存到localStorage，确保数据被更新
          console.log("更新后的项目信息:", project);
          localStorage.setItem('currentProject', JSON.stringify(project));
        } catch (error) {
          console.error(`获取项目 ${project.project_id} 的模型大小失败:`, error);
          // 设置默认值
          project.completed_models_count = 0;
          project.total_size_mb = '0MB';
        }
      } else {
        console.log("项目已包含模型数量和大小信息:", project);
      }
      
      // 保存项目信息到localStorage，以便其他组件访问
      localStorage.setItem('currentProject', JSON.stringify(project));
      
      // 执行路由跳转
      if (this.$route.path !== "/projectsdetail") {
        this.$router.push({
          path: "/projectsdetail",
          query: {
            projectId: project.project_id,
            projectName: project.project_name,
            modelCount: project.completed_models_count || 0,
            modelSize: project.total_size_mb || '0MB'
          }
        });
      }
    },

    // 创建新项目
    async handleCreateProject() {
      this.$refs.formRef.validate(async (valid) => {
        if (valid) {
          // 创建新项目对象
          const newProject = {
            project_name: this.form.name,
            description: this.form.description,
            dataset_id: this.form.dataset,
            // created_by 字段已移除，后端若有默认将自动填充
            created_by:''
          };

          try {
            console.log("创建项目数据:", newProject);
            const result = await createProject(newProject);
            console.log("创建项目结果:", result);
          } catch (error) {
            console.error("创建项目失败:", error);
            this.$message.error("创建项目失败，请稍后再试");
            return;
          }

          // 添加到项目列表
          this.projects.unshift(newProject);
          this.$message({ message: "项目创建成功", type: "success" });

          // 重置状态
          this.resetForm();
        } else {
          this.$message.error("请填写必填字段");
          return false;
        }
      });
    },

    // 重置表单状态
    resetForm() {
      this.dialogFormVisible = false;
  this.form = { name: "", description: "", dataset: ""};
    },
    async fetchProjectsList() {
      try {
        const result = await fetchProjects();
        this.projects = result;
        // console.log("获取项目列表:", this.projects);
        
        // 为每个项目获取模型大小信息
        for (const project of this.projects) {
          const projectId = project.project_id;
          // console.log("项目ID:", projectId);
          
          try {
            // 获取项目模型大小
            const sizeResult = await FetchProjectModelsSize(projectId);
            // console.log("项目模型大小:", sizeResult);
            
            // 将结果保存到对应的项目对象中
            project.completed_models_count = sizeResult.completed_models_count || 0;
            project.total_size_mb = sizeResult.total_size_mb || '0MB';
            
          } catch (error) {
            console.error(`获取项目 ${projectId} 的模型大小失败:`, error);
            // 设置默认值，避免显示错误
            project.completed_models_count = 0;
            project.total_size_mb = '0MB';
          }
        }
        
        // 强制更新视图以确保数据变化被检测到
        this.$forceUpdate();
        
      } catch (error) {
        console.error("获取项目列表失败:", error);
      }
    },
    async fetchDatasetsList() {
      try {
        const result = await fetchDatasets();
        // console.log("获取数据集列表:", result);
        this.datasetList = result;
      } catch (error) {
        console.error("获取数据集列表失败:", error);
      }
    },

    // 格式化日期
    formatDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN');
    },

    // 格式化大小，确保都有MB单位
    formatSize(size) {
      if (!size) return '0MB';
      
      // 如果已经包含MB单位，直接返回
      if (typeof size === 'string' && size.includes('MB')) {
        return size;
      }
      
      // 如果是数字或者纯数字字符串，添加MB单位
      const numericSize = typeof size === 'string' ? parseFloat(size) : size;
      if (!isNaN(numericSize)) {
        return `${numericSize}MB`;
      }
      
      // 默认返回0MB
      return '0MB';
    },
  },
  mounted() {
    this.fetchProjectsList();
    this.fetchDatasetsList();
  },
};
</script>


<style scoped>
.projects {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
  box-sizing: border-box;
  width: calc(100% - 20px);
  min-width: 800px;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px; /* 新增底部间距 */
}
.top h3 {
  font-size: 24px;
  font-weight: bolder;
  color: #111f68;
}
.top button {
  width: 112px;
  height: 40px;
  border-radius: 20px;
  background-color: #111f68;
  color: #fff;
  line-height: 40px;
  font-weight: 450;
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 14px;
}
/* secondFloor 部分样式 */
.secondFloor {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 20px; /* 新增底部间距 */
}
.input {
  margin-right: 10px;
  width: 300px;
  max-width: 500px;
}

/* 导航菜单样式 */
.el-menu-demo {
  display: flex;
  border-bottom: none !important;
}
.el-menu-demo .nav-item {
  margin: 0 10px !important;
  min-width: 80px !important;
  text-align: center !important;
}
.el-menu-demo .el-menu-item.is-active {
  color: #111f68 !important;
  border-bottom: 2px solid #111f68 !important;
}

/* 项目列表网格布局 */
.showList {
  width: 100%;
  background-color: #FBFCFD;
  padding: 20px;
  border-radius: 12px;
  box-sizing: border-box;
  margin-left: -20px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  width: 100%;
  justify-content: start;
}

/* 项目卡片样式 */
.project-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  cursor: pointer;
  overflow: hidden;
  border: 1px solid #e8ecef;
  width: 100%;
  max-width: none;
}

.project-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* 卡片头部 */
.card-header {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-image {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-image img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
}

.status-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

/* 卡片内容 */
.card-content {
  padding: 20px;
}

.project-title {
  font-size: 18px;
  font-weight: 600;
  color: #111f68;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.project-description {
  font-size: 14px;
  color: #6c757d;
  margin: 0 0 16px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2; /* 新增标准属性 */
  -webkit-box-orient: vertical;
  overflow: hidden;
  /* 保持无描述时仍占位（两行高度：14px * 1.5 * 2 ≈ 42px） */
  min-height: 42px;
}

/* 项目元信息 */
.project-meta {
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #8e9aaf;
}

.meta-item i {
  margin-right: 6px;
  font-size: 14px;
}

/* 项目统计 */
.project-stats {
  display: flex;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid #e8ecef;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #111f68;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #8e9aaf;
}

/* 移除旧的列表样式 */
.showList ul,
.showList ul li {
  display: none;
}

/* 创建项目对话框样式 */
.el-dialog {
  width: 600px !important; /* 固定宽度为500px */
}

.dialog-title,
.dialog-description {
  display: block; /* 转为块级元素 */
  margin-bottom: 30px; /* 底部间距20px */
  font-size: 16px;
  color: #111f68;
}

.dialog-description {
  font-size: 14px;
  color: #666;
  margin-top: 10px; /* 顶部额外间距 */
}

/* 表单样式优化 */
.el-form-item {
  margin-bottom: 20px !important; /* 增加表单项间距 */
}

.el-input {
  width: 80%; /* 输入框占满宽度 */
}

/* 按钮区域样式 */
.dialog-footer {
  padding: 10px 20px !important; /* 调整底部内边距 */
}
.el-button {
  background-color: #111f68;
  color: #fff;
  border-color: #111f68;
  border-radius: 20px;
}

.avatar-uploader .el-upload {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.avatar-uploader .el-upload:hover {
  border-color: #409eff;
}
.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 178px;
  height: 178px;
  line-height: 178px;
  text-align: center;
}
.avatar {
  width: 178px;
  height: 178px;
  display: block;
}
.avatar-uploader {
  margin-left: 260px;
  border: 1px solid rgba(17, 31, 104, 0.5);
  width: 25%;
}
.clickShow span {
  color: #111f68;
  font-weight: 500;
  font-size: 15px;
}
.buttons {
  margin: 20px 0;
}
.buttons button {
  width: 70px;
  height: 34px;
  background-color: #f3f3f3;
  border-radius: 15px;
  color: #111f68;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
}
.buttons button:nth-child(2) {
  margin: 0 10px;
}
/* 激活状态的按钮样式 */
.buttons button.active {
  background-color: #111f68;
  color: #fff;
}
.project-dataset-name{
  margin-bottom: 10px;
  font-size: 14px;
}

/* 响应式布局 */
@media (max-width: 1400px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 18px;
  }
}

@media (max-width: 1200px) {
  .projects {
    margin-left: 5px;
  }
  
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }
  
  .showList {
    padding: 15px;
  }
}

@media (max-width: 992px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .projects {
    margin-left: 0;
    min-width: auto;
    width: 100%;
  }
  
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 15px;
  }
  
  .showList {
    padding: 10px;
  }
  
  .secondFloor {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .input {
    margin: 0;
    width: 100%;
    max-width: none;
  }
}

@media (max-width: 576px) {
  .project-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .project-card {
    max-width: none;
  }
  
  .top button {
    position: static;
    margin-top: 10px;
  }
  
  .top {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* 超大屏幕优化 */
@media (min-width: 1600px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }
}

@media (min-width: 1920px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }
}

@media (min-width: 2560px) {
  .project-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 24px;
  }
}
</style>
