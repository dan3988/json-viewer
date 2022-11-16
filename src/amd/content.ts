/// <amd-module name="content"/>
import { load } from "./json-viewer.js";

console.log(location.toString());

function loadContent() {
	console.log("DOMContentLoaded");
	const pre = document.body.querySelector(":scope > pre") as HTMLPreElement;
	const text = pre.innerText;
	// @ts-ignore
	const json = (typeof jsonic === "undefined" ? JSON.parse : jsonic)(text);
	pre.remove();
	load(document, json);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", loadContent);
} else {
	loadContent();
}
