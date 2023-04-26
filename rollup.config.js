import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import { sass } from 'svelte-preprocess-sass';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';
import path from "path";
import fs from "fs";
import * as rl from "rollup";
import Linq from '@daniel.pickett/linq-js';

const dist = !process.env.ROLLUP_WATCH;
const vscSettings = await fs.promises.readFile("./.vscode/settings.json").then(JSON.parse);
const ignore = Linq.fromObject(vscSettings["svelte.plugin.svelte.compilerWarnings"])
	.select(([k, v]) => v === "ignore" && k)
	.ofType("string")
	.toSet();

/**
 * @param {string} baseDir
 * @param {string} entry
 * @param {string} output
 * @returns {rl.RollupOptions}
 */
function svelteConfig(baseDir, entry, output, format = "cjs") {
	return {
		input: path.join(baseDir, entry),
		output: {
			sourcemap: !dist,
			format,
			name: 'app',
			dir: 'lib',
			intro: '{',
			outro: '}'
		},
		plugins: [
			svelte({
				preprocess: [
					sveltePreprocess({
						sourceMap: !dist,
						typescript: {
							tsconfigFile: "./src/tsconfig.svelte.json"
						}
					}),
					sass()
				],
				compilerOptions: {
					// enable run-time checks when not in production
					dev: !dist,
					format: "cjs"
				},
				onwarn(warning, handler) {
					!ignore.has(warning.code) && handler(warning);
				}
			}),
			css({ output: output + ".css" }),
			resolve({
				browser: true,
				dedupe: ['svelte']
			}),
			commonjs(),
			typescript({
				tsconfig: path.join(baseDir, "tsconfig.json"),
				sourceMap: !dist,
				inlineSources: !dist
			}),
			dist && terser()
		],
		watch: {
			clearScreen: false
		}
	};
}

/**
 * @param {string} baseDir
 * @param {string} entry
 * @param {string} output
 * @returns {rl.RollupOptions}
 */
function jsConfig(baseDir, entry, output, addScss) {
	/** @type {(rl.Plugin | undefined)[]} */
	const plugins = [
		typescript({
			tsconfig: path.join(baseDir, 'tsconfig.json'),
			sourceMap: !dist,
			inlineSources: !dist
		})
	]

	if (addScss)
		plugins.push(sass({ 
			fileName: output + ".css"
		}));

	if (dist)
		plugins.push(terser());

	return {
		input: path.join(baseDir, entry),
		output: {
			sourcemap: !dist,
			format: 'cjs',
			file: path.join("lib", output + ".js"),
		},
		plugins,
		watch: {
			clearScreen: false
		}
	};
}

/** @type {rl.RollupOptions[]} */
const configs = [
	{
		input: "src/content-script/content.js",
		output: {
			sourcemap: !dist,
			format: 'cjs',
			file: 'lib/content-script.js'
		},
		watch: {
			clearScreen: false
		}
	},
	svelteConfig("src/content", "content.ts", "content"),
	jsConfig("src/extension", "background.ts", "bg"),
	svelteConfig("src/viewer", "viewer.ts", "viewer"),
	svelteConfig("src/options", "options.ts", "options", "esm"),
];

if (fs.existsSync("lib"))
	fs.rm("lib", { recursive: true }, () => fs.mkdir("lib", Function.prototype));

export default configs;