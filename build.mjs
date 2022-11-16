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

out ??= dist ? "dist" : "lib";
watch &&= {
	/**
	 * @param {import("esbuild").BuildFailure | null} error 
	 * @param {import("esbuild").BuildResult | null} result 
	 */
	onRebuild(error, result) {
		console.debug("update");
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
		target: "ESNext"
	});
}

try {
	if (fs.existsSync(out))
		await fs.promises.rm(out, { recursive: true });

	await fs.promises.mkdir(out);
	await fs.promises.cp(`./node_modules/jsonic/${dist ? "jsonic-min.js" : "jsonic.js"}`, path.join(out, "js", "jsonic.js"));

	let amd = await build("amd", "content.ts", true);
	let esm = await build("esm");

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