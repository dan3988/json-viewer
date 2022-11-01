// @ts-ignore
import * as jp from "../node_modules/jsonpath-plus/src/jsonpath.js";

let url = chrome.extension.getURL("node_modules/vm-browserify/index.js");
let res = await fetch(url);
let script = await res.text();

jp.JSONPath.prototype.vm = run(script);

function run(__script__: string) {
	let exports = {};
	eval(__script__);
	return exports;
}

export var { JSONPath, JSONPathClass }: typeof import("jsonpath-plus") = jp;