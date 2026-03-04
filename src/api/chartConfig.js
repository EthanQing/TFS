import { API_BASE } from "@/utils/request";

async function safeJson(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}

function normStr(v) {
    return String(v ?? "").trim();
}

// fetchChartConfig - GET /api/v2/chart-configs/{scope}
export async function fetchChartConfig(scope) {
    try {
        const s = normStr(scope) || "training_charts";
        const res = await fetch(`${API_BASE}/api/v2/chart-configs/${encodeURIComponent(s)}`);
        const data = await safeJson(res);
        if (!res.ok) return {};
        return data || {};
    } catch (error) {
        console.error("fetchChartConfig error:", error);
        return {};
    }
}

// saveChartConfig - PUT /api/v2/chart-configs/{scope}
export async function saveChartConfig(scope, config) {
    try {
        const s = normStr(scope) || "training_charts";
        const res = await fetch(`${API_BASE}/api/v2/chart-configs/${encodeURIComponent(s)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config || {}),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.detail || "save failed");
        return data;
    } catch (error) {
        console.error("saveChartConfig error:", error);
        throw error;
    }
}
