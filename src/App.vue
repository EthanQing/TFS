<template>
  <div id="app">
     <navigation></navigation>
      <div class="main-content">
        <keep-alive include="DataDetail">
        <router-view ></router-view>
        </keep-alive>
      </div>
      
  </div>
</template>

<script>
import Navigation from './components/Navigation/TopNav.vue';

export default {
  name: 'App',
  components: {
    Navigation
  }
}
</script>

<style>
#app {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
.main-content {
  flex: 1;
  margin-left: 240px; /* Sidebar width */
  padding: 1.5rem;
  width: calc(100% - 240px);
  height: 100vh;
  overflow-y: auto;
  position: relative;
  z-index: 10;
}
</style>
