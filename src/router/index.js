import Vue from 'vue'
import VueRouter from 'vue-router'

// 全局处理冗余导航警告
const originalPush = VueRouter.prototype.push;
VueRouter.prototype.push = function push(location) {
    return originalPush.call(this, location).catch(err => {
        // 只捕获 "避免冗余导航" 的错误，其他错误正常抛出
        if (err.name !== 'NavigationDuplicated') {
            throw err;
        }
    });
};

Vue.use(VueRouter)

// Lazy Loading Views
const Datasets = () => import('@/views/Datasets/index.vue')
const Projects = () => import('@/views/Projects/index.vue')
const Architecture = () => import('@/views/Models/Architecture.vue')
const IllegalDatasetDetail = () => import('@/views/Datasets/IllegalDatasetDetail.vue')
const StandardDatasetDetail = () => import('@/views/Datasets/StandardDatasetDetail.vue')
const ProjectDetail = () => import('@/views/Projects/ProjectDetail.vue')
const ProjectCharts = () => import('@/views/Projects/ProjectCharts.vue')
const TrainManager = () => import('@/views/Training/TrainManager.vue')
const Configuration = () => import('@/views/Training/Configuration.vue')
const Preview = () => import('@/views/Training/Preview.vue')
const TrainLogs = () => import('@/views/Training/TrainLogs.vue')

const DataVersionHistoryComparison = () => import('@/views/Datasets/DataVersionHistoryComparison.vue')
const TrainingTaskComparison = () => import('@/views/Training/TrainingTaskComparison.vue')
const VersionManager = () => import('@/views/Models/VersionManager.vue')
const Hyperparameter = () => import('@/views/Training/Hyperparameter.vue')
const BaseChart = () => import('@/components/Chart/BaseChart.vue') // Kept as route for now if used as demo
const AlarmRule = () => import('@/views/Configuration/AlarmRule.vue')
const DeploymentCenter = () => import('@/views/Deployment/DeploymentCenter.vue')
const ModelFrameSelect = () => import('@/views/Models/ModelFrameSelect.vue')
const FormatConversion = () => import('@/views/Models/FormatConversion.vue')
const PerformanceMonitor = () => import('@/views/Monitoring/PerformanceMonitor.vue')

export default new VueRouter({
    routes: [
        {
            path: '/datasets',
            component: Datasets
        },
        {
            path: '/projects',
            component: Projects
        },
        {
            path: '/architecture',
            component: Architecture
        },
        {
            path: '/illegal-dataset-detail',
            component: IllegalDatasetDetail
        },
        {
            path: '/standard-dataset-detail',
            component: StandardDatasetDetail
        },
        {
            path: '/projectsdetail',
            component: ProjectDetail
        },
        {
            //新界面
            path: '/dataversionhistorycomparison',
            component: DataVersionHistoryComparison
        }, {
            path: '/trainingtaskcomparison',
            component: TrainingTaskComparison
        }, {
            path: '/modelversionmanagement',
            component: VersionManager
        }, {
            path: '/hyperparameter',
            component: Hyperparameter
        }, {
            path: '/customchart',
            component: BaseChart
        }, {
            path: '/alarmrule',
            component: AlarmRule
        }, {
            path: '/deployment',
            component: DeploymentCenter
        }, {
            path: '/deploymentprocess',
            redirect: { path: '/deployment' }
        }, {
            path: '/modelinferencetest',
            redirect: { path: '/deployment', query: { tool: 'inference-test' } }
        },
        {
            path: '/modelframeselect',
            component: ModelFrameSelect
        },
        {
            path: '/modelformatconversion',
            component: FormatConversion
        },
        {
            path: '/performance-monitor',
            component: PerformanceMonitor
        },

        {
            path: '/projectscharts',
            component: ProjectCharts,
            children: [
                {
                    path: 'trainpart',
                    component: TrainManager
                },
                {
                    path: 'logs',
                    component: TrainLogs
                },
                {
                    path: 'configuration',
                    component: Configuration
                },
                {
                    path: 'previewpart',
                    component: Preview,
                }
            ]
        },
        {
            path: '*',
            redirect: '/datasets'
        }
    ]
})
