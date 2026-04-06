import { createApp } from 'vue'

import { registerPlugins } from '@/plugins'

import Toast from 'vue-toastification'

import App from './App.vue'

import 'unfonts.css'
import './styles/tailwind.css'
import './styles/main.scss'
import 'vue-toastification/dist/index.css'

const app = createApp(App)

const options = {}

app.use(Toast, options)

registerPlugins(app)

BX24.init(() => app.mount('#app'))
