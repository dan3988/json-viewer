import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';
import { sass } from 'svelte-preprocess-sass';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';
import chalk from "chalk";
import glob from "glob";
import fs from "fs";
import path from "path";
import * as util from "util";
import * as rl from "rollup";

process.env.ROLLUP_WATCH = true;
process
	.on("uncaughtException", console.error)
	.on("unhandledRejection", console.error);

/**
 * @param {esbuild.Message} msg
 * @param {"red" | "yellow"} color
 * @param {any} type
 */
function logMessage(msg, color, type) {
	const { file, column, line, lineText, length } = msg.location;
	const start = lineText.substring(0, column);
	const mid = lineText.substring(column, column + length);
	const end = lineText.substring(start.length + mid.length);
	const midf = chalk.underline(chalk[color](mid));
	log(msg.text, file, column, line, `${chalk.bgWhite(line)} ${start}${midf}${end}`, color, type);
}

/**
 * @param {string} prefix
 * @param {string} text
 * @param {string} file
 * @param {number} column
 * @param {number} line
 * @param {string} lineText
 * @param {number} length 
 * @param {"red" | "yellow"} color
 * @param {any} type
 */
function log(prefix, text, file, column, line, frame, color, type) {
	const loc = path.resolve(file);

	console.log(`${prefix}${chalk.blueBright(loc)}:${chalk.yellow(line)}:${chalk.yellow(column)}: ${chalk[color](type)}: ${text}`);
	console.log();
	console.log(frame);
	console.log();
}

const globAsync = util.promisify(glob);
const recur = { recursive: true };

/**
 * @param {string} dir
 * @param {boolean} [clean]
 */
function ensureDir(dir, clean) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, recur);
	} else if (clean) {
		fs.rmSync(dir, recur);
		fs.mkdirSync(dir, recur)
	}
}

/**
 * @param {string} baseDir
 * @param {string} entry
 * @param {string} output
 * @returns {rl.RollupOptions}
 */
function svelteConfig(baseDir, entry, output) {
	return {
		input: path.join(baseDir, entry),
		output: {
			sourcemap: !dist,
			format: 'cjs',
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

/**
 * 
 * @param {string} name
 * @param {rl.RollupOptions} config 
 */
async function executeRollup(name, config) {
	if (watch) {
		const prefix = `[${name}] `;
		const watcher = rl.watch(config);
		watcher.on("event", async (evt) => {
			switch (evt.code) {
				case "BUNDLE_END":
					console.log(prefix + chalk.green("Build Successful"));
					//evt.result.write({ amd: true, dir: "lib/ui" });
					break;
				case "ERROR": {
					let msg;
					let e = evt.error;
					if (e.code === "PLUGIN_ERROR") {
						switch (e.plugin) {
							case "svelte":
								msg = chalk.yellow(e.id);
								if (e.start)
									msg += " " + chalk.blue(e.start.line) + ":" + chalk.blue(e.start.column);

								msg += ": " + chalk.red(e.message);
								let code = e.frame;
								if (code)
									msg += "\n" + code;

								break;
						}

					} else if (e.code === "PARSE_ERROR") {
						msg = chalk.yellow(e.id);
						if (e.loc)
							msg += " " + chalk.blue(e.loc.line) + ":" + chalk.blue(e.loc.column);

						msg += ": " + chalk.red(e.message);
						let code = e.frame;
						if (code)
							msg += "\n" + code;
					}
					
					console.error(prefix + (msg ?? (chalk.red("Unhandled Error: ") + e)));
					break;
				}
			}
		})

		onExit.push(() => watcher.close());
	} else {
		const bundle = await rl.rollup(config);
		const res = await bundle.write(config.output);
		debugger;
		//		await bundle.write({ amd: true, dir: "lib/ui" });
	}
}

/** @type {(() => void | Promise<void>)[]} */
const onExit = [];
const outdir = "lib";
const distDir = "dist";
const args = util.parseArgs({
	strict: true,
	options: {
		watch: { type: "boolean", short: "w" },
		dist: { type: "boolean", short: "d" },
		//out: { type: "string", short: "o" },
	}
})

const { watch = false, dist = false } = args.values;

/** @type {Record<string, rl.RollupOptions>} */
const configs = {
	CTS: 
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
	CT: svelteConfig("src/content", "content.ts", "content"),
	BG: jsConfig("src/extension", "background.ts", "bg"),
	UI: svelteConfig("src/viewer", "viewer.ts", "viewer"),
	OP: svelteConfig("src/options", "options.ts", "options"),
}

try {
	ensureDir(outdir, true);

	await fs.promises.cp(`./node_modules/jsonic/${dist ? "jsonic-min.js" : "jsonic.js"}`, path.join(outdir, "jsonic.js"));

	if (dist) {
		ensureDir(distDir, true);

		/** @type {chrome.runtime.Manifest} */
		const mf = await fs.promises.readFile("manifest.json").then(JSON.parse);
		delete mf.debug;
		delete mf["$schema"];
		await fs.promises.writeFile(path.join(distDir, "manifest.json"), JSON.stringify(mf));

		for (const resources of mf.web_accessible_resources) {
			for (const resource of resources.resources) {
				const matches = await globAsync(resource);
				for (const file of matches) {
					const dst = path.join(distDir, file);
					const dir = path.dirname(dst);
					ensureDir(dir);
					await fs.promises.copyFile(file, dst);
				}
			}
		}
	}

	for (var [key, cfg] of Object.entries(configs))
		await executeRollup(key, cfg);

	if (watch) {
		async function stop() {
			if (onExit.length) {
				console.log("stopping...");
				for (let fn of onExit)
					await fn();
				console.log("stopped.");
			}

			process.exit(1);
		}

		process.addListener("SIGINT", stop);
		process.addListener("SIGQUIT", stop);
		process.addListener("SIGTERM", stop);
	}
} catch (e) {
	console.error(e);
}