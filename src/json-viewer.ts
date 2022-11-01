import DOM from "./html.js";
import { JSONPath } from "./json-path.js";
import { JsonContainer, JsonProperty, JsonToken, JsonTokenFilterFlags } from "./json.js";

DOM(document.head)
	.append('link', {
		props: {
			href: chrome.extension.getURL("res/json.css"),
			rel: "stylesheet"
		}
	})
	.append('link', {
		props: {
			href: chrome.extension.getURL("res/core.css"),
			rel: "stylesheet"
		}
	})

function setVisibleExpanded(token: JsonProperty, expanded: boolean) {
	if (token.shown) {
		token.expanded = expanded;

		for (let prop of token.value.properties())
			setVisibleExpanded(prop, expanded);
	}
}

const body = DOM(document.body);
const pathResult = body.create("ul", {
	class: "json-root json-results"
})

let pathExpr = "";
let blink: null | HTMLElement = null;

body.create("div", { class: "controls cr" })
	.append("div", {
		class: "group",
		children: [
			DOM("button", {
				class: "btn btn-collapse",
				props: {
					type: "button"
				},
				children: [
					"Collapse All"
				],
				events: {
					click() {
						if (current != null)
							setVisibleExpanded(current, false);
					}
				}
			}),
			DOM("button", {
				class: "btn btn-expand",
				props: {
					type: "button"
				},
				children: [
					"Expand All"
				],
				events: {
					click() {
						if (current != null)
							setVisibleExpanded(current, true);
					}
				}
			})
		]
	})
	.append("div", {
		class: "group",
		children: [
			DOM("span", {
				class: "label",
				children: [ "Filter" ]
			}),
			DOM("input", {
				class: "filter",
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
			DOM("span", {
				class: "btn img-btn btn-clear",
				props: {
					title: "Clear",
				},
				events: {
					click() {
						const e = this.previousElementSibling as HTMLInputElement;
						if (e.value) {
							e.value = "";
							current?.filter("", false, filterFlags, false);
							currentSearch = "";
						}
					}
				}
			}),
			DOM("select", {
				class: "filter-type group-end",
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
			})
		]
	})
	.append("div", {
		class: "group",
		children: [
			DOM("span", {
				class: "label",
				children: [ "Path" ]
			}),
			DOM("input", {
				class: "jpath",
				events: {
					input() {
						pathExpr = this.value;
					}
				}
			}),
			DOM("span", {
				class: "btn img-btn btn-clear",
				props: {
					title: "Clear",
				},
				events: {
					click() {
						const e = this.previousElementSibling as HTMLInputElement;
						if (e.value) {
							e.value = "";
							pathExpr = "";
						}
					}
				}
			}),
			DOM("button", {
				class: "btn btn-jpath group-end",
				props: {
					type: "button"
				},
				children: [
					"Evaluate"
				],
				events: {
					click() {
						const curr = current;
						if (curr == null)
							return;
		
						pathResult.removeAll();
		
						let path = pathExpr;
						if (path) {
							const result: string[] = JSONPath({ path, json: curr.value.proxy, resultType: 'pointer' });
							for (const path of result) {
								const parts = path.split("/");
								parts.shift();
								const token = curr.value.resolve(parts)!;
								pathResult.append("li", {
									children: [ path ],
									events: {
										click() {
											for (let t: null | JsonToken = token; t != null && t.parentProperty != null; ) {
												t.parentProperty.expanded = true;
												t = t.parent;
											}

											blink?.classList.remove("blink");
											blink = token.element;
											blink.classList.add("blink");
											blink.scrollIntoView({ block: 'center' });
										}
									}
								});
							}
						}
					}
				}
			})
		]
	})
	.append(pathResult)

const root = body.create("div", {
	class: "json-root cr"
});

let current: null | JsonProperty<string>;
let currentSearch: string = "";
let filterFlags = JsonTokenFilterFlags.Both;

export function load(json: any) {
	current = null;
	currentSearch = "";

	const rootProp = new JsonProperty(null, "root", json);
	rootProp.expanded = true;
	root.removeAll();
	root.append(rootProp.element);
	current = rootProp;
}
