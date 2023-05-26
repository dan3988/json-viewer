import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import sass from "sass";
import css from 'rollup-plugin-css-only';
import path from "path";
import fs from "fs";
import * as rl from "rollup";
import Linq from '@daniel.pickett/linq-js';
import indentStyles from './rollup-plugin-indent-theme.js';

const dist = !process.env.ROLLUP_WATCH;
const vscSettings = await fs.promises.readFile("./.vscode/settings.json").then(JSON.parse);
const ignore = Linq.fromObject(vscSettings["svelte.plugin.svelte.compilerWarnings"])
	.select(([k, v]) => v === "ignore" && k)
	.ofType("string")
	.toSet();

const recursive = { recursive: true };
const icons = Object.create(null);
const dir = "lib";

function loadBsIcon(name) {
	let file = icons[name];
	if (file == null) {
		name += ".svg";
		const src = path.join("node_modules", "bootstrap-icons", "icons", name);
		if (!fs.existsSync(src))
			throw "Icon not found.";

		const dstDir = path.join(dir, "icons");
		if (!fs.existsSync(dstDir))
			fs.mkdirSync(dstDir, recursive);

		const dst = [dir, "icons", name].join("/");
		fs.copyFileSync(src, dst);
		icons[name] = file = `url("chrome-extension://__MSG_@@extension_id__/${dst}")`;
	}

	return file;
}

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
			dir,
			format,
			name: 'app',
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
						},
						scss: {
							functions: {
								'bs-icon($name)': function(name) {
									if (!(name instanceof sass.types.String))
										throw "$name: Expected a string";

									const value = loadBsIcon(name.getValue());
									return new sass.types.String(value);
								}
							}
						}
					})
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
			indent: "\t",
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
			file: path.join(dir, 'content-script.js')
		},
		watch: {
			clearScreen: false
		}
	},
	svelteConfig("src/content", "content.ts", "content"),
	jsConfig("src/extension", "background.ts", "bg"),
	svelteConfig("src/viewer", "viewer.ts", "viewer"),
	svelteConfig("src/options", "options.ts", "options", "esm"),
	{
		input: "src/indent-styles.json",
		output: {
			dir
		},
		plugins: [
			indentStyles({
				minify: dist,
				prefix: "json-indent-col-",
				prop: "--json-indent-bg"
			})
		]
	}
];

if (fs.existsSync(dir)) {
	await fs.promises.rm(dir, recursive);
	await fs.promises.mkdir(dir, recursive);
}

export default configs;