<template>
  <div class="UploadZip">
    <div class="file-upload-container">
      <div class="upload-card">
        <h3 class="upload-title">上传ZIP文件</h3>

        <!-- 文件选择区域 -->
        <div
          class="drop-area"
          :class="{ 'is-dragover': isDragover }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <input
            type="file"
            id="fileInput"
            ref="fileInput"
            accept=".zip"
            @change="handleFileSelect"
            class="hidden"
          />

          <label for="fileInput" class="upload-label cursor-pointer">
            <i class="fa fa-cloud-upload text-4xl mb-2 text-primary"></i>
            <p v-if="!selectedFile">点击或拖拽文件到此处上传</p>
            <p v-else class="selected-file-name truncate">
              {{ selectedFile.name }}
            </p>
          </label>
        </div>

        <!-- 上传按钮 -->
        <button
          class="upload-button"
          :disabled="!selectedFile || isUploading"
          @click="uploadFile"
        >
          <img src="./img/火箭.png" alt="" />
          {{ isUploading ? "上传中..." : "开始上传" }}
        </button>

        <!-- 上传进度条 -->
        <div v-if="isUploading" class="progress-container mt-4">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
          <div class="progress-text">{{ progress }}%</div>
        </div>

        <!-- 上传结果 -->
        <div v-if="uploadSuccess" class="success-message mt-4">
          <i class="fa fa-check-circle text-green-500"></i>
          <p>上传成功！</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// 导入上传数据集接口
import { uploadDataset } from '@/api';

export default {
  name: "UploadZip",
  props: {
    // 从父组件接收数据集名称
    datasetName: {
      type: String,
      required: true
    },
    // 从父组件接收数据集类型
    datasetType: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      selectedFile: null,
      isDragover: false,
      errorMessage: "",
      isUploading: false,
      progress: 0,
      uploadSuccess: false,
    };
  },
  methods: {
    // 处理文件选择
    handleFileSelect(event) {
      const file = event.target.files[0];
      this.validateAndSetFile(file);
    },

    // 处理拖放事件
    handleDragOver(event) {
      event.preventDefault();
      this.isDragover = true;
    },

    handleDragLeave() {
      this.isDragover = false;
    },

    handleDrop(event) {
      event.preventDefault();
      this.isDragover = false;

      if (event.dataTransfer.files.length) {
        const file = event.dataTransfer.files[0];
        this.validateAndSetFile(file);
      }
    },

    // 验证并设置文件
    validateAndSetFile(file) {
      this.errorMessage = "";

      if (!file) {
        this.selectedFile = null;
        return;
      }

      // 验证文件类型
      if (!file.name.endsWith(".zip")) {
        this.errorMessage = "请上传ZIP格式的文件";
        this.selectedFile = null;
        return;
      }

      this.selectedFile = file;
    },

    // 上传文件 - 使用API接口
    async uploadFile() {
      if (!this.selectedFile) return;
      if (!this.datasetName || !this.datasetType) {
        this.errorMessage = "请先填写数据集名称和类型";
        return;
      }

      this.isUploading = true;
      this.progress = 0;
      this.uploadSuccess = false;
      this.errorMessage = "";

      try {
        // 调用上传接口，传入文件、名称和类型
        const result = await uploadDataset(
          this.selectedFile,
          this.datasetName,
          this.datasetType
        );
        
        // 上传成功处理
        this.isUploading = false;
        this.uploadSuccess = true;
        this.progress = 100;
        this.$message.success(`上传成功！数据集ID: ${result.dataset.dataset_id}`);
        // 通知父组件上传成功
        this.$emit('upload-success', result.dataset.dataset_id);
      } catch (error) {
        // 上传失败处理
        this.isUploading = false;
        this.errorMessage = `上传失败: ${error.message}`;
        this.$message.error(this.errorMessage);
        this.$emit('upload-fail', error.message);
      }
    },
  },
};
</script>

<style scoped>
/* 保持原样式不变 */
.file-upload-container {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.upload-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 24px;
  width: 100%;
  max-width: 600px;
}

.upload-title {
  margin-bottom: 20px;
  text-align: center;
  color: #333;
}

.drop-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.drop-area.is-dragover {
  border-color: #4285f4;
  background-color: #f8fafc;
}

.hidden {
  display: none;
}

.upload-label {
  display: block;
  color: #666;
}

.selected-file-name {
  font-weight: 500;
  color: #333;
}

.error-message {
  text-align: center;
}

.upload-button {
  width: 100%;
  background-color: #111f68;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  margin-top: 20px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  display: inline-flex; /* 使图片和文字横向排列 */
  align-items: center; /* 垂直居中对齐 */
  gap: 8px; /* 图片和文字之间的间距 */
}
.upload-button img {
  width: 20px; /* 根据需要调整宽度 */
  height: 20px; /* 根据需要调整高度 */
  object-fit: contain; /* 保持图片比例 */
  margin-left: 235px;
}

.upload-button:hover:not(:disabled) {
  background-color: #111f68;
}

.progress-container {
  height: 10px;
  background-color: #f3f3f3;
  border-radius: 5px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #4285f4;
  transition: width 0.3s;
}

.progress-text {
  text-align: center;
  margin-top: 5px;
  font-size: 14px;
  color: #666;
}

.success-message {
  text-align: center;
  color: #4caf50;
}
</style>