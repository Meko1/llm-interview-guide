import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './custom.css'
import './atlas.css'
import './labs.css'
import './self-check.css'
import './capability-planner.css'
import './editorial.css'
import { defineAsyncComponent } from 'vue'
import type { Theme } from 'vitepress'

export default {
  ...DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('LessonLab', defineAsyncComponent(() => import('./components/LessonLab.vue')))
    app.component('PathJourney', defineAsyncComponent(() => import('./components/PathJourney.vue')))
  }
} satisfies Theme
