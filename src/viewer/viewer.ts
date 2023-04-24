/// <reference path="../../node_modules/json5/lib/index.d.ts" />

import JsonViewer from "./JsonViewer.svelte";
import { JsonProperty } from "./json"
import { ViewerModel } from "./viewer-model";

try {
	const lib = typeof JSON5 === "undefined" ? JSON : JSON5;
	const pre = document.querySelector("body > pre") as null | HTMLPreElement;
	if (pre == null)
		throw "Could not find JSON element.";

	const json = lib.parse(pre.innerText);
	pre.remove();
	const root = JsonProperty.create(json);
	const model = new ViewerModel(root);
	root.expanded = true;

	model.bag.readables.selected.subscribe(v => {
		if (v != null && !popping) {
			history.pushState(v.path, "", "#" + encodePath(v.path));
		}
	});

	function suppressPush(fn: Fn)
	function suppressPush<T>(fn: Fn<[], void, T>, thisArg: T)
	function suppressPush(fn: Function, thisArg?: any) {
		try {
			popping = true;
			fn.call(thisArg);
		} finally {
			popping = false;
		}
	}
	
	function encodePath(path: readonly (string | number)[]): string {
		const parts: string[] = [];
		for (let i = 1; i < path.length; i++) {
			let part = path[i];
			part = encodeURIComponent(part);
			part = part.replaceAll("%20", "+");
			parts.push(part);
		}
	
		return parts.join("\\");
	}
	
	function decodePath(path: string): string[] {
		const parts: string[] = ["$"];
		for (let part of path.split("\\")) {
			part = part.replaceAll("+", "%20");
			part = decodeURIComponent(part);
			parts.push(part);
		}
	
		return parts;
	}
	
	let popping = false;
	if (location.hash)
		suppressPush(() => {
			const path = location.hash.substring(1);
			const decoded = decodePath(path);
			model.select(decoded, true)
		});
	
	window.addEventListener("popstate", function(ev) {
		suppressPush(() => {
			if (ev.state == null) {
				model.selected = null;
			} else {
				model.select(ev.state, true);
			}
		});
	})
	
	new JsonViewer({
		target: document.body,
		props: { model }
	})

	undefined;
} catch (e) {
	e instanceof Error ? `${e.name} ${e.message}` : e;
}
