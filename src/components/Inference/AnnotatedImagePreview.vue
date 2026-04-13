<template>
  <div class="annotated-preview" ref="wrap">
    <img
      v-if="imageUrl"
      ref="img"
      :src="imageUrl"
      :alt="alt"
      class="annotated-image"
      @load="handleImageLoad"
    />
    <div v-else class="annotated-empty">
      <i class="el-icon-picture-outline"></i>
      <span>{{ emptyText }}</span>
    </div>
    <canvas ref="canvas" class="annotated-canvas"></canvas>
  </div>
</template>

<script>
import {
  formatPredictionLabel,
  normalizeInferencePredictions,
} from "@/utils/inferencePreview";

export default {
  name: "AnnotatedImagePreview",
  props: {
    imageUrl: {
      type: String,
      default: "",
    },
    predictions: {
      type: [Array, Object],
      default: () => [],
    },
    alt: {
      type: String,
      default: "preview",
    },
    emptyText: {
      type: String,
      default: "图源未就绪",
    },
    showLabels: {
      type: Boolean,
      default: true,
    },
    showConfidence: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      naturalWidth: 0,
      naturalHeight: 0,
      onResize: null,
    };
  },
  computed: {
    normalizedPredictions() {
      return normalizeInferencePredictions(this.predictions, {
        imageWidth: this.naturalWidth,
        imageHeight: this.naturalHeight,
      });
    },
  },
  mounted() {
    this.onResize = () => {
      this.$nextTick(() => this.redraw());
    };
    window.addEventListener("resize", this.onResize);
    this.$nextTick(() => this.redraw());
  },
  beforeDestroy() {
    if (this.onResize) window.removeEventListener("resize", this.onResize);
  },
  watch: {
    imageUrl() {
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.$nextTick(() => this.redraw());
    },
    predictions: {
      deep: true,
      handler() {
        this.$nextTick(() => this.redraw());
      },
    },
  },
  methods: {
    handleImageLoad() {
      const img = this.$refs.img;
      this.naturalWidth = Number(img?.naturalWidth) || 0;
      this.naturalHeight = Number(img?.naturalHeight) || 0;
      this.$nextTick(() => this.redraw());
    },
    fitCanvas() {
      const wrap = this.$refs.wrap;
      const canvas = this.$refs.canvas;
      if (!wrap || !canvas) return null;

      const cssWidth = Math.max(1, Math.round(wrap.clientWidth || 0));
      const cssHeight = Math.max(1, Math.round(wrap.clientHeight || 0));
      const dpr = Math.max(1, window.devicePixelRatio || 1);

      if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, cssWidth, cssHeight };
    },
    getRenderedImageRect() {
      const wrap = this.$refs.wrap;
      const img = this.$refs.img;
      if (!wrap || !img) return null;
      const wrapRect = wrap.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      if (!imgRect.width || !imgRect.height) return null;

      return {
        offsetX: imgRect.left - wrapRect.left,
        offsetY: imgRect.top - wrapRect.top,
        drawW: imgRect.width,
        drawH: imgRect.height,
      };
    },
    redraw() {
      const canvasState = this.fitCanvas();
      if (!canvasState) return;
      const { ctx, cssWidth, cssHeight } = canvasState;
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const img = this.$refs.img;
      if (!img || !img.complete || !this.imageUrl) return;

      const rect = this.getRenderedImageRect();
      if (!rect) return;
      const { offsetX, offsetY, drawW, drawH } = rect;

      ctx.lineWidth = 2;
      ctx.font = "12px sans-serif";
      ctx.textBaseline = "top";

      this.normalizedPredictions.forEach((prediction) => {
        const x = offsetX + prediction.x1 * drawW;
        const y = offsetY + prediction.y1 * drawH;
        const w = (prediction.x2 - prediction.x1) * drawW;
        const h = (prediction.y2 - prediction.y1) * drawH;
        const classSeed = Number(prediction.classId);
        const seed = Number.isFinite(classSeed) ? classSeed : 0;
        const color = `rgba(${(37 * (seed + 3)) % 255}, ${(17 * (seed + 7)) % 255}, ${(29 * (seed + 11)) % 255}, 0.95)`;

        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, Math.max(0, w), Math.max(0, h));

        const label = formatPredictionLabel(prediction, {
          showLabels: this.showLabels,
          showConfidence: this.showConfidence,
        });
        if (!label) return;

        const textW = ctx.measureText(label).width + 8;
        const textH = 18;
        const textX = Math.max(offsetX, x);
        const textY = Math.max(offsetY, y - textH);
        ctx.fillStyle = color;
        ctx.fillRect(textX, textY, textW, textH);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, textX + 4, textY + 2);
      });
    },
  },
};
</script>

<style scoped>
.annotated-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.annotated-image {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.annotated-canvas {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.annotated-empty {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #94a3b8;
}
</style>
