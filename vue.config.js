const { defineConfig } = require('@vue/cli-service')
const appConfig = require('./app.config.js')

module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave: false,

  // 设置页面标题
  chainWebpack: config => {
    config.plugin('html').tap(args => {
      args[0].title = appConfig.appTitle
      return args
    })
  },

  devServer: {
    proxy: {
      '/api': {
        target: 'http://192.168.2.102:18001/api/datasets'
      }
    }
  }
})
