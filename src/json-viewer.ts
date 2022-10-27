import DOM from "./html.js";
import { JsonProperty, JsonToken } from "./json.js";

DOM(document.head).append('link', {
	props: {
		href: chrome.extension.getURL("res/json.css"),
		rel: "stylesheet"
	}
});

const body = DOM(document.body);

body.append("div", {
	class: "header",
	children: [
		DOM("input", {
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

					current?.filter(value, isAppend);
					currentSearch = value;
				}
			}
		}),
		DOM("button", {
			class: "btn",
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
		DOM("button", {
			class: "btn",
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
		})
	]
});

const root = body.append("div", {
	class: "json-root"
});

let current: null | JsonProperty<string>;
let currentSearch: string = "";

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
