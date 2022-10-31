import DOM from "./html.js";
import { JSONPath } from "./json-path.js";
import { JsonProperty, JsonToken, JsonTokenFilterFlags } from "./json.js";

DOM(document.head).append('link', {
	props: {
		href: chrome.extension.getURL("res/json.css"),
		rel: "stylesheet"
	}
});

const body = DOM(document.body);
const pathExpr = body.create("input", {
	class: "jpath",
	props: {
		type: "search",
		placeholder: "JSON Path Expression"
	}
});

body.append("div", {
	class: "controls",
	children: [
		DOM.createElement("button", {
			class: "btn btn-collapse",
			props: {
				"type": "button"
			},
			children: [
				"Collapse All"
			],
			events: {
				click() {
					body.element.querySelectorAll(".json-prop:not([hidden])").forEach(e => e.classList.remove("expanded"))
				}
			}
		}),
		DOM.createElement("button", {
			class: "btn btn-expand",
			props: {
				"type": "button"
			},
			children: [
				"Expand All"
			],
			events: {
				click() {
					body.element.querySelectorAll(".json-prop:not([hidden])").forEach(e => e.classList.add("expanded"))
				}
			}
		}),
		DOM.createElement("input", {
			class: "filter",
			props: {
				type: "search",
				placeholder: "Filter"
			},
			events: {
				input() {
					const value = this.value.toLowerCase();
					const isAppend = value.startsWith(currentSearch);
					if (isAppend && value.length === currentSearch.length)
						return;
					
					current?.filter(value, isAppend, filterFlags, false);
					currentSearch = value;
				}
			}
		}),
		DOM.createElement("select", {
			class: "filter-type",
			events: {
				input() {
					let isAppend = filterFlags === JsonTokenFilterFlags.Both;
					filterFlags = parseInt(this.value);
					current?.filter(currentSearch, isAppend, filterFlags, false);
				}
			},
			children: [
				DOM.createElement("option", {
					props: {
						value: String(JsonTokenFilterFlags.Both)
					},
					children: [
						"All"
					]
				}),
				DOM.createElement("option", {
					props: {
						value: String(JsonTokenFilterFlags.Keys)
					},
					children: [
						"Keys"
					]
				}),
				DOM.createElement("option", {
					props: {
						value: String(JsonTokenFilterFlags.Values)
					},
					children: [
						"Values"
					]
				})
			]
		}),
		pathExpr,
		DOM.createElement("button", {
			class: "btn btn-jpath",
			props: {
				"type": "button"
			},
			children: [
				"Evaluate"
			],
			events: {
				click() {
					const curr = current;
					if (curr == null)
						return;

					let prop: JsonProperty;
					let path = pathExpr.element.value;
					if (!path) {
						prop = curr;
					} else {
						const result = JSONPath({ path, json: curr.value.proxy });
						const token = JsonToken.from(result);
						prop = new JsonProperty("results", token);
						prop.expanded = true;
					}

					root.removeAll();
					root.create(prop.element);
				}
			}
		}),
	]
});

const root = body.create("div", {
	class: "json-root"
});

let current: null | JsonProperty<string>;
let currentSearch: string = "";
let filterFlags = JsonTokenFilterFlags.Both;

export function load(json: any) {
	current = null;
	currentSearch = "";
	root.removeAll();

	const token = JsonToken.from(json);
	const rootProp = new JsonProperty("root", token);
	rootProp.expanded = true;
	root.append(rootProp.element);
	current = rootProp;
}
