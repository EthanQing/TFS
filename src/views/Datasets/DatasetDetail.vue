<template>
    <div class="datadetail">
        <!-- topPart部分 -->
        <div class="topPart">
            <div class="leftInfo">
                <span class="datasetName">{{ datasetName || '' }}</span>
            </div>
            <!-- rightMessage部分移到这里 -->
            <div class="rightMessage">
                <div class="messageItem">
                    <span class="label">任务</span>
                    <div class="taskWrap">
                        <span>{{ getDatasetTypeLabel(datasetType) }}</span>
                    </div>
                </div>
                <div class="messageItem">
                    <span class="label">图片</span>
                    <div class="imgWrap">
                        <span>{{ formatImageCount(numImages) }}</span>
                    </div>
                </div>
                <div class="messageItem">
                    <span class="label">大小</span>
                    <div class="sizeWrap">
                        <span>{{ formatDatasetSize(datasetSize) }}</span>
                    </div>
                </div>
            </div>
        </div>
        <!-- selectPart部分（仅展示“图片”） -->
        <div class="selectPart">
            <div class="active">图片</div>
        </div>
        <div class="showPart">
            <div class="imagesPart">
                <div class="leftPart">
                    <div class="search-container">
                        <el-input 
                            v-model="input" 
                            placeholder="输入关键词搜索分类" 
                            prefix-icon="el-icon-search" 
                            class="elInput"
                            clearable
                            @input="handleSearchInput"
                            @clear="clearSearch"
                        ></el-input>
                        <div class="search-tip" v-if="input.trim() && classList.length > 0">
                            正在搜索: "{{ input }}"
                        </div>
                    </div>
                    <div v-if="detailLoading" class="loading">
                        <p>加载中...</p>
                    </div>
                    <ul class="list" v-else-if="filteredClassList.length || !input.trim()">
                        <li 
                            v-for="classInfo in filteredClassList" 
                            :key="classInfo.class_id"
                            :class="{ 'selected': selectedClass && selectedClass.class_id === classInfo.class_id }"
                            @click="selectClass(classInfo)"
                        >
                            <div class="circle"></div>
                            <span class="firstNumber">{{ classInfo.class_id }}</span>
                            <span class="className">
                                <span v-if="input.trim()" v-html="highlightText(classInfo.class_name, input)"></span>
                                <span v-else>{{ classInfo.class_name }}</span>
                            </span>
                            <span class="secondNumber">{{ classInfo.image_count }}</span>
                        </li>
                        <li 
                            :class="{ 'selected': selectedClass === null }"
                            @click="selectClass(null)"
                            class="all-option"
                        >
                            <div class="circle all-circle"></div>
                            <span class="firstNumber">全部</span>
                            <span class="className">所有分类</span>
                            <span class="secondNumber">{{ datasetDetail ? datasetDetail.total_images : 0 }}</span>
                        </li>
                    </ul>
                    <div v-else-if="input.trim() && classList.length > 0" class="no-results">
                        <i class="el-icon-search"></i>
                        <p>没有找到匹配的分类<br>"{{ input }}"</p>
                        <el-button type="text" @click="clearSearch">清除搜索</el-button>
                    </div>
                    <div v-else-if="classList.length === 0 && !detailLoading" class="no-results">
                        <i class="el-icon-warning-outline"></i>
                        <p>此数据集未包含任何分类</p>
                    </div>
                </div>
                <div class="rightPart">
                    <div v-if="detailLoading" class="loading">
                        <p>加载图片中...</p>
                    </div>
                    <ul v-else>
                        <li 
                            v-for="(image, index) in selectedImages" 
                            :key="`${image.image_name}-${index}`"
                            :title="`${image.image_name} - ${image.objects_count} 个目标`"
                        >
                            <div class="image-container" @click="openImagePreview(image)">
                                <img 
                                    :src="image.image_url" 
                                    :alt="image.image_name"
                                    class="preview-image"
                                    @error="handleImageError"
                                />
                                <div class="image-overlay">
                                    <span class="objects-count">{{ image.objects_count }} 目标</span>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
                <div v-if="showImagePreview" class="image-preview-modal" @click="closeImagePreview">
                    <div class="modal-content" @click.stop>
                        <img 
                            :src="previewImage.image_url" 
                            :alt="previewImage.image_name"
                            class="modal-image"
                            @error="handleModalImageError"
                        />
                        <div class="modal-info">
                            <h3>{{ previewImage.image_name }}</h3>
                            <p>目标数量: {{ previewImage.objects_count }}</p>
                            <p v-if="previewImage.classes_in_image && previewImage.classes_in_image.length">
                                包含分类: {{ getClassNames(previewImage.classes_in_image) }}
                            </p>
                        </div>
                        <button class="close-btn" @click="closeImagePreview">&times;</button>
                    </div>
                </div>
            </div>
        </div>
        
    </div>
</template>

<script>
import{FetchDatasetDetail} from '@/api/datasets';
export default {
    name: 'DataDetail',
    data() {
        return {
            datasetId: '',
            datasetName: '',
            datasetType: '',
            numClasses: 0,
            numImages: 0,
            datasetSize: '',
            // 新增：数据集详情数据
            datasetDetail: null,
            detailLoading: false,
            // imagesPart 状态
            input: '',
            selectedClass: null,
            selectedImages: [],
            showImagePreview: false,
            previewImage: null,
            searchTimeout: null,
            debouncedSearch: null
        }
    },
    created() {
        // 从路由query参数中获取数据
        this.loadDataFromRoute();
    },
    mounted() {
        document.addEventListener('keydown', this.handleKeydown);
        this.debouncedSearch = this.debounce(() => {}, 300);
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleKeydown);
        document.body.style.overflow = 'auto';
    },
    computed: {
        classList() {
            if (!this.datasetDetail || !this.datasetDetail.classes) return [];
            return this.datasetDetail.classes;
        },
        imagesList() {
            if (!this.datasetDetail || !this.datasetDetail.images) return [];
            return this.datasetDetail.images;
        },
        filteredClassList() {
            if (!this.input.trim()) return this.classList;
            return this.classList.filter(cls =>
                cls.class_name.toLowerCase().includes(this.input.toLowerCase())
            );
        }
    },
    watch: {
        // 监听路由变化，当路由参数改变时重新加载数据
        '$route': {
            handler(to, from) {
                // 只有当query参数真正改变时才重新加载数据
                const oldQuery = from ? from.query : {};
                const newQuery = to.query;
                
                // 检查关键参数是否有变化
                const keyParams = ['datasetId', 'datasetName', 'datasetType', 'numClasses', 'numImages', 'datasetSize'];
                const hasChanged = keyParams.some(key => oldQuery[key] !== newQuery[key]);
                
                if (hasChanged || !from) {
                    // console.log('路由参数发生变化，重新加载数据');
                    this.loadDataFromRoute();
                } else {
                    console.log('仅路由路径变化，保持现有数据');
                }
            },
            immediate: true // 立即执行一次
        },
        // 监听数据集详情变化
        datasetDetail: {
            handler(newDetail) {
                if (newDetail) {
                    // 默认显示所有图片（去重）
                    this.selectedImages = this.imagesList.filter((img, index, self) =>
                        index === self.findIndex(item => item.image_name === img.image_name)
                    );
                }
            },
            immediate: true
        }
    },
    methods: {
        loadDataFromRoute() {
            // 从路由query参数中获取数据
            this.datasetId = this.$route.query.datasetId || '';
            this.datasetName = this.$route.query.datasetName || 'Fashion-MNIST';
            this.datasetType = this.$route.query.datasetType || 'classification';
            this.numClasses = parseInt(this.$route.query.numClasses) || 0;
            this.numImages = parseInt(this.$route.query.numImages) || 7000;
            this.datasetSize = this.$route.query.datasetSize || '47.0MB';
            
            // console.log('DataDetail接收到的数据:', {
            //     datasetId: this.datasetId,
            //     datasetName: this.datasetName,
            //     datasetType: this.datasetType,
            //     numClasses: this.numClasses,
            //     numImages: this.numImages,
            //     datasetSize: this.datasetSize
            // });
            
            // 加载路由数据后，立即获取数据集详情
            this.fetchDatasetDetail();
        },
        // 搜索输入处理
        handleSearchInput() {
            if (this.debouncedSearch) this.debouncedSearch();
        },
        clearSearch() {
            this.input = '';
        },
        highlightText(text, query) {
            if (!query || !query.trim()) return text;
            try {
                const regex = new RegExp(`(${query.trim()})`, 'gi');
                return text.replace(regex, '<span class="highlight-text">$1</span>');
            } catch (e) {
                return text;
            }
        },
        selectClass(classInfo) {
            this.selectedClass = classInfo;
            if (classInfo && classInfo.class_id !== undefined) {
                const filteredImages = this.imagesList.filter(img => {
                    const hasClass = img.classes_in_image &&
                        img.classes_in_image.includes(classInfo.class_id);
                    return hasClass;
                });
                const uniqueImages = filteredImages.filter((img, index, self) =>
                    index === self.findIndex(item => item.image_name === img.image_name)
                );
                this.selectedImages = uniqueImages;
            } else {
                const uniqueImages = this.imagesList.filter((img, index, self) =>
                    index === self.findIndex(item => item.image_name === img.image_name)
                );
                this.selectedImages = uniqueImages;
            }
        },
        handleImageError(event) {
            event.target.style.display = 'none';
            const container = event.target.parentNode;
            if (container && !container.querySelector('.image-error')) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'image-error';
                errorDiv.textContent = '图片加载失败';
                container.appendChild(errorDiv);
            }
        },
        openImagePreview(image) {
            this.previewImage = image;
            this.showImagePreview = true;
            document.body.style.overflow = 'hidden';
        },
        closeImagePreview() {
            this.showImagePreview = false;
            this.previewImage = null;
            document.body.style.overflow = 'auto';
        },
        handleModalImageError(event) {
            event.target.style.display = 'none';
            const container = event.target.parentNode;
            if (container && !container.querySelector('.modal-error')) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'modal-error';
                errorDiv.textContent = '图片加载失败';
                container.appendChild(errorDiv);
            }
        },
        getClassNames(classIds) {
            if (!this.classList || !classIds) return '';
            return classIds.map(id => {
                const classInfo = this.classList.find(cls => cls.class_id === id);
                return classInfo ? classInfo.class_name : `class_${id}`;
            }).join(', ');
        },
        handleKeydown(event) {
            if (event.key === 'Escape' && this.showImagePreview) {
                this.closeImagePreview();
            } else if (event.key === 'Escape' && this.input) {
                this.clearSearch();
            }
        },
        debounce(func, wait) {
            return () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => { func(); }, wait);
            };
        },
        
        
        // 格式化图片数量显示
        formatImageCount(count) {
            if (!count) return '0';
            if (count >= 1000) {
                return (count / 1000).toFixed(1) + 'K';
            }
            return count.toString();
        },
        
        // 格式化数据集大小显示
        formatDatasetSize(sizeStr) {
            if (!sizeStr) return '0MB';
            // 如果已经是格式化的字符串，直接返回
            if (typeof sizeStr === 'string' && sizeStr.includes('MB')) {
                return sizeStr;
            }
            // 如果是数字，添加MB单位
            if (typeof sizeStr === 'number') {
                return sizeStr.toFixed(1) + 'MB';
            }
            return sizeStr;
        },
        
        // 获取数据集类型的中文显示
        getDatasetTypeLabel(type) {
            const typeMap = {
                'detection': '目标检测',
                'segmentation': '实例分割',
                'classification': '分类',
                'detect': '检测',
                'segment': '分割',
                'classify': '分类'
            };
            return typeMap[type] || type || 'Classify';
        },
        // 获取数据集详情
        async fetchDatasetDetail() {
            if (!this.datasetId) return;

            this.detailLoading = true;
            try {
                const detail = await FetchDatasetDetail(this.datasetId);
                console.log('获取到的数据集详情:', detail);
                
                // 保存详情数据到组件状态
                this.datasetDetail = detail;
                
                // 可以选择更新基本信息（如果API返回的数据更准确）
                if (detail.dataset_name) this.datasetName = detail.dataset_name;
                if (detail.dataset_type) this.datasetType = detail.dataset_type;
                if (detail.num_classes) this.numClasses = detail.num_classes;
                if (detail.total_images) this.numImages = detail.total_images;
                if (detail.dataset_size_mb) this.datasetSize = detail.dataset_size_mb;
                
            } catch (error) {
                console.error('获取数据集详情失败:', error);
                this.datasetDetail = null;
            } finally {
                this.detailLoading = false;
            }
        }
    }
}
</script>

<style scoped>
.datadetail {
    max-width: 100%;
    padding: 0 20px;
    box-sizing: border-box;
}

.topPart {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    padding: 15px 0;
}

.leftInfo {
    flex: 1;
    min-width: 200px;
}

.datasetName {
    font-size: 24px;
    font-weight: bold;
    color: #111F68;
}

.rightMessage {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    align-items: center;
}

.messageItem {
    display: flex;
    align-items: center;
    gap: 8px;
}

.label {
    font-size: 14px;
    color: #666;
    white-space: nowrap;
}

.taskWrap, .imgWrap, .sizeWrap {
    padding: 8px 12px;
    height: auto;
    min-width: 60px;
    background-color: #F3F3F3;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 8px;
    font-size: 14px;
    color: #111F68;
    font-weight: 500;
    white-space: nowrap;
}

.taskWrap {
    min-width: 75px;
}

.selectPart {
    display: flex;
    margin-top: 20px;
}

.selectPart div {
    padding: 12px 20px;
    font-size: 15px;
    cursor: pointer;
    color: #666;
    border-bottom: 3px solid transparent;
    transition: all 0.3s ease;
    white-space: nowrap;
}

.selectPart div:hover {
    color: #111F68;
}

/* 激活状态的样式 */
.selectPart .active {
    color: #111F68;
    border-bottom-color: #111F68;
    font-weight: 500;
}

.showPart {
    width: 100%;
    max-width: 100%;
    min-height: 500px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    margin-top: 10px;
    border-radius: 8px;
    overflow: hidden;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .datadetail {
        padding: 0 10px;
    }
    
    .topPart {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
    }
    
    .leftInfo {
        width: 100%;
    }
    
    .datasetName {
        font-size: 20px;
    }
    
    .rightMessage {
        width: 100%;
        justify-content: flex-start;
        gap: 15px;
    }
    
    .messageItem {
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
    }
    
    .selectPart {
        overflow-x: auto;
        white-space: nowrap;
    }
    
    .selectPart div {
        padding: 10px 15px;
        font-size: 14px;
    }
    
    .showPart {
        margin-top: 15px;
    }
}

@media (max-width: 480px) {
    .datasetName {
        font-size: 18px;
    }
    
    .rightMessage {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
    
    .taskWrap, .imgWrap, .sizeWrap {
        font-size: 12px;
        padding: 6px 10px;
    }
}

/* imagesPart 样式合并 */
.imagesPart{
    display: flex;
    gap: 15px;
    padding: 15px;
}
.leftPart {
    flex: 0 0 250px;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 280px);
}
.rightPart {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 280px);
}
.search-container { margin-bottom: 15px; flex-shrink: 0; }
.search-tip { font-size: 12px; color: #606266; margin-top: 5px; padding-left: 10px; }
.elInput{ width: 100%; margin-bottom: 5px; flex-shrink: 0; }
.elInput ::v-deep .el-input__inner { font-size: 15px; height: 42px; }
.highlight-text { background-color: rgba(255, 192, 105, 0.5); color: #111F68; font-weight: bold; border-radius: 2px; padding: 0 2px; }
.loading, .no-results { text-align: center; padding: 20px; color: #666; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; }
.no-results i { font-size: 36px; color: #909399; margin-bottom: 15px; }
.no-results p { margin-bottom: 15px; line-height: 1.5; }
.list { flex: 1; overflow-y: auto; padding-right: 8px; margin: 0; padding-left: 0; }
.rightPart > ul { flex: 1; overflow-y: auto; padding-right: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 15px; padding: 0 8px 0 0; margin: 0; align-content: start; }
.rightPart > ul::-webkit-scrollbar { width: 6px; }
.rightPart > ul::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.rightPart > ul::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.rightPart > ul::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
.list::-webkit-scrollbar { width: 6px; }
.list::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.list::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
.list::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
.list li{ width: 100%; height: 45px; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; padding: 0 12px; cursor: pointer; transition: background-color 0.3s ease; box-sizing: border-box; }
.list li:hover{ background-color: #F3F3F3; }
.list li.selected { background-color: #111F68; color: white; }
.list li.selected .circle { background-color: white; }
.circle{ width: 12px; height: 12px; background-color: #4CAF50; border-radius: 50%; margin-right: 12px; flex-shrink: 0; }
.all-circle { background-color: #2196F3; }
.firstNumber{ width: 40px; font-size: 15px; flex-shrink: 0; }
.className { flex: 1; font-size: 15px; margin-right: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.secondNumber{ font-size: 15px; font-weight: 500; flex-shrink: 0; }
.rightPart ul li{ width: 100%; height: 140px; background-color: #F8F9FA; border-radius: 6px; border: 1px solid #E9ECEF; cursor: pointer; transition: all 0.3s ease; box-sizing: border-box; overflow: hidden; position: relative; }
.rightPart ul li:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.image-container { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.preview-image { width: 100%; height: 100%; object-fit: cover; border-radius: 6px; }
.image-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); color: white; padding: 8px; text-align: center; }
.image-error { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background-color: #f5f5f5; color: #999; font-size: 12px; border-radius: 6px; }
.image-placeholder { text-align: center; width: 100%; }
.image-name { font-size: 10px; font-weight: 500; display: block; margin-bottom: 4px; word-break: break-all; line-height: 1.2; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
.objects-count { font-size: 9px; background-color: rgba(255, 255, 255, 0.2); padding: 2px 6px; border-radius: 10px; backdrop-filter: blur(2px); }
.image-preview-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); display: flex; justify-content: center; align-items: center; z-index: 9999; animation: fadeIn 0.3s ease-in-out; }
.modal-content { position: relative; max-width: 90%; max-height: 90%; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); animation: zoomIn 0.3s ease-in-out; }
.modal-image { width: 100%; height: auto; max-height: 70vh; object-fit: contain; display: block; }
.modal-info { padding: 20px; background: white; }
.modal-info h3 { margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #111F68; word-break: break-all; }
.modal-info p { margin: 5px 0; font-size: 14px; color: #666; }
.close-btn { position: absolute; top: 15px; right: 15px; width: 35px; height: 35px; background: rgba(0, 0, 0, 0.5); color: white; border: none; border-radius: 50%; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.3s ease; }
.close-btn:hover { background: rgba(0, 0, 0, 0.7); }
.modal-error { display: flex; align-items: center; justify-content: center; width: 100%; height: 200px; background-color: #f5f5f5; color: #999; font-size: 14px; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@media (max-width: 768px) {
    .imagesPart { flex-direction: column; padding: 8px; height: calc(100vh - 120px); }
    .leftPart { flex: none; height: 250px; margin-bottom: 15px; }
    .rightPart { flex: 1; height: calc(100vh - 400px); }
    .rightPart > ul { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .rightPart ul li { height: 100px; }
    .image-name { font-size: 9px; }
    .objects-count { font-size: 8px; }
}
</style>    