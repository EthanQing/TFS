<template>
  <div class="PreviewPart">
    <!-- <span class="title">测试</span>
    <span class="message">预览你的模型</span> -->
    <div class="PartWrap">
      <div class="leftPart">
        <!-- <span>设置</span> -->
        <!-- <div class="firstLine">
          <span>图片尺寸</span>
          <button
            v-for="(size, index) in imageSizes"
            :key="index"
            :class="{ active: activeSize === size }"
            @click="setActiveSize(size)"
          >
            {{ size }}
          </button>
        </div> -->
        <div class="dataPart">
          <div class="data-item">
            <span>置信阈值</span>
            <div
              class="slider-container"
              style="display: flex; align-items: center"
            >
              <el-slider
                v-model="value1"
                :min="0"
                :max="1"
                :step="0.01"
                :show-tooltip="false"
                style="flex: 1; margin: 0 8px"
              ></el-slider>
              <span style="width: 50px; text-align: left; color: #111f68">{{
                value1.toFixed(2)
              }}</span>
            </div>
          </div>
          <div class="data-item">
            <span>IoU阈值</span>
            <div
              class="slider-container"
              style="display: flex; align-items: center"
            >
              <el-slider
                v-model="value2"
                :min="0"
                :max="1"
                :step="0.01"
                :show-tooltip="false"
                style="flex: 1; margin: 0 8px"
              ></el-slider>
              <span style="width: 50px; text-align: left; color: #111f68">{{
                value2.toFixed(2)
              }}</span>
              <button class="postImg" @click="onPredict">预 测</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="rightPart">
      <div class="clickChangePart">
        <div
          :class="{ active: activeTab === 'image' }"
          @click="setActiveTab('image')"
        >
          图片
        </div>
        <!-- <div
            :class="{ active: activeTab === 'camera' }"
            @click="setActiveTab('camera'), clickShowCamera()"
          >
            相机
          </div> -->
      </div>
      <!-- 内嵌原 ClickShowImg 组件的功能 -->
      <div class="ClickShowImg">
        <div class="upload-area" @click="openFilePicker">
          <div class="canvas-wrap">
            <img
              v-if="imageUrl"
              :src="imageUrl"
              class="preview-img"
              ref="img"
              @load="onImageLoad"
            />
            <div v-else class="placeholder"></div>
            <canvas ref="canvas" class="overlay-canvas"></canvas>
          </div>
          <div class="bottom-actions" @click.stop>
            <el-upload
              class="upload-trigger"
              ref="uploader"
              action="#"
              :show-file-list="false"
              :on-success="handleAvatarSuccess"
              :before-upload="beforeAvatarUpload"
              :http-request="doLocalUpload"
            >
              <i class="el-icon-upload"></i>
              <span>上传图片</span>
            </el-upload>
            <button v-if="imageUrl" class="clear-trigger" @click="clearImage">
              <i class="el-icon-delete"></i>
              <span>清除图片</span>
            </button>
          </div>
        </div>
      </div>

      <router-view></router-view>
    </div>
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
      const wrapW = wrap.clientWidth;
      const wrapH = wrap.clientHeight;
      const naturalW = img.naturalWidth || previewStore.inferenceResult?.image_width;
      const naturalH = img.naturalHeight || previewStore.inferenceResult?.image_height;
      if (!naturalW || !naturalH) return null;
      const scale = Math.min(wrapW / naturalW, wrapH / naturalH);
      const drawW = naturalW * scale;
      const drawH = naturalH * scale;
      const offsetX = (wrapW - drawW) / 2;
      const offsetY = (wrapH - drawH) / 2;
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
    }
  },
};
</script>

<style scoped>
.PreviewPart {
  display: flex;
  flex-direction: column;
  color: #111f68;
  margin-left: 20px;
}
.title {
  font-size: 20px;
  margin-bottom: 10px;
}
.message {
  font-size: 15px;
  margin-bottom: 25px;
}
.leftPart > span {
  font-size: 15px;
}
.firstLine {
  margin-top: 15px;
  font-size: 15px;
  margin-left: 10px;
  display: flex;
  align-items: center;
}
.firstLine span {
  /* 缩小标题与按钮的间距，让按钮左移 */
  margin-right: 330px;
  margin-bottom: 20px;
}
.firstLine button {
  width: 60px;
  height: 40px;
  border-radius: 15px;
  margin: 0 5px;
  transition: all 0.3s;
  border: 1px solid #111f68;
  background-color: white;
  color: #111f68;
  margin-bottom: 20px;
}
.firstLine button.active {
  background-color: #111f68;
  color: white;
}
.dataPart {
  margin-left: 10px;
  font-size: 15px;
  display: flex; /* 横向两列布局 */
  flex-direction: row;
  align-items: flex-start;
  gap: 24px; /* 两项之间的间距 */
  flex-wrap: wrap; /* 根据空间决定是否换行 */
}
.data-item {
  display: flex;
  align-items: center;
  flex: 1 1 calc(50% - 12px); /* 两列等分，扣除间距的一半 */
  min-width: 300px; /* 单项最小宽度更大，滑轨更长 */
  margin: 0; /* 间距由 gap 控制 */
}
.data-item span {
  width: 80px; /* 缩小左侧标签宽度，为滑轨腾出更多空间 */
  margin-right: 20px;
  white-space: nowrap; /* 防止中文标签被挤压成竖排 */
}
.slider-container {
  width: 100%; /* 自适应伸展，替代固定宽度 */
  position: relative;
}
.postImg {
  margin-left: 8px;
  padding: 6px 12px;
  font-size: 16px;
  line-height: 1;
  background: #111f68;
  color: #fff;
  border: 1px solid #111f68;
  border-radius: 14px;
  cursor: pointer;
  position: absolute;
  top: 0px;
  right: -250px;
}
.postImg:hover {
  background: #1e2d7d;
}
/* 修改Element UI滑块的颜色 */
::v-deep .el-slider__bar {
  background-color: #111f68 !important;
}
/* 稍微加粗滑轨和拖拽圆点，提升观感 */
::v-deep .el-slider__runway {
  height: 6px;
}
::v-deep .el-slider__bar {
  height: 6px;
}
::v-deep .el-slider__button {
  width: 14px;
  height: 14px;
}
::v-deep .el-slider__button {
  border-color: #111f68 !important;
}
::v-deep .el-slider__button:hover {
  border-color: #111f68 !important;
}
::v-deep .el-slider__button:active {
  box-shadow: 0 0 0 2px rgba(17, 31, 104, 0.2) !important;
}
.clickChangePart {
  margin-top: 25px;
  margin-left: 20px;
  display: flex;
}
.clickChangePart div {
  width: 70px;
  height: 40px;
  color: #111f68;
  text-align: center;
  line-height: 40px;
  font-size: 16px;
  margin: 0 5px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.clickChangePart div.active {
  border-bottom: 2px solid #111f68;
  font-weight: bold;
}
.PartWrap {
  display: flex;
}

.rightPart {
  margin-left: 10px;
  flex: 1 1 auto; /* 右侧区域自适应扩展 */
}
/* 固定左侧设置栏的宽度，避免因上方按钮布局改变而影响进度条长度 */
.leftPart {
  flex: 0 0 900px; /* 进一步加宽，拉长滑轨 */
  max-width: 900px;
}

/* ---- 以下为原 ClickShowImg 样式 ---- */
.ClickShowImg {
  width: 100%;
  height: auto;
}
.upload-area {
  margin-top: 10px;
  width: 70%;
  height: 55vh;
  background: #fff;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}
.canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bottom-actions {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  z-index: 2;
}
.upload-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #111f68;
  font-size: 14px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(17, 31, 104, 0.15);
  border-radius: 16px;
  cursor: pointer;
}
.clear-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #a94442;
  font-size: 14px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(169, 68, 66, 0.3);
  border-radius: 16px;
}
.clear-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.upload-trigger ::v-deep .el-upload,
.upload-trigger ::v-deep .el-upload-dragger {
  border: none;
  background: transparent;
  padding: 0;
}
.placeholder {
  width: 100%;
  height: 100%;
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.overlay-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.upload-trigger i {
  font-size: 16px;
}

/* 窄屏下改为纵向堆叠，防止拥挤 */
@media (max-width: 900px) {
  .PartWrap {
    flex-direction: column;
  }
  .leftPart {
    flex: 1 1 auto;
    max-width: none;
    width: 100%;
  }
  .dataPart {
    flex-direction: column; /* 小屏改为纵向 */
    gap: 16px;
    flex-wrap: nowrap;
  }
  .data-item {
    min-width: 0;
  }
  .rightPart {
    margin-left: 0;
  }
}
</style>
