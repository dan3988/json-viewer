import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import css from 'rollup-plugin-css-only';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/ui/main.ts',
	output: {
		sourcemap: !production,
		format: 'cjs',
		name: 'app',
		file: 'lib/ui.js'
	},
	plugins: [
		svelte({
			preprocess: [
				sveltePreprocess({ sourceMap: !production })
			],
			compilerOptions: {
				// enable run-time checks when not in production
				dev: !production,
				format: "cjs"
			}
		}),
		css({ output: 'viewer.css' }),
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),
		typescript({
			tsconfig: 'src/ui/tsconfig.json',
			sourceMap: !production,
			inlineSources: !production
		}),
		typescript({
			tsconfig: 'src/extension/tsconfig.json',
			sourceMap: !production,
			inlineSources: !production
		}),
		production && terser()
	],
	watch: {
		clearScreen: false
	}
};