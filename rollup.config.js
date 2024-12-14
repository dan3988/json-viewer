import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import svelte from 'rollup-plugin-svelte';
import css from 'rollup-plugin-css-only';
import scss from 'rollup-plugin-scss';
import * as rl from "rollup";
import sveltePreprocess from 'svelte-preprocess';
import * as sass from "sass";
import path from "path";
import fs from "fs";
import Linq from '@daniel.pickett/linq-js';
import customManifest from './rollup-plugin-custom-manifest.js';
import copyLibs from './rollup-plugin-copy-libs.js';
import onwarn from "./rollup-typescript-log.js";
import hotreload from './rollup-plugin-hotreload.js';
import bootstrapIcons from './node_modules/bootstrap-icons/font/bootstrap-icons.json' with { type: "json" };

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

	/**
	 * @param {string} srcDir
	 * @param {string} output
	 * @returns {rl.RollupOptions}
	 */
	function svelteConfig(directory) {
		return {
			input: path.join('src', directory, 'index.ts'),
			output: {
				sourcemap: !dist,
				file: path.join(lib, directory + '.js'),
				indent,
				name: 'app',
				intro: '{',
				outro: '}'
			},
			onwarn,
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
									'ext-url($name)': function(name) {
										if (!(name instanceof sass.types.String))
											throw "$name: Expected a string";

										const value = `url("${browserInfo.extUrlScheme}://__MSG_@@extension_id__/${name.getValue()}")`;
										return new sass.types.String(value);
									},
									'bs-icon($name)': function(name) {
										if (!(name instanceof sass.types.String))
											throw "$name: Expected a string";
	
										const value = bootstrapIcons[name.getValue()];
										if (!value)
											throw `$name: Unknown icon "${name}"`;

										const text = String.fromCharCode(value);
										return new sass.types.String(JSON.stringify(text));
									}
								}
							}
						})
					],
					compilerOptions: {
						// enable run-time checks when not in production
						dev: !dist,
						// use the filename instead of contents to generate the css class names otherwise hot-reload won't work
						cssHash: ({ hash, filename }) => "svelte-" + hash(filename)
					},
					onwarn(warning, handler) {
						!ignore.has(warning.code) && handler(warning);
					}
				}),
				css({ output: directory + ".css" }),
				resolve({
					browser: true,
					dedupe: ['svelte']
				}),
				commonjs(),
				typescript({
					tsconfig: path.join("src", directory, "tsconfig.json"),
					sourceMap: !dist,
					inlineSources: !dist
				}),
				json({
					preferConst: true
				}),
				!dist && hotreload({
					baseDir,
					prefix: browserInfo.extUrlScheme
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
		svelteConfig("content"),
		svelteConfig("viewer"),
		svelteConfig("options"),
		{
			input: "src/extension/index.ts",
			output: {
				indent,
				sourcemap: !dist,
				format: 'cjs',
				file: path.join(lib, "bg.js")
			},
			onwarn,
			plugins: [
				typescript({
					tsconfig: "src/extension/tsconfig.json",
					sourceMap: !dist,
					inlineSources: !dist
				}),
				json({ preferConst: true }),
				dist && terser()
			],
			watch: {
				clearScreen: false
			},
		},
		{
			input: "src/scheme-import.ts",
			output: {
				indent,
				sourcemap: !dist,
				file: path.join(lib, "schemes.js"),
				format: 'module',
			},
			plugins: [
				typescript({
					tsconfig: "src/tsconfig.svelte.json",
					sourceMap: !dist,
					inlineSources: !dist
				}),
				resolve({
					browser: true,
					dedupe: ['svelte']
				}),
				commonjs(),
				json({ preferConst: true }),
				scss({ fileName: "schemes.css" }),
			],
		},
		{
			input: "./custom-manifest.json",
			output: {
				indent,
				file: path.join(baseDir, "manifest.json")
			},
			plugins: [
				customManifest({ browser, dist }),
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
						},
						{
							mode: "dir",
							path: "node_modules/bootstrap-icons/font/fonts",
							include: [
								"*.woff",
								"*.woff2"
							],
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