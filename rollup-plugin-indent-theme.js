import * as rl from "rollup";
import path from "path";

/** 
 * @typedef IndentStyleInput
 * @prop {string} id
 * @prop {string} name
 * @prop {boolean} reverse
 * @prop {string[] | [light: string, dark: string][]} colors
 */

class CssWriter {
	#output;
	#indent;

	constructor(indent) {
		this.#output = [];
		this.#indent = indent;
	}

	#newLine(count) {
		const [output, indent] = [this.#output, this.#indent];
		output.push("\r\n");
		while (--count >= 0)
			output.push(indent);
	}

	write(...values) {
		this.#output.push(...values);
	}

	newLine(count, ...values) {
		this.#indent && this.#newLine(count);
		this.#output.push(...values);
	}

	toString() {
		return this.#output.join("");
	}
}

/**
 * @param {string | undefined} indent
 * @param {IndentStyleInput["colors"]} style 
 * @param {boolean} reverse 
 * @returns {[code: string, count: number]}
 */
function transform(indent, colors, reverse) {
	const light = [];
	const dark = [];
	
	for (let i = 0; i < colors.length; i++) {
		const color = colors[i];
		if (Array.isArray(color)) {
			const [lt, dk] = color;
			light[i] = lt;
			dark[i] = dk;
		} else {
			light.push(color);
		}
	}
	
	const writer = new CssWriter(indent);
	writer.write(":root, [data-bs-theme=light] {");
	
	for (let i = 0; i < light.length; i++)
		writer.newLine(1, "--col-indent-", i, ": ", light[i], ";");

	writer.newLine(0, "}");

	if (dark.length) {
		writer.newLine(0);
		writer.newLine(0, "[data-bs-theme=dark] {");

		for (let i = 0; i < dark.length; i++) {
			const color = dark[i];
			if (color !== undefined) 
				writer.newLine(1, "--col-indent-", i, ": ", color, ";");
		}

		writer.newLine(0, "}");
	}

	let i = 0;

	while (i < light.length) {
		writer.newLine(0);
		writer.newLine(0, ".indent-", i, " {");
		writer.newLine(1, "--col-indent: var(--col-indent-", i, ");");
		writer.newLine(0, "}");
		i++;
	}

	if (reverse) {
		for (let j = i - 1; --j >= 0; i++) {
			writer.newLine(0);
			writer.newLine(0, ".indent-", i, " {");
			writer.newLine(1, "--col-indent: var(--col-indent-", j, ");");
			writer.newLine(0, "}");
		}
	}

	const code = writer.toString();
	return [code, i];
}

/**
 * @param {{ min?: boolean }} options
 * @returns {rl.Plugin}
 */
export default function indentStyles(options = {}) {
	/** @type {Record<string, IndentStyleInput[]>} */
	const allThemes = {};

	return {
		name: "rollup-plugin-indent-theme",
		generateBundle(output, bundle, isWrite) {
			if (!isWrite)
				return;

			let { indent } = output;
			if (indent === true || indent == null)
				indent = "\t";

			if (options.min)
				indent = undefined;

			/** @type {import("./src/types").IndentStyles} */
			const config = {};

			if (typeof output.dir !== "string")
				throw new TypeError("Output dir must be provided");

			for (const key in allThemes) {
				const themes = allThemes[key];
				const filePath = path.parse(key);
				const jsName = output.entryFileNames.replace("[name]", filePath.name);

				delete bundle[jsName];

				for (const { id, name, colors, reverse } of themes) {
					const [code, indents] = transform(indent, colors, reverse);
					const css = `${filePath.name}.${id}.css`;

					this.emitFile({
						id: css,
						fileName: css,
						type: "asset",
						source: code
					});

					config[id] = {
						name,
						indents,
					};
				}

				const fileName = filePath.name + ".json";
				this.emitFile({
					id: fileName,
					fileName,
					type: "asset",
					source: JSON.stringify(config, undefined, indent)
				});
			}

			return Promise.resolve();
		},
		transform(input, id) {
			if (!id.endsWith(".json"))
				return null;

			allThemes[id] = JSON.parse(input);
			this.addWatchFile(id);
			return "";
		}
	}
}