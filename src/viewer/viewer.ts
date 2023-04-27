/// <reference path="../../node_modules/json5/lib/index.d.ts" />

import type { IndentStyles } from "../types";
import settings from "../settings";
import ThemeTracker from "../theme-tracker";
import JsonViewer from "./JsonViewer.svelte";
import { JsonProperty } from "./json"
import { ViewerModel } from "./viewer-model";

try {
	const lib = typeof JSON5 === "undefined" ? JSON : JSON5;
	const pre = document.querySelector("body > pre") as null | HTMLPreElement;
	if (pre == null)
		throw "Could not find JSON element.";

	pre.remove();
	const json = lib.parse(pre.innerText);
	const root = JsonProperty.create(json);
	const model = new ViewerModel(root);
	root.expanded = true;

	model.bag.readables.selected.subscribe(v => {
		if (v != null && !popping) {
			history.pushState(v.path, "", "#" + encodePath(v.path));
		}
	});

	function suppressPush(fn: Fn): any
	function suppressPush<T, R>(fn: Fn<[], void, T>, thisArg: T): R
	function suppressPush(fn: Function, thisArg?: any) {
		try {
			popping = true;
			return fn.call(thisArg);
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

	async function loadIndentStyles(): Promise<IndentStyles> {
		const url = chrome.runtime.getURL("lib/indent-styles.json");
		const res = await fetch(url);
		return await res.json();
	}

	async function loadAsync() {
		const bag = await settings.get("darkMode", "indentChar", "indentCount", "indentStyle");
		const tracker = new ThemeTracker(document.documentElement, bag.darkMode);
		const indentStyles = await loadIndentStyles();

		let indent = bag.indentChar.repeat(bag.indentCount);

		function getStyle(key: string) {
			const style = indentStyles[key];
			const url = chrome.runtime.getURL(`/lib/indent-styles.${key}.css`)
			return [url, style.indents] as const;
		}
	
		settings.addListener(({ changes }) => {
			if (changes.darkMode)
				tracker.preferDark = changes.darkMode.newValue;

			let props: any = {};
			let changeCount = false;
			let changeIndent = false;
			if (changes.indentChar) {
				changeIndent = true;
				bag.indentChar = changes.indentChar.newValue;
			}
	
			if (changes.indentCount) {
				changeIndent = true;
				bag.indentCount = changes.indentCount.newValue;
			}

			if (changeIndent) {
				changeCount = true;
				props.indent = indent = bag.indentChar.repeat(bag.indentCount);
			}

			if (changes.indentStyle) {
				changeCount = true;
				props.indentStyle = getStyle(changes.indentStyle.newValue);
			}

			if (changeCount)
				viewer.$set(props);

		}, "local");

		const viewer = new JsonViewer({
			target: document.body,
			props: {
				model,
				indent,
				indentStyle: getStyle(bag.indentStyle)
			}
		});
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

	loadAsync();
	undefined;
} catch (e) {
	e instanceof Error ? `${e.name} ${e.message}` : e;
}
