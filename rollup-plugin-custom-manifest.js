import * as rl from "rollup";
import * as path from "node:path";

/**
 * @typedef Options
 * @property {string} browser
 */

function merge(a, b) {
	for (const key in b) {
		const value = a[key];
		const other = b[key];
		if (typeof value === "object" && typeof other === "object") {
			merge(value, other);
			continue;
		}

		a[key] = other;
	}
}

/**
 * @param {Options} options
 * @returns {rl.Plugin}
 */
export function customManifest({ browser }) {
	let data;

	return {
		name: "rollup-plugin-custom-manifest",
		generateBundle(output, bundle) {
			let indent = output.indent;
			if (indent === true) {
				indent = "\t";
			} else if (!indent) {
				indent = undefined;
			}

			const fileName = path.basename(output.file);
			
			delete bundle[output.file];
			delete bundle[fileName];

			this.emitFile({
				fileName,
				type: "asset",
				source: JSON.stringify(data, undefined, indent)
			});
		},
		transform(code, id) {
			if (!id.endsWith(".json"))
				return null;

			let json;
			try {
				json = JSON.parse(code);
			} catch (cause) {
				this.error({
					id,
					cause,
					message: "Failed to parse JSON"
				});
			}

			this.addWatchFile(id);

			const manifest = json.base;
			const browserSpecific = json.browsers[browser];
			if (browserSpecific != null)
				merge(manifest, browserSpecific);

			data = manifest;

			return "";
		}
	}
}

export default customManifest;