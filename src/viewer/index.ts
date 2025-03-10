/// <reference path="../../node_modules/json5/lib/index.d.ts" />
import "../dom-extensions";
import preferences from "../preferences-lite";
import createComponent from "../component-tracker";
import JsonViewer from "./JsonViewer.svelte";
import json from "../json"
import { ViewerModel } from "../viewer-model";

function setGlobal(key: string, value: any) {
	window.postMessage({ type: "globalSet", key, value });
}

function run() {
	try {
		const lib = typeof JSON5 === "undefined" ? JSON : JSON5;
		const pre = document.querySelector("body > pre") as null | HTMLPreElement;
		if (pre == null)
			throw "Could not find JSON element.";

		const doc =  lib.parse(pre.innerText);
		setGlobal("json", doc);
		document.body.innerHTML = "";

		const root = json(doc);
		const model = new ViewerModel(root);
		root.isExpanded = true;

		(window as any).model = model;

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

		function pushHistory(v: readonly json.JProperty[]) {
			if (v.length && !popping) {
				const paths = v.map(v => v.path);
				const hash = paths.map(encodePath).join("|")
				history.pushState(paths, "", "#" + hash);
			}
		}

		async function loadAsync() {
			const prefs = await preferences.lite.manager.watch();
			const mapped = prefs
				.bind()
				.map(['menuAlign', 'customSchemes', 'darkMode', 'schemeDark', 'schemeLight', 'background'])
				.build();

			function updateIndent() {
				const { indentChar, indentCount } = prefs.getValues(["indentChar", "indentCount"]);
				model.formatIndent = indentChar.repeat(indentCount);
			}

			updateIndent();

			model.useWebRequest = prefs.getValue("useWebRequest");

			chrome.runtime.sendMessage({ type: "requestInfo" }, v => model.requestInfo = v);

			if (prefs.getValue("useHistory"))
				model.state.props.selected.subscribe(pushHistory);

			prefs.onChange(v => {
				if ("indentCount" in v || "indentChar" in v)
					updateIndent();
			});

			createComponent(JsonViewer, document.body, mapped, { model });

			console.log("JSON Viewer loaded successfully. The original parsed JSON value can be accessed using the global variable \"json\"");
		}

		function expandParents(p: json.JProperty) {
			while (p.parentProperty) {
				p.parentProperty.isExpanded = true;
				p = p.parentProperty;
			}
		}

		function goTo(state: (number | string)[][]) {
			const values: json.JProperty[] = [];
			let prop: undefined | json.JProperty;
			for (const path of state) {
				prop = model.resolve(path);
				if (prop) {
					expandParents(prop);
					values.push(prop);
				}
			}

			prop && model.execute("scrollTo", prop);

			model.selected.reset(...values);
		}

		let popping = false;
		if (location.hash)
			suppressPush(() => {
				const path = location.hash.substring(1);
				const decoded = path.split("|").map(decodePath);
				goTo(decoded);
			});
		
		window.addEventListener("popstate", function(ev) {
			suppressPush(() => {
				if (ev.state == null) {
					model.selected.clear();
				} else {
					goTo(ev.state);
				}
			});
		})

		loadAsync();
	} catch (e) {
		console.error("JSON Viewer failed to load: ", e);
		const msg = e instanceof Error ? `${e.name}: ${e.message}` : e;
		alert("JSON Viewer: " + msg);
	}
}

//the return value will be used by chrome.scripting.executeScript
run();
