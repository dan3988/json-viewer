import { sveltePreprocess } from "svelte-preprocess/dist/autoProcess.js";

export default {
	onwarn(warning, handler) {
		warning.code !== "css-unused-selector" && handler(warning);
	},
	preprocess: [
		sveltePreprocess({
			typescript: {
				tsconfigFile: "./src/tsconfig.svelte.json"
			}
		})
	]
}