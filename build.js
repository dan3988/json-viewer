import chalk from "chalk";
/** @type {typeof esbuild} */
import * as esbuild from "esbuild";
/** @type {typeof import("glob")} */
import glob from "glob";
import fs from "fs";
import path from "path";
import * as util from "util";

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

/** @param {esbuild.BuildFailure} error */
function showBuildError(error) {
	for (let e of error.errors)
		logMessage(e, "red", "ERROR");
}

/** @param {esbuild.BuildResult} result */
function showBuildResult(result) {
	for (var error of result.errors)
		logMessage(error, "red", "ERROR");

	for (var warning of result.warnings)
		logMessage(warning, "yellow", "WARN");
}

/**
 * @param {esbuild.BuildFailure | null} error 
 * @param {esbuild.BuildResult | null} result 
 */
function onRebuild(error, result) {
	if (!dist)
		console.clear();

	let msg;

	if (error == null) {
		showBuildResult(result);
		msg = chalk.greenBright("Build Successful");
	} else {
		showBuildError(error);
		msg = chalk.redBright("Build Failed. (" + error.errors.length + " error(s))");
	}

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
 * 	(dir: string, entry: string, bundle: boolean) => Promise<esbuild.BuildResult>
 * 	(dir: string) => Promise<esbuild.BuildResult>
 * }}
 */
const build = async function(dir, arg0, arg1) {
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
		watch,
		minify: dist,
		sourcemap: !dist,
		tsconfig: path.join(dir, "tsconfig.json"),
		platform: "browser",
		logLevel: "silent",
		target: "ESNext"
	});
}

/** @type {typeof build}  */
const tryBuild = async function() {
	try {
		const result = await build(...arguments);
		onRebuild(null, result);
		return result;
	} catch (e) {
		if (!("errors" in e))
			throw e;

		onRebuild(e);
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

watch &&= { onRebuild };


try {
	ensureDir(outdir, true);

	await fs.promises.cp(`./node_modules/jsonic/${dist ? "jsonic-min.js" : "jsonic.js"}`, path.join(outdir, "jsonic.js"));

	let amd = await tryBuild("src/amd", "content.ts", true)
	let esm = amd && await tryBuild("src/esm");
	if (!esm)
		process.exit(-1);

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