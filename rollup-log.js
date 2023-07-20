import chalk from "chalk";
import path from "node:path";

/** @type {import("rollup").WarningHandlerWithDefault} */
export function onwarn(warning, handler) {
	if (warning.plugin !== "typescript")
		return handler(warning);

	const { file, column, line } = warning.loc;
	const relative = path.relative(".", file);
	//remove the "@rollup/plugin-typescript TS####" prefix
	const pluginMessage = warning.message.substring(28 + warning.pluginCode.length);
	const message = chalk.red(warning.pluginCode) + " " + chalk.blue(`${relative}:${line}:${column}`) + " " + pluginMessage;
	console.log(message);
	console.log(warning.frame);
}

export default onwarn;