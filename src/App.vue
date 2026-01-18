<template>
  <div id="app">
     <navigation></navigation>
      <div class="main-content">
        <router-view></router-view>
      </div>
      
  </div>
</template>

<script>
import Navigation from './components/Navigation/Navigation.vue';
import Datasets from './components/Datasets/Datasets.vue';

export default {
  name: 'App',
  components: {
    // HelloWorld
    Navigation,
    Datasets
  }
}
</script>

<style>
#app{
  display:flex ;
  width: 100%;
}
.main-content{
  margin-left: 280px;
  padding: 20px;
  width: 100%;
}

</style>
