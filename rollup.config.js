import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import svelte from 'rollup-plugin-svelte';
import css from 'rollup-plugin-css-only';
import * as rl from "rollup";
import sveltePreprocess from 'svelte-preprocess';
import sass from "sass";
import path from "path";
import fs from "fs";
import Linq from '@daniel.pickett/linq-js';
import indentStyles from './rollup-plugin-indent-theme.js';
import release from './rollup-plugin-release.js';
import lib from "./src/lib.json" assert { type: "json" };

const dist = !process.env.ROLLUP_WATCH;
const vscSettings = await fs.promises.readFile("./.vscode/settings.json").then(JSON.parse);
const ignore = Linq.fromObject(vscSettings["svelte.plugin.svelte.compilerWarnings"])
	.select(([k, v]) => v === "ignore" && k)
	.ofType("string")
	.toSet();

const recursive = { recursive: true };
const icons = Object.create(null);
const dir = "lib";

cleanDir(dir);

function cleanDir(dir) {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, recursive);
		fs.mkdirSync(dir, recursive);
	}
}

function loadBsIcon(name) {
	let file = icons[name];
	if (file == null) {
		file = "node_modules/bootstrap-icons/icons/" + name + ".svg";
		if (!fs.existsSync(file))
			throw "Icon not found.";

		icons[name] = file;
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
									return new sass.types.String(`url("chrome-extension://__MSG_@@extension_id__/${value}")`);
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
			dist && terser({
				format: {
					ascii_only: true
				}
			})
		],
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
	svelteConfig("src/viewer", "viewer.ts", "viewer"),
	svelteConfig("src/options", "options.ts", "options", "esm"),
	{
		input: "src/extension/background.ts",
		output: {
			indent: "\t",
			sourcemap: !dist,
			format: 'cjs',
			file: path.join(dir, "bg.js")
		},
		plugins: [
			typescript({
				tsconfig: "src/extension/tsconfig.json",
				sourceMap: !dist,
				inlineSources: !dist
			}),
			json(),
			dist && terser()
		],
		watch: {
			clearScreen: false
		},
	},
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

if (dist) {
	configs.push({
		input: "manifest.json",
		plugins: [
			release({
				format: "zip",
				transform(mf) {
					delete mf.$schema;
					delete mf.debug;
				},
				deps() {
					const libs = Object.values(lib);
					const bsIcons = Object.values(icons);

					return [
						"res/*",
						"lib/*",
						"favicon.ico",
						...libs,
						...bsIcons
					]
				}
			})
		]
	});
}

export default configs;