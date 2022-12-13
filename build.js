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
 * 
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
			dir: 'lib'
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
					format: "esm"
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
					const e = evt.error;
					if (e.code === "PLUGIN_ERROR") {
						let msg;
						switch (e.plugin) {
							case "svelte":
								msg = chalk.yellow(e.id) + " " + chalk.blue(e.start.line) + ":" + chalk.blue(e.start.column) + ": " + chalk.red(e.message) + "\n" + (e.formatted ?? e.frame);
								break;
						}

						if (msg) {
							console.error(prefix + msg);
							break;
						}
					}
					console.error(prefix + chalk.red("Unhandled Error: ") + e);
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

/** @type {rl.RollupOptions} */
const rollupBg = {
	input: "src/extension/background.ts",
	output: {
		sourcemap: !dist,
		format: 'cjs',
		file: 'lib/bg.js'
	},
	plugins: [
		typescript({
			tsconfig: 'src/extension/tsconfig.json',
			sourceMap: !dist,
			inlineSources: !dist
		}),
		dist && terser()
	],
	watch: {
		clearScreen: false
	}
};

const rollupUi = svelteConfig("src/viewer", "viewer.ts", "viewer");
const rollupOpts = svelteConfig("src/options", "options.ts", "options");

/** @type {rl.RollupOptions} */
const rollupUi2 = {
	input: 'src/viewer/viewer.ts',
	output: {
		sourcemap: !dist,
		format: 'cjs',
		name: 'app',
		dir: 'lib'
	},
	plugins: [
		svelte({
			preprocess: [
				sveltePreprocess({ sourceMap: !dist }),
				sass()
			],
			compilerOptions: {
				// enable run-time checks when not in production
				dev: !dist,
				format: "esm"
			}
		}),
		css({ output: 'viewer.css' }),
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),
		typescript({
			tsconfig: 'src/viewer/tsconfig.json',
			sourceMap: !dist,
			inlineSources: !dist
		}),
		dist && terser()
	],
	watch: {
		clearScreen: false
	}
};

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

	await executeRollup("BG", rollupBg);
	await executeRollup("UI", rollupUi);
	await executeRollup("OP", rollupOpts);

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