import { sveltePreprocess } from "svelte-preprocess/dist/autoProcess.js";
import { sass } from "svelte-preprocess-sass";

export default {
	preprocess: [
		sveltePreprocess({
			typescript: {
				tsconfigFile: "./src/tsconfig.svelte.json"
			}
		}),
		sass()
	]
}