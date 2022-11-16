import chalk from "chalk";
import * as _esbuild from "esbuild";
import fs from "fs";
import path from "path";
import * as util from "util";

// const args = cla([
// 	{ name: "minify", alias: "m", type: Boolean },
// 	{ name: "watch", alias: "w", type: Boolean },
// ])

const args = util.parseArgs({
	strict: true,
	options: {
		watch: { type: "boolean", short: "w" },
		out: { type: "string", short: "o" },
		dist: { type: "boolean", short: "d" }
	}
})

/** @type {typeof import("./node_modules/esbuild/lib/main")} */
const esbuild = _esbuild;
let { watch = false, dist = false, out } = args.values;

/**
 * @param {import("esbuild").Message} msg
 * @param {"red" | "yellow"} color
 * @param {any} type
 */
function logMessage(msg, color, type) {
	/** @type {import("esbuild").Location} */
	const { file, column, line, lineText, length } = msg.location;
	const loc = path.resolve(file);
	const start = lineText.substring(0, column);
	const mid = lineText.substring(column, column + length);
	const end = lineText.substring(start.length + mid.length);

	const midf = chalk.underline(chalk[color](mid))

	console.log(`${chalk.blueBright(loc)}:${chalk.yellow(line)}:${chalk.yellow(column)}: ${chalk[color](type)}: ${msg.text}`);
	console.log();
	console.log(`${chalk.bgWhite(line)} ${start}${midf}${end}`);
	console.log();
}

/** @param {import("esbuild").BuildFailure} error */
function showBuildError(error) {
	for (let e of error.errors)
		logMessage(e, "red", "ERROR");
}

/** @param {import("esbuild").BuildResult} result */
function showBuildResult(result) {
	for (var error of result.errors)
		logMessage(error, "red", "ERROR");

	for (var warning of result.warnings)
		logMessage(warning, "yellow", "WARN");
}

out ??= dist ? "dist" : "lib";
watch &&= {
	/**
	 * @param {import("esbuild").BuildFailure | null} error 
	 * @param {import("esbuild").BuildResult | null} result 
	 */
	onRebuild(error, result) {
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
}

function getFiles(dir) {
	dir = path.join("src", dir);
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

/**
 * @type {{
 * 	(dir: string, entry: string, bundle: boolean) => Promise<void>
 * 	(dir: string) => Promise<void>
 * }}
 */
const build = async function(dir, arg0, arg1) {
	let entryPoints, bundle;
	if (typeof arg0 === "string") {
		entryPoints = [path.join("src", dir, arg0)];
		bundle = arg1;
	} else {
		entryPoints = await getFiles(dir);
		bundle = false;
	}

	const outdir = path.join(out, "js");

	return await esbuild.build({
		entryPoints,
		bundle,
		outdir,
		watch,
		minify: dist,
		sourcemap: !dist,
		tsconfig: path.join("src", dir, "tsconfig.json"),
		platform: "browser",
		logLevel: "silent", 
		target: "ESNext"
	});
}

try {
	if (fs.existsSync(out))
		await fs.promises.rm(out, { recursive: true });

	await fs.promises.mkdir(out);
	await fs.promises.cp(`./node_modules/jsonic/${dist ? "jsonic-min.js" : "jsonic.js"}`, path.join(out, "js", "jsonic.js"));

	try {
		await build("amd", "content.ts", true).then(showBuildResult);
		await build("esm").then(showBuildResult);
	} catch (e) {
		showBuildError(e);
		process.exit(-1);
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

	const mf = await fs.promises.readFile("manifest.json").then(JSON.parse);
	delete mf.debug;
	delete mf["$schema"];
	await fs.promises.writeFile(path.join(out, "manifest.json"), JSON.stringify(mf));
	await fs.promises.cp("favicon.ico", path.join(out, "favicon.ico"));
	await fs.promises.cp("res", path.join(out, "res"), { recursive: true });
} catch (e) {
	console.error(e);
}