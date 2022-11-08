/// <amd-module name="json-path"/>
import * as jp from "jsonpath-plus";
import Script from "vm";

jp.JSONPath.prototype.vm.Script = Script;

export var { JSONPath } = jp;
export default JSONPath;

const old = jp.JSONPath.prototype.evaluate;
jp.JSONPath.prototype.evaluate = function() {
	const key = "script eval";
	console.time(key);
	try {
		return old.apply(this, arguments);
	} finally {
		console.timeEnd(key);
	}
}
