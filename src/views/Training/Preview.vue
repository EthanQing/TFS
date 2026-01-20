<template>
  <div class="PreviewPart">
    <div class="preview-container">
      <!-- 左侧控制栏 -->
      <div class="controls-panel">
        <div class="control-group">
          <div class="control-item">
            <label>置信阈值</label>
            <div class="slider-row">
              <el-slider
                v-model="value1"
                :min="0"
                :max="1"
                :step="0.01"
                :show-tooltip="false"
                class="compact-slider"
              ></el-slider>
              <span class="slider-value">{{ value1.toFixed(2) }}</span>
            </div>
          </div>
          <div class="control-item">
            <label>IoU阈值</label>
            <div class="slider-row">
              <el-slider
                v-model="value2"
                :min="0"
                :max="1"
                :step="0.01"
                :show-tooltip="false"
                class="compact-slider"
              ></el-slider>
              <span class="slider-value">{{ value2.toFixed(2) }}</span>
            </div>
          </div>
        </div>
        <button class="predict-btn" @click="onPredict">预 测</button>
      </div>

      <!-- 右侧预览区域 -->
      <div class="preview-panel">
        <div 
          class="image-preview-area" 
          :class="{ 'drag-over': isDragging }"
          @click="openFilePicker"
          @dragenter.prevent="onDragEnter"
          @dragover.prevent="onDragOver"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <div class="canvas-wrap">
            <img v-if="imageUrl" :src="imageUrl" class="preview-img" ref="img" @load="onImageLoad" />
            <div v-else class="placeholder">
              <i class="el-icon-upload"></i>
              <span>点击或拖拽图片到此处上传</span>
            </div>
            <canvas ref="canvas" class="overlay-canvas"></canvas>
          </div>
          <div class="action-bar" @click.stop>
            <el-upload
              class="upload-btn"
              ref="uploader"
              action="#"
              :show-file-list="false"
              :on-success="handleAvatarSuccess"
              :before-upload="beforeAvatarUpload"
              :http-request="doLocalUpload"
            >
              <i class="el-icon-upload2"></i>
              <span>上传图片</span>
            </el-upload>
            <button v-if="imageUrl" class="clear-btn" @click="clearImage">
              <i class="el-icon-delete"></i>
              <span>清除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <router-view></router-view>
  </div>
</template>

<script>
import {
  FetchDatasetType
} from "@/api/datasets";
import { GetInferenceResult, uploadInferenceImage, fetchModelVersionsByRunId, registerModelVersionFromRun } from "@/api/models";
import { previewStore } from "@/store/previewStore";
export default {
  name: "PreviewPart",
  data() {
    return {
      jobId: null,
      modelVersionId: null,
      imageSizes: ["320px", "640px"],
      activeSize: "320px", // 默认激活第一个按钮
      value1: 0.32,
      value2: 0.5,
      activeTab: "image", // 默认激活"图片"标签
      // 数据集类型接口返回
      datasetType: null,
      datasetTypeLoading: false,
      datasetTypeError: "",
      // 原 ClickShowImg 状态
      imageUrl: "",
      resizeObserver: null,
      // 拖拽状态
      isDragging: false,
    };
  },
  mounted() {
    // 获取当前的jobId
    this.getJobId();
    // 默认显示图片视图
    this.initDefaultView();
    // 调用接口：根据路由query中的 jobId 获取数据集类型
    this.fetchDatasetType();
    // 初始化图片预览区
    if (previewStore.imageUrl) this.imageUrl = previewStore.imageUrl;
    this.$nextTick(() => { this.redraw(); });
    this._onResult = () => this.$nextTick(() => { this.fitCanvasToImage(); this.redraw(); });
    this._onResize = () => this.$nextTick(() => { this.fitCanvasToImage(); this.redraw(); });
    window.addEventListener('preview-inference-updated', this._onResult);
    window.addEventListener('resize', this._onResize);
  },
  activated() {
    // 当使用keep-alive缓存的组件被激活时，检查jobId
    this.getJobId();
    this.fetchDatasetType();
  },
  beforeDestroy() {
    window.removeEventListener('preview-inference-updated', this._onResult);
    window.removeEventListener('resize', this._onResize);
  },
  methods: {
    setActiveSize(size) {
      this.activeSize = size;
    },

    async onPredict() {
      try {
        const jobId = this.$route?.query?.jobId || this.jobId;
        if (!jobId) {
          this.$message && this.$message.error("Missing jobId");
          return;
        }

        // Resolve model version for this training run.
        const modelVersionId = await this.resolveModelVersionId(jobId);
        if (!modelVersionId) {
          this.$message && this.$message.error("No model version found. Register a model version first.");
          return;
        }

        // If datasetType not loaded, try once.
        if (!this.datasetType) {
          await this.fetchDatasetType();
        }

        // Get current image URL/file
        let imageUrl = previewStore.imageUrl || "";
        const imageFile = previewStore.imageFile || null;

        // If blob/empty, upload to backend to get /static/temp path
        const isAccessible =
          imageUrl.startsWith("http://") ||
          imageUrl.startsWith("https://") ||
          imageUrl.startsWith("/static/");
        if ((!imageUrl || !isAccessible) && imageFile) {
          const uploadRes = await uploadInferenceImage(imageFile);
          imageUrl = uploadRes?.path || uploadRes?.url || uploadRes?.image_url || "";
        }

        if (!imageUrl) {
          this.$message &&
            this.$message.error(
              "Please upload an image or ensure the upload API returns a valid path."
            );
          return;
        }

        const conf = Math.max(0.001, Number(this.value1) || 0.001);
        const iou = Math.max(0.001, Number(this.value2) || 0.001);
        const payload = {
          model_version_id: Number(modelVersionId),
          conf,
          iou,
          input_meta: {
            job_id: jobId,
          },
        };
        const imgEl = this.$refs.img;
        if (imgEl?.naturalWidth && imgEl?.naturalHeight) {
          payload.input_meta.image_width = imgEl.naturalWidth;
          payload.input_meta.image_height = imgEl.naturalHeight;
        }

        if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
          payload.image_url = imageUrl;
        } else {
          payload.input_path = imageUrl;
        }

        const res = await GetInferenceResult(payload);
        if (res?.error_message) {
          throw new Error(res.error_message);
        }
        const mapped = this.mapInferenceResult(res);

        try {
          previewStore.setInferenceResult(mapped);
          window.dispatchEvent(new CustomEvent("preview-inference-updated"));
        } catch (e) {}

        this.$message && this.$message.success("Inference request sent");
        console.log("inference result", res);
      } catch (e) {
        this.$message && this.$message.error(e?.message || "Inference failed");
      }
    },
    async resolveModelVersionId(jobId) {
      if (this.modelVersionId) return this.modelVersionId;
      const id = String(jobId || '').trim();
      if (!id) return null;

      try {
        const list = await fetchModelVersionsByRunId(id, 1, 5);
        if (list && list.length) {
          const mv = list[0];
          const mvId = mv?.model_version_id || mv?.id;
          if (mvId != null) {
            this.modelVersionId = mvId;
            return mvId;
          }
        }
      } catch (e) {
        console.warn('fetchModelVersionsByRunId failed:', e?.message || e);
      }

      // Auto-register a development model version for preview if none exists.
      const version = `run-${String(id).slice(0, 8)}`;
      try {
        const created = await registerModelVersionFromRun({
          run_id: id,
          version,
          stage: 'development',
          description: 'Auto-created for preview inference',
        });
        const mvId = created?.model_version_id || created?.id;
        if (mvId != null) {
          this.modelVersionId = mvId;
          return mvId;
        }
      } catch (e) {
        console.warn('registerModelVersionFromRun failed:', e?.message || e);
        throw e;
      }

      return null;
    },
    mapInferenceResult(raw) {
      if (!raw) return raw;
      const output = raw.output || {};
      const preds = Array.isArray(output.predictions) ? output.predictions : [];
      const names = output.names && typeof output.names === 'object' ? output.names : {};
      const img = this.$refs.img;
      const width = Number(img?.naturalWidth) || Number(raw?.input_meta?.image_width) || 0;
      const height = Number(img?.naturalHeight) || Number(raw?.input_meta?.image_height) || 0;

      const boxes = preds.map((p) => {
        const xyxy = Array.isArray(p?.xyxy) ? p.xyxy : [];
        let x1 = Number(xyxy[0] ?? 0);
        let y1 = Number(xyxy[1] ?? 0);
        let x2 = Number(xyxy[2] ?? 0);
        let y2 = Number(xyxy[3] ?? 0);

        // If coordinates are in pixels, normalize using image size.
        const maxVal = Math.max(x1, y1, x2, y2);
        if (width > 0 && height > 0 && maxVal > 1.5) {
          x1 = x1 / width;
          x2 = x2 / width;
          y1 = y1 / height;
          y2 = y2 / height;
        }

        return {
          x1,
          y1,
          x2,
          y2,
          conf: Number(p?.confidence ?? p?.conf ?? 0),
          cls: p?.class_id ?? p?.cls,
          category_name: p?.class_name ?? names?.[p?.class_id],
        };
      });

      return {
        ...raw,
        boxes,
        polygons: Array.isArray(raw?.polygons) ? raw.polygons : [],
        image_width: width || raw?.image_width,
        image_height: height || raw?.image_height,
      };
    },
    setActiveTab(tab) {
      this.activeTab = tab;
    },
    getJobId() {
      // 优先从路由参数获取
      const routeJobId = this.$route.query.jobId;
      if (routeJobId) {
        if (this.jobId !== routeJobId) {
          this.modelVersionId = null;
        }
        this.jobId = routeJobId;
      } else {
        // 从localStorage获取
        const storedJobId = localStorage.getItem("currentJobId");
        if (storedJobId) {
          if (this.jobId !== storedJobId) {
            this.modelVersionId = null;
          }
          this.jobId = storedJobId;
        }
      }

      // 如果jobId存在，可以在这里加载与模型相关的预览配置
    },
    initDefaultView() {
      // 默认激活图片视图（不再依赖子路由）
      this.activeTab = 'image';
    },
    // 调用后端接口：获取数据集类型（传入路由 query 中的 jobId）
    async fetchDatasetType() {
      try {
        // 优先使用路由 query 的 jobId
        const qid = this.$route?.query?.jobId || this.jobId;
        if (!qid) return; // 无 jobId 不调用
        this.datasetTypeLoading = true;
        this.datasetTypeError = "";
        const res = await FetchDatasetType(qid);
        this.datasetType = res || null;
        // 可按需调试
        console.log("datasetType", this.datasetType);
      } catch (e) {
        this.datasetTypeError = e?.message || String(e);
        console.error("FetchDatasetType error:", this.datasetTypeError);
      } finally {
        this.datasetTypeLoading = false;
      }
    },
    // 以下为原 ClickShowImg 组件方法
    openFilePicker() {
      const up = this.$refs.uploader;
      const input = up && up.$el && up.$el.querySelector('input[type="file"]');
      if (input) input.click();
    },
    onImageLoad() {
      this.fitCanvasToImage();
      this.redraw();
    },
    fitCanvasToImage() {
      const img = this.$refs.img;
      const canvas = this.$refs.canvas;
      if (!canvas) return;
      const wrap = canvas.parentElement;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = w;
      canvas.height = h;
    },
    getRenderedImageRect() {
      const wrap = this.$el.querySelector('.canvas-wrap');
      const img = this.$refs.img;
      if (!wrap || !img) return null;
      
      // 获取容器尺寸
      const wrapRect = wrap.getBoundingClientRect();
      const wrapW = wrapRect.width;
      const wrapH = wrapRect.height;
      
      // 获取图片原始尺寸
      const naturalW = img.naturalWidth || previewStore.inferenceResult?.image_width;
      const naturalH = img.naturalHeight || previewStore.inferenceResult?.image_height;
      if (!naturalW || !naturalH) return null;
      
      // 获取图片实际渲染尺寸和位置
      const imgRect = img.getBoundingClientRect();
      
      // 计算图片相对于容器的偏移
      const offsetX = imgRect.left - wrapRect.left;
      const offsetY = imgRect.top - wrapRect.top;
      const drawW = imgRect.width;
      const drawH = imgRect.height;
      
      return { offsetX, offsetY, drawW, drawH };
    },
    redraw() {
      const res = previewStore.inferenceResult;
      const canvas = this.$refs.canvas;
      const ctx = canvas ? canvas.getContext('2d') : null;
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!res) return;
      const rect = this.getRenderedImageRect();
      if (!rect) return;
      const { offsetX, offsetY, drawW, drawH } = rect;
      ctx.lineWidth = 2;
      ctx.font = '12px sans-serif';
      ctx.textBaseline = 'top';
      if (res.boxes && res.boxes.length) {
        res.boxes.forEach((b) => {
          const x = offsetX + (b.x1 || 0) * drawW;
          const y = offsetY + (b.y1 || 0) * drawH;
          const w = ((b.x2 || 0) - (b.x1 || 0)) * drawW;
          const h = ((b.y2 || 0) - (b.y1 || 0)) * drawH;
          const color = 'rgba(17,31,104,0.95)';
          ctx.strokeStyle = color;
          ctx.strokeRect(x, y, Math.max(0, w), Math.max(0, h));
          const label = (b.category_name || b.cls || 'obj') + ` ${(b.conf*100).toFixed(1)}%`;
          const textW = ctx.measureText(label).width + 6;
          const textH = 16;
          ctx.fillStyle = color;
          ctx.fillRect(x, Math.max(offsetY, y - textH), textW, textH);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, x + 3, Math.max(offsetY, y - textH) + 2);
        });
      }
      if (res.polygons && res.polygons.length) {
        res.polygons.forEach((p) => {
          const colorStroke = 'rgba(0,160,0,0.95)';
          const colorFill = 'rgba(0,160,0,0.25)';
          const points = Array.isArray(p.points) ? p.points : [];
          if (!points.length) return;
          ctx.beginPath();
          if (Array.isArray(points[0])) {
            points.forEach((pt, idx) => {
              const px = offsetX + (pt[0] || 0) * drawW;
              const py = offsetY + (pt[1] || 0) * drawH;
              if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
          } else {
            for (let i = 0; i < points.length; i += 2) {
              const px = offsetX + (points[i] || 0) * drawW;
              const py = offsetY + (points[i + 1] || 0) * drawH;
              if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
          }
          ctx.closePath();
          ctx.fillStyle = colorFill;
          ctx.fill();
          ctx.strokeStyle = colorStroke;
          ctx.stroke();
          const name = (p.category_name || p.cls || 'obj');
          const conf = p.conf != null ? ` ${(p.conf*100).toFixed(1)}%` : '';
          const label = name + conf;
          const textW = ctx.measureText(label).width + 6;
          const textH = 16;
          let lx, ly;
          if (Array.isArray(points[0])) {
            lx = offsetX + (points[0][0] || 0) * drawW;
            ly = offsetY + (points[0][1] || 0) * drawH;
          } else {
            lx = offsetX + (points[0] || 0) * drawW;
            ly = offsetY + (points[1] || 0) * drawH;
          }
          ctx.fillStyle = colorStroke;
          ctx.fillRect(lx, Math.max(offsetY, ly - textH), textW, textH);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, lx + 3, Math.max(offsetY, ly - textH) + 2);
        });
      }
    },
    handleAvatarSuccess(res, file) {
      const raw = file?.raw || file;
      if (raw) {
        try {
          if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
            URL.revokeObjectURL(this.imageUrl);
          }
        } catch (e) {}
        this.imageUrl = URL.createObjectURL(raw);
        previewStore.set(raw, this.imageUrl);
        previewStore.setInferenceResult(null);
        this.$nextTick(() => { this.fitCanvasToImage(); this.redraw(); });
      }
    },
    doLocalUpload({ file, onSuccess, onError }) {
      try {
        if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.imageUrl);
        }
        this.imageUrl = URL.createObjectURL(file);
        previewStore.set(file, this.imageUrl);
        previewStore.setInferenceResult(null);
        onSuccess && onSuccess({ ok: true }, file);
        this.$nextTick(() => { this.fitCanvasToImage(); this.redraw(); });
      } catch (e) {
        onError && onError(e);
      }
    },
    beforeAvatarUpload(file) {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        this.$message.error('请上传图片格式的文件!');
        return false;
      }
      return true;
    },
    clearImage() {
      try {
        if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.imageUrl);
        }
      } catch (e) {}
      this.imageUrl = '';
      previewStore.clear();
      this.$nextTick(() => this.redraw());
    },
    // 拖拽上传相关方法
    onDragEnter(e) {
      this.isDragging = true;
    },
    onDragOver(e) {
      this.isDragging = true;
    },
    onDragLeave(e) {
      this.isDragging = false;
    },
    onDrop(e) {
      this.isDragging = false;
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.handleDroppedFile(file);
        } else {
          this.$message && this.$message.error('请上传图片格式的文件!');
        }
      }
    },
    handleDroppedFile(file) {
      try {
        if (this.imageUrl && this.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.imageUrl);
        }
      } catch (e) {}
      this.imageUrl = URL.createObjectURL(file);
      previewStore.set(file, this.imageUrl);
      previewStore.setInferenceResult(null);
      this.$nextTick(() => { this.fitCanvasToImage(); this.redraw(); });
    }
  },
};
</script>

<style scoped>
.PreviewPart {
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
}

.preview-container {
  display: flex;
  gap: 16px;
  align-items: stretch;
  height: 100%;
}

/* 左侧控制栏 - 纵向布局 */
.controls-panel {
  flex: 0 0 180px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-item label {
  font-size: 13px;
  font-weight: 600;
  color: #111f68;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-slider {
  width: 100%;
}

.slider-value {
  font-size: 14px;
  font-weight: 700;
  color: #111f68;
  text-align: center;
  background: #f3f4f6;
  padding: 6px 12px;
  border-radius: 6px;
}

.predict-btn {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  background: #111f68;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: auto;
}

.predict-btn:hover {
  background: #1a2d8a;
}

/* 右侧预览区域 */
.preview-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tab-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tab-item {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item.active {
  color: #111f68;
  background: #e0e7ff;
  font-weight: 600;
}

.image-preview-area {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 300px;
  background: #fff;
  border-radius: 12px;
  border: 2px dashed #e5e7eb;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* 拖拽时的视觉反馈 */
.image-preview-area.drag-over {
  border-color: #111f68;
  background: #f0f3f9;
  box-shadow: 0 0 0 4px rgba(17, 31, 104, 0.1);
}

.canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
}

.placeholder i {
  font-size: 48px;
}

.placeholder span {
  font-size: 14px;
}

.overlay-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.action-bar {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  z-index: 2;
}

.upload-btn, .clear-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover, .clear-btn:hover {
  background: #fff;
  border-color: #d1d5db;
}

.clear-btn {
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.3);
}

.upload-btn ::v-deep .el-upload {
  display: flex;
  align-items: center;
  gap: 6px;
}

.upload-btn ::v-deep .el-upload,
.upload-btn ::v-deep .el-upload-dragger {
  border: none;
  background: transparent;
  padding: 0;
  line-height: 1;
}

/* Element UI 滑块样式覆盖 */
::v-deep .el-slider__runway {
  height: 4px;
  background: #e5e7eb;
}

::v-deep .el-slider__bar {
  height: 4px;
  background: #111f68;
}

::v-deep .el-slider__button-wrapper {
  top: -15px;
}

::v-deep .el-slider__button {
  width: 14px;
  height: 14px;
  border-color: #111f68;
}

::v-deep .el-slider__button:hover {
  border-color: #111f68;
}

/* 响应式布局 */
@media (max-width: 900px) {
  .preview-container {
    flex-direction: column;
  }
  
  .controls-panel {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .control-group {
    flex: 1;
    flex-wrap: wrap;
  }
}
</style>
