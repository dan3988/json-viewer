import * as _esbuild from "esbuild";
import fs from "fs";
import path from "path";

/** @type {typeof import("./node_modules/esbuild/lib/main")} */
const esbuild = _esbuild;

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

async function build(dir, arg0, arg1, arg2) {
	let entryPoints, bundle, minify;
	if (typeof arg0 === "string") {
		entryPoints = [path.join("src", dir, arg0)];
		bundle = arg1;
		minify = arg2;
	} else {
		entryPoints = await getFiles(dir);
		bundle = false;
		minify = arg1;
	}

	const outdir = path.join("dist", "lib", dir);

	return await esbuild.build({
		entryPoints,
		minify,
		bundle,
		outdir,
		platform: "browser"
	});
}

try {
	if (fs.existsSync("dist"))
		await fs.promises.rm("dist", { recursive: true });

	await build("amd", "content.ts", true, true);
	await build("esm", true);

	const mf = await fs.promises.readFile("manifest.json").then(JSON.parse);
	delete mf.debug;
	delete mf["$schema"];
	await fs.promises.writeFile("dist/manifest.json", JSON.stringify(mf));
	await fs.promises.cp("favicon.ico", "dist/favicon.ico");
	await fs.promises.cp("res", "dist/res", { recursive: true });
} catch (e) {
	console.error(e);
}