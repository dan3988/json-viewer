import chalk from "chalk";
import * as esbuild from "esbuild";
import glob from "glob";
import fs from "fs";
import path from "path";
import * as util from "util";
import * as vite from "vite";

process
	.on("uncaughtException", console.error)
	.on("unhandledRejection", console.error);

/**
 * @param {esbuild.Message} msg
 * @param {"red" | "yellow"} color
 * @param {any} type
 */
function logMessage(msg, color, type) {
	/** @type {esbuild.Location} */
	const { file, column, line, lineText, length } = msg.location;
	const loc = path.resolve(file);
	const start = lineText.substring(0, column);
	const mid = lineText.substring(column, column + length);
	const end = lineText.substring(start.length + mid.length);
	const midf = chalk.underline(chalk[color](mid));

	console.log(`${chalk.blueBright(loc)}:${chalk.yellow(line)}:${chalk.yellow(column)}: ${chalk[color](type)}: ${msg.text}`);
	console.log();
	console.log(`${chalk.bgWhite(line)} ${start}${midf}${end}`);
	console.log();
}

/**
 * 
 * @param {string} name 
 * @param {boolean} clear 
 * @param {esbuild.Message[]} errors 
 * @param {esbuild.Message[]} warnings 
 */
function showResult(name, clear, errors, warnings) {
	if (clear)
		console.clear();

	let msg;
	let fail = errors.length > 0;
	if (fail) {
		for (var error of errors)
			logMessage(error, "red", "ERROR");

		msg = chalk.redBright(`${name}: Build Failed. (${error.length} error${error.length})`);
	} else {
		msg = chalk.greenBright(name + ": Build Successful");
	}

	for (var warning of warnings)
		logMessage(warning, "yellow", "WARN");

	console.log(msg);
	console.log();
}

function getFiles(dir) {
	return fs.promises.readdir(dir).then(files => {
		for (let i = 0; i < files.length; ) {
			const file = files[i];
			if (file.endsWith(".ts")) {
				files[i++] = path.join(dir, file);
			} else {
				files.splice(i, 1);
			}
		}

		return files;
	});
}

const globAsync = util.promisify(glob);

/**
 * @type {{
 * 	(name: string, dir: string, entry: string, bundle: boolean) => Promise<esbuild.BuildResult>
 * 	(name: string, dir: string) => Promise<esbuild.BuildResult>
 * }}
 */
const build = async function(name, dir, arg0, arg1) {
	let entryPoints, bundle;
	if (typeof arg0 === "string") {
		entryPoints = [path.join(dir, arg0)];
		bundle = arg1;
	} else {
		entryPoints = await getFiles(dir);
		bundle = false;
	}

	return await esbuild.build({
		entryPoints,
		bundle,
		outdir,
		watch: watch && {
			onRebuild(error, result) {
				let { errors, warnings } = error ?? result;
				showResult(name, true, errors, warnings);
			}
		},
		minify: dist,
		sourcemap: !dist,
		tsconfig: path.join(dir, "tsconfig.json"),
		platform: "browser",
		logLevel: "silent",
		target: "ESNext"
	});
}

/** @type {typeof build}  */
const tryBuild = async function(name) {
	try {
		const result = await build(...arguments);
		showResult(name, false, result.errors, result.warnings);
		return result;
	} catch (e) {
		if (!("errors" in e))
			throw e;

		showResult(name, false, e.errors, e.warnings);
		return null;
	}
}

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

let { watch = false, dist = false } = args.values;

try {
	ensureDir(outdir, true);

	await fs.promises.cp(`./node_modules/jsonic/${dist ? "jsonic-min.js" : "jsonic.js"}`, path.join(outdir, "jsonic.js"));

	let amd = await tryBuild("Content", "src/content", "content.ts", true)
	let esm = amd && await tryBuild("Background", "src/extension");
	if (!esm)
		process.exit(-1);

	//TODO get watch working with vite
	vite.build({
		mode: dist ? "production" : "development"
	});

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

	if (watch) {
		function stop() {
			amd.stop();
			esm.stop();
			console.error("watch stopped");
		}

		process.addListener("SIGINT", stop);
		process.addListener("SIGQUIT", stop);
		process.addListener("SIGTERM", stop);
	}
} catch (e) {
	console.error(e);
}