import * as rl from "rollup";
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

/**
 * @param {rl.NormalizedOutputOptions} options 
 * @param {chrome.runtime.Manifest} mf
 */
function getFileName(options, mf, ext) {
	if (options.file) {
		let file = options.file;
		if (!file.includes("."))
			file += "." + ext;

		return file;
	}

	const base = options.dir ?? ".";
	const name = process.env.npm_package_name ?? mf.name ?? "bundle";
	const version = process.env.npm_package_version ?? mf.version;
	const file = version ? `${name}-${version}.${ext}`: `${name}.${ext}`;
	return path.join(base, file);
}

/**
 * @typedef Options
 * @prop {archiver.Format} [format]
 * @prop {(mf: chrome.runtime.Manifest) => void} [transform]
 * @prop {string[] | () => string[]} [deps]
 */

/**
 * @param {Options}
 * @returns {rl.Plugin}
 */
export function release({ format = "zip", deps, transform } = {}) {
	/** @type {chrome.runtime.Manifest} */
	let manifest;
	/** @type {string} */
	let id;
	return {
		name: "rollup-plugin-release",
		resolveId(id) {
			if (id.endsWith(".json"))
				return { id, resolvedBy: "rollup-plugin-release" };
		},
		transform(code, name) {
			id = name;
			manifest = JSON.parse(code);
			transform?.(manifest);
			return "";
		},
		generateBundle: {
			order: "post",
			handler(options, bundle) {
				delete bundle[id];
				delete bundle[id.replace(".json", ".js")];

				if (options.file)
					delete bundle[options.file];

				const name = getFileName(options, manifest, format);
				const out = fs.createWriteStream(name);
				const zip = archiver(format);

				zip.pipe(out);

				if (!deps) {
					zip.glob(".");
				} else {
					const files = typeof deps === "function" ? deps() : deps;
					for (const file of files)
						zip.glob(file);

					const json = JSON.stringify(manifest);

					zip.append(json, { name: "manifest.json" });
				}

				return zip.finalize();
			}
		}
	}
}

export default release;