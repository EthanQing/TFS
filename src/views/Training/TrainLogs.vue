<template>
  <div class="train-logs">
    <div class="toolbar">
      <el-radio-group v-model="which" size="small" @change="restart">
        <el-radio-button label="stdout">stdout</el-radio-button>
        <el-radio-button label="stderr">stderr</el-radio-button>
        <el-radio-button label="both">全部</el-radio-button>
      </el-radio-group>

      <div class="spacer"></div>

      <el-switch v-model="autoScroll" active-text="自动滚动" inactive-text="手动滚动" />
      <el-button size="small" @click="clearLogs">清空</el-button>
      <el-button size="small" type="primary" class="custom-primary-btn" @click="downloadLogs">
        下载日志
      </el-button>
    </div>

    <div v-if="error" class="error">
      <i class="el-icon-error"></i>
      <span>{{ error }}</span>
    </div>

    <div class="log-box" ref="box">
      <div v-if="lines.length === 0" class="log-empty">暂无日志</div>
      <div v-for="(line, idx) in lines" :key="idx" class="log-line" :class="lineClass(line)">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script>
import { API_BASE } from "@/utils/request";

export default {
  name: "TrainLogs",
  inject: ["$API_BASE", "$WS_BASE"],
  data() {
    return {
      jobId: null,
      which: "stdout",
      lines: [],
      ws: null,
      error: null,
      autoScroll: true,
      connecting: false,
      maxLines: 8000,
    };
  },
  watch: {
    "$route.query.jobId": {
      immediate: true,
      handler(newJobId) {
        const id = String(newJobId || "").trim();
        if (!id) return;
        if (this.jobId !== id) {
          this.jobId = id;
          try {
            localStorage.setItem("currentJobId", id);
          } catch (_) {
            0; // ignore storage errors
          }
          this.restart();
        }
      },
    },
  },
  activated() {
    const stored = localStorage.getItem("currentJobId");
    if (!this.jobId && stored) {
      this.jobId = stored;
      this.restart();
    } else if (!this.ws || this.ws.readyState !== 1) {
      this.connect();
    }
  },
  deactivated() {
    // Avoid keeping background WS connections when the tab is not visible (keep-alive).
    this.close();
  },
  beforeDestroy() {
    this.close();
  },
  methods: {
    restart() {
      this.error = null;
      this.lines = [];
      this.close();
      this.connect();
    },
    close() {
      if (this.ws) {
        try {
          this.ws.close();
        } catch (_) {
          0;
        }
        this.ws = null;
      }
    },
    deriveWsBase() {
      // Prefer explicit WS_BASE from app, otherwise derive from HTTP base.
      let wsBase = (this.$WS_BASE && this.$WS_BASE()) || "";
      if (wsBase) return wsBase;

      const isHttps = window.location.protocol === "https:";
      const httpBase = (this.$API_BASE && this.$API_BASE()) || window.location.origin;
      return httpBase.replace(/^http(s?):\/\//, isHttps ? "wss://" : "ws://");
    },
    connect() {
      if (!this.jobId) return;
      if (this.connecting) return;
      this.connecting = true;

      const wsBase = this.deriveWsBase();
      const url = `${wsBase}/api/v2/training-runs/${encodeURIComponent(
        this.jobId
      )}/logs/stream?which=${encodeURIComponent(this.which)}&tail=500`;

      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          this.connecting = false;
        };
        this.ws.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data || "{}");
            this.handleMessage(payload);
          } catch (_) {
            0;
          }
        };
        this.ws.onerror = () => {
          this.connecting = false;
          this.error = "日志连接失败（WebSocket）";
        };
        this.ws.onclose = () => {
          this.connecting = false;
        };
      } catch (e) {
        this.connecting = false;
        this.error = "无法创建日志 WebSocket 连接";
      }
    },
    lineClass(line) {
      const s = String(line || "");
      if (s.startsWith("[stderr]")) return "stderr";
      if (s.startsWith("[stdout]")) return "stdout";
      return "";
    },
    prefixFor(which) {
      if (this.which !== "both") return "";
      if (which === "stderr") return "[stderr] ";
      if (which === "stdout") return "[stdout] ";
      return "";
    },
    appendLines(which, newLines, mode) {
      const prefix = this.prefixFor(which);
      const arr = Array.isArray(newLines) ? newLines : [];
      if (!arr.length) return;

      // Tail is treated as reset for its stream.
      if (mode === "tail") {
        // If both, keep what already appended from the other stream.
        if (this.which === "both") {
          const keep = this.lines.filter((l) => {
            const s = String(l || "");
            if (which === "stdout") return !s.startsWith("[stdout]");
            if (which === "stderr") return !s.startsWith("[stderr]");
            return true;
          });
          this.lines = keep;
        } else {
          this.lines = [];
        }
      }

      const mapped = arr.map((l) => prefix + String(l));
      this.lines = this.lines.concat(mapped);
      if (this.lines.length > this.maxLines) {
        this.lines = this.lines.slice(this.lines.length - this.maxLines);
      }

      if (this.autoScroll) {
        this.$nextTick(() => {
          const box = this.$refs.box;
          if (!box) return;
          box.scrollTop = box.scrollHeight;
        });
      }
    },
    handleMessage(payload) {
      if (!payload) return;
      if (payload.type === "error") {
        const msg = payload.data && payload.data.message;
        this.error = msg || "日志流错误";
        return;
      }

      if (payload.type === "log" && payload.data) {
        const which = payload.data.which || "stdout";
        const mode = payload.data.mode || "append";
        const lines = payload.data.lines || [];
        this.appendLines(which, lines, mode);
        return;
      }

      if (payload.type === "done") {
        // Backend closes shortly after this.
        return;
      }
    },
    downloadLogs() {
      if (!this.jobId) return;

      const pick = (w) => {
        const name = w === "stderr" ? "train.stderr.log" : "train.stdout.log";
        return `/static/training/${encodeURIComponent(this.jobId)}/logs/${name}`;
      };

      let url = pick("stdout");
      if (this.which === "stderr") url = pick("stderr");

      // If "both", download stdout by default (UI has live merged view).
      const href = `${API_BASE}${url}`;
      const a = document.createElement("a");
      a.href = href;
      a.download = "";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    clearLogs() {
      this.lines = [];
    },
  },
};
</script>

<style scoped>
.train-logs {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.spacer {
  flex: 1 1 auto;
}

.error {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f56c6c;
  padding: 8px 10px;
  border: 1px solid rgba(245, 108, 108, 0.35);
  background: rgba(245, 108, 108, 0.08);
  border-radius: 8px;
  font-size: 13px;
}

.log-box {
  height: 520px;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid #e8ecef;
  background: #0b1024;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.55;
  color: #e6e8ee;
}

.log-empty {
  color: rgba(230, 232, 238, 0.7);
  padding: 8px 0;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-word;
}

.log-line.stderr {
  color: #ffb4b4;
}

.log-line.stdout {
  color: #e6e8ee;
}

.custom-primary-btn {
  background: linear-gradient(135deg, #111f68 0%, #0d1554 100%) !important;
  border-color: #111f68 !important;
  color: #fff !important;
}
</style>
