import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import '../styles/layers.css'
import 'vuetify/styles'

import { VDateInput } from 'vuetify/labs/VDateInput'

export default createVuetify({
 theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1976D2', // вот этот цвет отвечает за "голубой"
        },
      },
    },
  },
  
	components: {
		VDateInput,
	},

	display: {
		mobileBreakpoint: 'md',
		thresholds: {
			xs: 0,
			sm: 600,
			md: 840,
			lg: 1145,
			xl: 1545,
			xxl: 2138,
		},
	},
})
