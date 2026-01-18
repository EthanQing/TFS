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

import Datasets from '@/components/Datasets/Datasets.vue'
import Projects from '@/components/Projects/Projects.vue'
import Architecture from '@/components/Architecture/Architecture.vue'
import DataDetail from '@/components/DataDetail/DataDetail.vue'
import ProjectsDetail from '@/components/ProjectsDetail/ProjectsDetail.vue'
import ProjectsCharts from '@/components/ProjectsCharts/ProjectsCharts.vue'
import TrainPart from '@/components/TrainPart/TrainPart.vue'
import ConfigurationPart from '@/components/Configuration/ConfigurationPart.vue'
import PreviewPart from '@/components/PreviewPart/PreviewPart.vue'

import DataVersionHistoryComparison from '@/components/DataVersionHistoryComparison/DataVersionHistoryComparison.vue'
import TrainingTaskComparison from '@/components/TrainingTaskComparison/TrainingTaskComparison.vue'
import ModelVersionManagement from '@/components/ModelVersionManagement/ModelVersionManagement.vue'
import Hyperparameter from '@/components/Hyperparameter/Hyperparameter.vue';
import CustomChart from '@/components/CustomChart/CustomChart.vue';
import AlarmRule from '@/components/AlarmRule/AlarmRule.vue';
import DataConversionTool from '@/components/DataConversionTool/DataConversionTool.vue';
import DeploymentProcess from '@/components/DeploymentProcess/DeploymentProcess.vue';
import ModelInferenceTest from '@/components/ModelInferenceTest/ModelInferenceTest.vue';
import ModelFrameSelect from '@/components/ModelFrameSelect/ModelFrameSelect.vue';
import ModelFormatConversion from '@/components/ModelFormatConversion/ModelFormatConversion.vue';



export default new VueRouter({
    routes:[
        {
            path:'/datasets',
            component:Datasets
        },
        {
            path:'/projects',
            component:Projects
        },
        {
            path:'/architecture',
            component:Architecture
        },
        {
            path:'/datadetail',
            component:DataDetail
        },
        {
            path:'/projectsdetail',
            component:ProjectsDetail
        },
        {
            //新界面
            path:'/dataversionhistorycomparison',
            component:DataVersionHistoryComparison
        },{ 
            path:'/trainingtaskcomparison',
            component:TrainingTaskComparison
        },{
            path:'/modelversionmanagement',
            component:ModelVersionManagement
        },{
            path:'/hyperparameter',
            component:Hyperparameter
        },{
            path:'/customchart',
            component:CustomChart
        },{
            path:'/alarmrule',
            component:AlarmRule
        },{
            path:'/deploymentprocess',
            component:DeploymentProcess
        },{
            path:'/modelinferencetest',
            component:ModelInferenceTest
        },{
            path:'/dataconversiontool',
            component:DataConversionTool
        },
        {
            path:'/modelframeselect',
            component:ModelFrameSelect
        },
        {
            path:'/modelformatconversion',
            component:ModelFormatConversion
        },

        {
            path:'/projectscharts',
            component:ProjectsCharts,
            children:[
                {
                    path:'trainpart',
                    component:TrainPart
                },
                {
                    path:'configuration',
                    component:ConfigurationPart
                },
                {
                    path:'previewpart',
                    component:PreviewPart,
                }
            ]
        },
        {
            path:'*',
            redirect:'/datasets'
        }
    ]
})

