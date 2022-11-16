import * as jp from "jsonpath-plus";
import Script, { JPathExpression } from "./vm.js";

jp.JSONPath.prototype.vm.Script = Script;

export var { JSONPath } = jp;
export default JSONPath;

jp.JSONPath.prototype._eval = function (code: string, value: any, valueName: string, path: string[], parent: any, parentPropName: null | string) {
	let sandbox = this.currSandbox;
	let scriptCache: Map<string, JPathExpression> = JSONPath.cache["scripts"];
	if (scriptCache == null)
		JSONPath.cache["scripts"] = scriptCache = new Map();

	let script = scriptCache.get(code);
	if (script == null) {
		script = Script.jpath(code);
		scriptCache.set(code, script);
	}

	sandbox._$_parentProperty = parentPropName;
	sandbox._$_parent = parent;
	sandbox._$_property = valueName;
	sandbox._$_root = this.json;
	sandbox._$_ = value;

	if (script.usesPath)
		sandbox._$_path = JSONPath.toPathString(path.concat([valueName]));

	const proto = Object.getPrototypeOf(sandbox)
	try {
		Object.setPrototypeOf(sandbox, globalThis);
		return script.runInNewContext(sandbox);
	} finally {
		Object.setPrototypeOf(sandbox, proto);
	}
}