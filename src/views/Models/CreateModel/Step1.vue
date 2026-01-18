<template>
  <div class="ModelsStep1">
    <div class="ModelTitle">选择项目</div>
    <div class="InputPart">
      <div class="ProjectSelect">
        <span>项目</span>
        <el-select v-model="projectId" placeholder="请选择项目" @change="handleProjectChange">
          <el-option
            v-for="item in projects"
            :key="item.project_id"
            :label="item.project_name"
            :value="item.project_id">
          </el-option>
        </el-select>
      </div>
    </div>
    
    <div class="ActionPart">
       <el-button type="primary" @click="goNext" :disabled="!projectId">下一步</el-button>
    </div>
  </div>
</template>

<script>
import { fetchProjects } from "@/api/projects";

export default {
  name: "ModelsStep1",
  data() {
    return {
      projectId: "",
      projects: []
    };
  },
  methods: {
    async loadProjects() {
      try {
        const list = await fetchProjects();
        this.projects = list || [];
      } catch (e) {
        console.error("加载项目失败", e);
      }
    },
    handleProjectChange(val) {
      const project = this.projects.find(p => p.project_id === val);
      if (project) {
        this.$emit('use-project', project);
      }
    },
    goNext() {
      if (this.projectId) {
         // Emit next step event or handle navigation if needed
         this.$emit('next-step');
      }
    }
  },
  mounted() {
    this.loadProjects();
  }
};
</script>

<style scoped>
.ModelsStep1 {
  padding: 20px;
}
.ModelTitle {
  font-size: 20px;
  margin-bottom: 20px;
  color: #111f68;
}
.InputPart {
  margin-bottom: 30px;
}
</style>
