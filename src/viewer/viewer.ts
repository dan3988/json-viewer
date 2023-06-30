/// <reference path="../../node_modules/json5/lib/index.d.ts" />
import "../dom-extensions";
import settings from "../settings";
import schemes from "../schemes.json";
import { getValue } from "../scheme-modes";
import ThemeTracker from "../theme-tracker";
import JsonViewer from "./JsonViewer.svelte";
import { JsonProperty } from "../json"
import { ViewerModel } from "../viewer-model";

async function setGlobal(key: string, value: any) {
	window.postMessage({ type: "globalSet", key, value });
}

function run() {
	try {
		const lib = typeof JSON5 === "undefined" ? JSON : JSON5;
		const pre = document.querySelector("body > pre") as null | HTMLPreElement;
		if (pre == null)
			throw "Could not find JSON element.";

		const json = lib.parse(pre.innerText);
		setGlobal("json", json);
		pre.remove();

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
			const bag = await settings.get("darkMode", "indentChar", "indentCount", "scheme", "useHistory", "menuAlign");
			const tracker = new ThemeTracker(document.documentElement, getValue(bag.scheme, bag.darkMode));
	
			if (bag.useHistory)
				model.bag.readables.selected.subscribe(pushHistory);
	
			let indent = bag.indentChar.repeat(bag.indentCount);
		
			settings.addListener(({ changes }) => {
				let updateTracker = false;
				let props: any = {};
				let changeCount = 0;
				let changeIndent = false;
				if (changes.indentChar) {
					changeCount++;
					bag.indentChar = changes.indentChar.newValue;
				}

				if (changes.indentCount) {
					changeCount++;
					bag.indentCount = changes.indentCount.newValue;
				}

				if (changeIndent) {
					changeCount++;
					props.indent = indent = bag.indentChar.repeat(bag.indentCount);
				}

				if (changes.menuAlign) {
					changeCount++;
					props.menuAlign = changes.menuAlign.newValue;
				}
	
				if (changes.darkMode) {
					bag.darkMode = changes.darkMode.newValue;
					updateTracker = true;
				}

				if (changes.scheme) {
					bag.scheme = changes.scheme.newValue;
					const scheme = changes.scheme.newValue;
					changeCount++;
					props.scheme = scheme;
					props.indentCount = schemes[scheme][1];
					updateTracker = true;
				}

				if (updateTracker)
					tracker.preferDark = getValue(bag.scheme, bag.darkMode);
	
				if (changeCount)
					viewer.$set(props);
	
			}, "local");
	
			const viewer = new JsonViewer({
				target: document.body,
				props: {
					model,
					indent,
					scheme: bag.scheme,
					menuAlign: bag.menuAlign,
					indentCount: schemes[bag.scheme].indents
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