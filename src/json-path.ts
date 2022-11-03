// @ts-ignore
import * as jp from "../node_modules/jsonpath-plus/src/jsonpath.js";

let url = chrome.runtime.getURL("node_modules/vm-browserify/index.js");
let exports = {};
Reflect.defineProperty(window, "exports", {
	value: exports,
	enumerable: true,
	configurable: true
});
await import(url);
Reflect.deleteProperty(window, "exports");

jp.JSONPath.prototype.vm = exports;

export var { JSONPath, JSONPathClass }: typeof import("jsonpath-plus") = jp;