import path from "node:path";

function extractLocation(loc) {
	if (loc) {
		const { file, column, line } = loc;
		const relative = path.relative(".", file);
		return ` \u001b[34m${relative}:${line}:${column}\u001b[39m`;
	} else {
		return "";
	}
}

/**
 * Custom error reporter for typescript errors
 * @type {import("rollup").WarningHandlerWithDefault}
 */
export function onwarn(warning, handler) {
	if (warning.plugin !== "typescript" || !warning.pluginCode)
		return handler(warning);

	const file = extractLocation(warning.loc);
	//remove the "@rollup/plugin-typescript TS####" prefix
	const pluginMessage = warning.message.substring(28 + warning.pluginCode.length);
	console.log("\u001b[31m%s\u001b[39m%s: %s", warning.pluginCode, file, pluginMessage);
	warning.frame && console.log(warning.frame);
}

export default onwarn;