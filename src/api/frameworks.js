import { API_BASE, getJson, postJson } from "./apiUtils";

export async function fetchFrameworks({ implemented } = {}) {
  const query = typeof implemented === "boolean"
    ? `?implemented=${implemented}`
    : "";
  const data = await getJson(`${API_BASE}/api/v3/frameworks${query}`);

  if (!Array.isArray(data)) throw new Error("训练框架插件列表响应格式错误");
  return data;
}

export async function fetchFrameworkConfigSchema(pluginId) {
  const id = String(pluginId ?? "").trim();
  if (!id) throw new Error("缺少 plugin_id");

  return getJson(
    `${API_BASE}/api/v3/frameworks/${encodeURIComponent(id)}/config-schema`
  );
}

export async function validateFrameworkConfig(pluginId, config) {
  const id = String(pluginId ?? "").trim();
  if (!id) throw new Error("缺少 plugin_id");

  return postJson(
    `${API_BASE}/api/v3/frameworks/${encodeURIComponent(id)}/validate-config`,
    { config }
  );
}
