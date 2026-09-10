import { API_BASE, getJson, postJson, patchJson, deleteJson } from "./apiUtils";

const ALARMS_BASE = `${API_BASE}/api/v3/alarms`;

function queryString(params) {
  const query = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "")
      query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const fetchAlarmRuleTypes = () => getJson(`${ALARMS_BASE}/rule-types`);
export const fetchAlarmRules = ({ page = 1, pageSize = 20, enabled } = {}) =>
  getJson(
    `${ALARMS_BASE}/rules${queryString({ page, page_size: pageSize, enabled })}`
  );
export const createAlarmRule = (payload) =>
  postJson(`${ALARMS_BASE}/rules`, payload);
export const updateAlarmRule = (ruleId, patch) =>
  patchJson(`${ALARMS_BASE}/rules/${encodeURIComponent(ruleId)}`, patch);
export const deleteAlarmRule = (ruleId) =>
  deleteJson(`${ALARMS_BASE}/rules/${encodeURIComponent(ruleId)}`);
export const evaluateAlarms = ({ runIds = [] } = {}) =>
  postJson(`${ALARMS_BASE}/evaluate`, { run_ids: runIds });
export const fetchActiveAlarms = ({
  page = 1,
  pageSize = 20,
  severity,
  ruleType,
  sourceId,
} = {}) =>
  getJson(
    `${ALARMS_BASE}/active${queryString({
      page,
      page_size: pageSize,
      severity,
      rule_type: ruleType,
      source_id: sourceId,
    })}`
  );
export const ackAlarmAlert = (alertId, { ackedBy }) =>
  postJson(`${ALARMS_BASE}/active/${encodeURIComponent(alertId)}/ack`, {
    acked_by: ackedBy,
  });
export const fetchAlarmHistory = ({
  page = 1,
  pageSize = 20,
  severity,
  ruleType,
  sourceId,
} = {}) =>
  getJson(
    `${ALARMS_BASE}/history${queryString({
      page,
      page_size: pageSize,
      severity,
      rule_type: ruleType,
      source_id: sourceId,
    })}`
  );
export const fetchAlarmSummary = () => getJson(`${ALARMS_BASE}/summary`);
