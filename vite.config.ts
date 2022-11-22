import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

process.env.NODE_ENV = "development";

// https://vitejs.dev/config/
export default defineConfig({
	build: {
		outDir: "lib/ui",
		lib: {
			entry: './ui/main.ts',
			name: "ui",
			fileName: (f) => `ui.${f}.js`,
			formats: ["es"]
		}
	},
	define: {
		"process.env": {
			NODE_ENV: "development"
		},
	},
	plugins: [
		vue({
			isProduction: false
		})
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./ui', import.meta.url))
		}
	}
})
