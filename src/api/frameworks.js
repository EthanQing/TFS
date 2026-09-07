import { API_BASE, postJson } from "./apiUtils";

export async function validateFrameworkConfig(pluginId, config) {
  const id = String(pluginId ?? "").trim();
  if (!id) throw new Error("缺少 plugin_id");

  return postJson(
    `${API_BASE}/api/v3/frameworks/${encodeURIComponent(id)}/validate-config`,
    { config }
  );
}
