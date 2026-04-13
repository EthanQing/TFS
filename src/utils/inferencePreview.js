function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp01(value) {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  return Math.min(1, Math.max(0, n));
}

function resolveNamesMap(source) {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    if (source.names && typeof source.names === "object" && !Array.isArray(source.names)) {
      return source.names;
    }
    if (source.output && typeof source.output === "object" && source.output.names && typeof source.output.names === "object") {
      return source.output.names;
    }
  }
  return {};
}

export function extractInferencePredictions(source) {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];
  if (Array.isArray(source.predictions)) return source.predictions;
  if (source.output && typeof source.output === "object" && Array.isArray(source.output.predictions)) {
    return source.output.predictions;
  }
  return [];
}

function resolveBox(prediction) {
  if (!prediction || typeof prediction !== "object") return null;

  if (Array.isArray(prediction.xyxy) && prediction.xyxy.length >= 4) {
    return {
      x1: toFiniteNumber(prediction.xyxy[0]),
      y1: toFiniteNumber(prediction.xyxy[1]),
      x2: toFiniteNumber(prediction.xyxy[2]),
      y2: toFiniteNumber(prediction.xyxy[3]),
    };
  }

  if (Array.isArray(prediction.bbox) && prediction.bbox.length >= 4) {
    return {
      x1: toFiniteNumber(prediction.bbox[0]),
      y1: toFiniteNumber(prediction.bbox[1]),
      x2: toFiniteNumber(prediction.bbox[2]),
      y2: toFiniteNumber(prediction.bbox[3]),
    };
  }

  if (Array.isArray(prediction.box) && prediction.box.length >= 4) {
    return {
      x1: toFiniteNumber(prediction.box[0]),
      y1: toFiniteNumber(prediction.box[1]),
      x2: toFiniteNumber(prediction.box[2]),
      y2: toFiniteNumber(prediction.box[3]),
    };
  }

  const x1 = toFiniteNumber(prediction.x1 ?? prediction.left ?? prediction.xmin);
  const y1 = toFiniteNumber(prediction.y1 ?? prediction.top ?? prediction.ymin);
  const x2 = toFiniteNumber(prediction.x2 ?? prediction.right ?? prediction.xmax);
  const y2 = toFiniteNumber(prediction.y2 ?? prediction.bottom ?? prediction.ymax);
  if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
    return { x1, y1, x2, y2 };
  }

  const x = toFiniteNumber(prediction.x);
  const y = toFiniteNumber(prediction.y);
  const width = toFiniteNumber(prediction.width ?? prediction.w);
  const height = toFiniteNumber(prediction.height ?? prediction.h);
  if (x !== null && y !== null && width !== null && height !== null) {
    return {
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height,
    };
  }

  return null;
}

function normalizeBox(box, { imageWidth = 0, imageHeight = 0 } = {}) {
  if (!box) return null;
  let { x1, y1, x2, y2 } = box;
  if ([x1, y1, x2, y2].some((v) => v === null)) return null;

  x1 = Number(x1);
  y1 = Number(y1);
  x2 = Number(x2);
  y2 = Number(y2);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;

  const maxAbs = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));
  const usePixels = imageWidth > 0 && imageHeight > 0 && maxAbs > 1.5;
  if (usePixels) {
    x1 /= imageWidth;
    x2 /= imageWidth;
    y1 /= imageHeight;
    y2 /= imageHeight;
  }

  const nx1 = clamp01(x1);
  const ny1 = clamp01(y1);
  const nx2 = clamp01(x2);
  const ny2 = clamp01(y2);
  if ([nx1, ny1, nx2, ny2].some((v) => v === null)) return null;
  if (nx2 <= nx1 || ny2 <= ny1) return null;

  return { x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
}

export function normalizeInferencePredictions(source, options = {}) {
  const predictions = extractInferencePredictions(source);
  const names = resolveNamesMap(source);
  const imageWidth = Math.max(0, Number(options.imageWidth) || 0);
  const imageHeight = Math.max(0, Number(options.imageHeight) || 0);

  return predictions
    .map((prediction) => {
      const box = normalizeBox(resolveBox(prediction), { imageWidth, imageHeight });
      if (!box) return null;

      const classId = prediction.class_id ?? prediction.classId ?? prediction.cls ?? null;
      const confidence = toFiniteNumber(prediction.confidence ?? prediction.conf ?? prediction.score);
      const className = prediction.class_name
        || prediction.className
        || prediction.category_name
        || (classId != null ? names?.[classId] : null)
        || (classId != null ? `class_${classId}` : "obj");

      return {
        ...box,
        classId,
        className,
        confidence,
      };
    })
    .filter(Boolean);
}

export function formatPredictionLabel(prediction, { showLabels = true, showConfidence = true } = {}) {
  if (!prediction || typeof prediction !== "object") return "";
  const parts = [];
  if (showLabels) parts.push(String(prediction.className || prediction.classId || "obj"));
  if (showConfidence && Number.isFinite(Number(prediction.confidence))) {
    parts.push(`${(Number(prediction.confidence) * 100).toFixed(1)}%`);
  }
  return parts.join(" ");
}
