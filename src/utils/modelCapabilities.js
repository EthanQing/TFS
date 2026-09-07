const BUILTIN_RUNTIME_ENGINES = new Set([
  "ultralytics-yolo",
  "paddle-det",
]);

export function normalizeModelEngine(engine) {
  return String(engine || "").trim().toLowerCase();
}

export function supportsRuntimeExecution(engine) {
  return BUILTIN_RUNTIME_ENGINES.has(normalizeModelEngine(engine));
}

export function supportsInference(engine) {
  return supportsRuntimeExecution(engine);
}

export function supportsEvaluation(engine) {
  return supportsRuntimeExecution(engine);
}

export function supportsDeployment(engine) {
  return supportsRuntimeExecution(engine);
}

export function supportsQualification(engine) {
  return supportsRuntimeExecution(engine);
}

export function supportsResumeTraining(engine) {
  return supportsRuntimeExecution(engine);
}

export function supportsTrainingExport(engine) {
  return normalizeModelEngine(engine) === "ultralytics-yolo";
}
