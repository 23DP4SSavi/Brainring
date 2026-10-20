import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

let savedTheme
try { savedTheme = localStorage.getItem('brainring-theme') } catch { /* Storage is optional. */ }
const initialTheme = savedTheme === 'dark' || savedTheme === 'light'
  ? savedTheme
  : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
document.documentElement.dataset.theme = initialTheme
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', initialTheme === 'dark' ? '#111111' : '#f5f5f5')

createApp(App).mount('#app')
