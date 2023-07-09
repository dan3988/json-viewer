/// <reference path="../../node_modules/json5/lib/index.d.ts" />
import "../dom-extensions";
import settingsBag from "../settings-bag";
import createComponent from "../component-tracker";
import schemes from "../schemes.json";
import { getValue } from "../scheme-modes";
import ThemeTracker from "../theme-tracker";
import JsonViewer from "./JsonViewer.svelte";
import { JsonProperty } from "../json"
import { ViewerModel } from "../viewer-model";
import { MappedBagBuilder } from "../prop";

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
		function suppressPush<T, R>(fn: Fn<[], R, T>, thisArg: T): R
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
			const bag = await settingsBag("darkMode", "indentChar", "indentCount", "scheme", "useHistory", "menuAlign", "background");
			const bound = new MappedBagBuilder(bag)
				.map(["background", "menuAlign", "scheme"])
				.map(["indentChar", "indentCount"], "indent", (char, count) => char.repeat(count))
				.map("scheme", "indentCount", v => schemes[v].indents)
				.build();

			function preferDark() {
				const { scheme, darkMode } = bag.readables;
				return getValue(scheme.value, darkMode.value);
			}

			if (bag.getValue("useHistory"))
				model.bag.readables.selected.subscribe(pushHistory);

			bag.onChange(v => {
				if ("darkMode" in v || "scheme" in v)
					tracker.preferDark = preferDark();
			});
	
			const tracker = new ThemeTracker(document.documentElement, preferDark());
			const component = createComponent(JsonViewer, document.body, bound, { model });

			console.log("JSON Viewer loaded successfully. The original parsed JSON value can be accessed using the global variable \"json\"");
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
