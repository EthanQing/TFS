const fs = require('fs');
const path = require('path');
const { defineConfig } = require('@vue/cli-service');
const appConfig = require('./app.config.js');

function parseSimpleEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw.split(/\r?\n/).reduce((acc, line) => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) return acc;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
  } catch (_) {
    return {};
  }
}

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizeProxyTarget(value) {
  const raw = trimTrailingSlash(value);
  if (!raw) return '';
  return isAbsoluteHttpUrl(raw) ? raw : `http://${raw}`;
}

function resolveDevApiTarget() {
  const explicitTarget = [
    process.env.VUE_APP_DEV_API_TARGET,
    process.env.VUE_APP_API_PROXY_TARGET,
  ].find((value) => String(value || '').trim());
  if (explicitTarget) {
    return normalizeProxyTarget(explicitTarget);
  }

  const explicitApiBase = trimTrailingSlash(process.env.VUE_APP_API_BASE);
  if (isAbsoluteHttpUrl(explicitApiBase)) {
    return explicitApiBase;
  }

  const backendEnv = parseSimpleEnvFile(path.resolve(__dirname, '../TBS/.env'));
  const host = trimTrailingSlash(process.env.VUE_APP_DEV_API_HOST || '127.0.0.1') || '127.0.0.1';
  const port = String(process.env.BACKEND_PORT || backendEnv.BACKEND_PORT || '18001').trim() || '18001';
  return normalizeProxyTarget(`${host}:${port}`);
}

const DEV_API_TARGET = resolveDevApiTarget();
console.log(`[TFS] dev proxy /api -> ${DEV_API_TARGET}`);

module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,
  productionSourceMap: false,

  // 设置页面标题
  chainWebpack: config => {
    config.plugin('html').tap(args => {
      args[0].title = appConfig.appTitle
      return args
    })
  },

  devServer: {
    client: {
      overlay: false
    },
    proxy: {
      '/api': {
        target: DEV_API_TARGET,
        changeOrigin: true,
        ws: true,
        secure: false,
        proxyTimeout: 300000
      },
      '/static': {
        target: DEV_API_TARGET,
        changeOrigin: true,
        secure: false,
        proxyTimeout: 300000
      }
    }
  }
});
