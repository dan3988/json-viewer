/// <reference path="../../node_modules/json5/lib/index.d.ts" />

import settings from "../settings";
import themes from "../json-themes.json";
import ThemeTracker from "../theme-tracker";
import JsonViewer from "./JsonViewer.svelte";
import { JsonProperty } from "../json"
import { ViewerModel } from "../viewer-model";

function run() {
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
	
		function pushHistory(v: JsonProperty) {
			if (v != null && !popping)
				history.pushState(v.path, "", "#" + encodePath(v.path));
		}

		async function loadAsync() {
			const bag = await settings.get("darkMode", "indentChar", "indentCount", "scheme", "useHistory");
			const tracker = new ThemeTracker(document.documentElement, bag.darkMode);
	
			if (bag.useHistory)
				model.bag.readables.selected.subscribe(pushHistory);
	
			let indent = bag.indentChar.repeat(bag.indentCount);
		
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
	
				if (changes.scheme) {
					const scheme = changes.scheme.newValue;
					changeCount = true;
					props.scheme = scheme;
					props.indentCount = themes[scheme][1];
				}
	
				if (changeCount)
					viewer.$set(props);
	
			}, "local");
	
			const viewer = new JsonViewer({
				target: document.body,
				props: {
					model,
					indent,
					scheme: bag.scheme,
					indentCount: themes[bag.scheme][1]
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
	} catch (e) {
		return e instanceof Error ? `${e.name}: ${e.message}` : e;
	}
}

//the return value will be used by chrome.scripting.executeScript
run();