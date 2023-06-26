import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import svelte from 'rollup-plugin-svelte';
import css from 'rollup-plugin-css-only';
import * as rl from "rollup";
import sveltePreprocess from 'svelte-preprocess';
import * as sass from "sass";
import path from "path";
import fs from "fs";
import Linq from '@daniel.pickett/linq-js';
import customManifest from './rollup-plugin-custom-manifest.js';
import copyLibs from './rollup-plugin-copy-libs.js';

const vscSettings = await fs.promises.readFile("./.vscode/settings.json").then(JSON.parse);
const ignore = Linq.fromObject(vscSettings["svelte.plugin.svelte.compilerWarnings"])
	.select(([k, v]) => v === "ignore" && k)
	.ofType("string")
	.toSet();

const recursive = { recursive: true };

function* addMaps(value) {
	for (const path of Object.values(value)) {
		yield path;
		const map = path + ".map";
		if (fs.existsSync(map))
			yield map;
	}
}

function cleanDir(dir) {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, recursive);
		fs.mkdirSync(dir, recursive);
	}
}

/**
 * @typedef BrowserInfo
 * @property {string} extUrlScheme
 */

/**
 * @type {Record<string, BrowserInfo>}
 */
const browsers = {
	"chrome": {
		extUrlScheme: "chrome-extension"
	},
	"firefox": {
		extUrlScheme: "moz-extension"
	}
}

function loader(args) {
	const { browser = "chrome", dist = false } = args;
	const browserInfo = browsers[browser];
	if (browserInfo == undefined)
		throw new Error(`Unknown browser: "${browser}"`);

	const baseDir = path.join("out", browser);
	const lib = path.join(baseDir, "lib");
	const indent = dist ? "" : "\t";

	cleanDir(baseDir);

	delete args.browser;
	delete args.dist;

	const icons = Object.create(null);
	function loadBsIcon(name) {
		let file = icons[name];
		if (file == null) {
			const fileName = name + ".svg";
			file = "node_modules/bootstrap-icons/icons/" + fileName;
			if (!fs.existsSync(file))
				throw "Icon not found.";
	
			const outDir = path.join(baseDir, "node_modules", "bootstrap-icons", "icons");
			const outFile = path.join(outDir, fileName);
			fs.mkdirSync(outDir, recursive);
			fs.copyFileSync(file, outFile);
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
				dir: lib,
				format,
				indent,
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
										return new sass.types.String(`url("${browserInfo.extUrlScheme}://__MSG_@@extension_id__/${value}")`);
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
				json(),
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
		svelteConfig("src/content", "content.ts", "content"),
		svelteConfig("src/viewer", "viewer.ts", "viewer"),
		svelteConfig("src/options", "options.ts", "options", "esm"),
		{
			input: "src/extension/background.ts",
			output: {
				indent,
				sourcemap: !dist,
				format: 'cjs',
				file: path.join(lib, "bg.js")
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
			input: "./custom-manifest.json",
			output: {
				indent,
				file: path.join(baseDir, "manifest.json")
			},
			plugins: [
				customManifest({ browser }),
				copyLibs({
					libFile: "src/lib.json",
					outDir: baseDir,
					log: true,
					inputs: [
						{
							mode: "json",
							path: "src/lib.json",
							parse: dist ? Object.values : addMaps
						},
						{
							mode: "dir",
							path: "res"
						},
						{
							mode: "dir",
							path: "src/content-scripts",
							include: "*.js",
							output: "lib"
						}
					],
					archive: dist && {
						fileName: "release-" + browser
					}
				})
			]
		}
	];
	
	return configs;
}

export default loader;