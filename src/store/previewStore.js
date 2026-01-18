// 轻量级的全局状态，用于在上传组件与预测组件之间共享当前图片文件与预览URL
export const previewStore = {
  imageFile: null, // 原始 File 对象
  imageUrl: "",   // 预览 URL（可能是 blob: 或 http(s)/static 路径）
  inferenceResult: null, // 最近一次推理结果
  set(file, url) {
    this.imageFile = file || null;
    this.imageUrl = url || "";
  },
  setInferenceResult(res) {
    this.inferenceResult = res || null;
  },
  clear() {
    this.imageFile = null;
    this.imageUrl = "";
    this.inferenceResult = null;
  }
};
