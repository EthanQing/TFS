const ENGINE_FRAMEWORK_MAP = {
  "ultralytics-yolo": { frameworkKey: "pytorch", frameworkLabel: "PyTorch" },
  "paddle-det": { frameworkKey: "paddle", frameworkLabel: "Paddle" },
};

function normalizeEngine(engine) {
  return String(engine ?? "").trim().toLowerCase();
}

function normalizeFrameworkInput(input) {
  if (input && typeof input === "object") {
    const key = String(
      input.frameworkKey ?? input.framework_key ?? ""
    ).trim();
    const label = String(
      input.frameworkLabel ?? input.framework_label ?? ""
    ).trim();
    if (key) {
      return {
        frameworkKey: key,
        frameworkLabel: label || key,
      };
    }
    return resolveFramework(input.engine);
  }
  return resolveFramework(input);
}

export function resolveFramework(engine) {
  const normalizedEngine = normalizeEngine(engine);
  if (!normalizedEngine) {
    return { frameworkKey: "engine:unknown", frameworkLabel: "Engine: unknown" };
  }
  const mapped = ENGINE_FRAMEWORK_MAP[normalizedEngine];
  if (mapped) return mapped;
  return {
    frameworkKey: `engine:${normalizedEngine}`,
    frameworkLabel: `Engine: ${normalizedEngine}`,
  };
}

export function isFrameworkCompatible(left, right) {
  const l = normalizeFrameworkInput(left);
  const r = normalizeFrameworkInput(right);
  return String(l.frameworkKey || "") === String(r.frameworkKey || "");
}
