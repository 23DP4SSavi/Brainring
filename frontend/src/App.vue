<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <main>
    <h1>Brainring</h1>
    <p>Vue projekts ir gatavs darbam.</p>
    <button @click="count++">Klikšķi: {{ count }}</button>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #172033;
  background: #f5f7fb;
}
main {
  max-width: 800px;
  margin: 80px auto;
  padding: 24px;
}
button {
  padding: 10px 18px;
  cursor: pointer;
}
</style>
