/// <amd-module name="json-viewer"/>
import DOM from "html";
import { JSONPath } from "json-path";
import { JsonScope, JsonScopeSelectedChangedEvent, JsonToken, JsonTokenFilterFlags } from "./json.js";

export function load(document: Document, json: any) {
	DOM(document.head)
		.append('link', {
			props: {
				href: chrome.runtime.getURL("res/json.css"),
				rel: "stylesheet"
			}
		})
		.append('link', {
			props: {
				href: chrome.runtime.getURL("res/core.css"),
				rel: "stylesheet"
			}
		})
	
	function setVisibleExpanded(token: JsonToken, expanded: boolean) {
		if (!token.shown)
			return;
	
		if (token.parentProperty != null)
			token.parentProperty.expanded = expanded;
			
		for (let prop of token.properties())
			setVisibleExpanded(prop.value, expanded);
	}

	function evaluateJpath() {
		const curr = scope;
		if (curr == null)
			return;

		pathResult.removeAll();

		let path = pathExpr;
		if (path) {
			const token = curr.root;
			const result: string[] = JSONPath({ path, json: token.proxy, resultType: 'pointer' });
			for (const path of result) {
				const parts = path.split("/");
				parts.shift();
				const result = token.resolve(parts)!;
				pathResult.append("li", {
					children: [ path ],
					events: {
						click() {
							for (let t: null | JsonToken = result; t != null && t.parentProperty != null; ) {
								t.parentProperty.expanded = true;
								t = t.parent;
							}

							result.parentProperty?.select(true);

							blink?.classList.remove("blink");
							blink = result.element;
							blink.classList.add("blink");
						}
					}
				});
			}
		}
	}
	
	const body = DOM(document.body);
	const breadcrumb = body.create("ul", { class: "breadcrumb cr" })
	const pathResult = body.create("ul", {
		class: "json-root json-results"
	})
	
	let pathExpr = "";
	let blink: null | HTMLElement = null;
	
	function onSelectionChanged(evt: JsonScopeSelectedChangedEvent) {
		const prop = evt.newValue;
		
		breadcrumb.removeAll();
		for (let p = prop; p != null; p = p.parent.parentProperty) {
			const current = p;
	
			breadcrumb.create("li", { at: "start" })
				.append("span", {
					class: "json-" + typeof current.key,
					children: [ current.key ],
					events: {
						click() {
							for (let c = prop; c != null && c != current; c = c.parent.parentProperty)
								c.expanded = false;
	
							current.select(true);
						}
					}
				})
		}
	}
	
	function copy(format: boolean) {
		const selected = scope.selected;
		const value = selected == null ? scope.root : selected.value;
		let text: string;
		if (value.is("value")) {
			text = String(value.value);
		} else if (format) {
			text = JSON.stringify(value, undefined, "\t");
		} else {
			text = JSON.stringify(value);
		}
	
		return navigator.clipboard.writeText(text);
	}
	
	
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
							if (scope != null)
								setVisibleExpanded(scope.root, false);
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
							if (scope != null)
								setVisibleExpanded(scope.root, true);
						}
					}
				})
			]
		})
		.append("div", {
			class: "group",
			children: [
				DOM("button", {
					props: {
						type: "button",
						title: "Copy the selected value or the whole document without whitespace"
					},
					children: [
						"Copy"
					],
					events: {
						click: () => copy(false)
					}
				}),
				DOM("button", {
					props: {
						type: "button",
						title: "Copy the selected value or the whole document with whitespace"
					},
					children: [
						"Copy (Formatted)"
					],
					events: {
						click: () => copy(true)
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
							scope.filter = value;
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
								scope.filter = "";
							}
						}
					}
				}),
				DOM("select", {
					class: "filter-type group-end",
					events: {
						input() {
							scope.filterFlag = parseInt(this.value);
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
						},
						keypress(e) {
							if (e.key === "Enter")
								evaluateJpath();
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
						click: evaluateJpath
					}
				})
			]
		})
		.append(pathResult)
	
	const root = body.create("div", {
		class: "json-root cr",
		props: {
			tabIndex: 0
		},
		events: {
			keydown(e) {
				switch (e.key) {
					case "Escape":
						scope.deselect();
						e.preventDefault();
						break;
					case " ":
						scope.selected?.toggleExpanded();
						e.preventDefault();
						break;
					case "C":
					case "c":
						if (e.ctrlKey) {
							const selection = window.getSelection();
							if (selection != null && selection.type !== "Caret")
								break;

							const value = scope.selected?.value;
							if (value != null) {
								e.preventDefault();
								const text = value.is("value") ? String(value.value) : JSON.stringify(value, undefined, "\t");
								navigator.clipboard.writeText(text);
							}
						}
						break;
					case "ArrowDown":
						if (!e.shiftKey) {
							const selected = scope.selected;
							if (selected != null) {
								(selected.next ?? selected.parent.first)?.select(true);
							} else if (scope.root.is("container")) {
								scope.root.first?.select(true);
							}
		
							e.preventDefault();
						}
						break;
					case "ArrowUp":
						if (!e.shiftKey) {
							const selected = scope.selected;
							if (selected != null) {
								(selected.previous ?? selected.parent.last)?.select(true);
							} else if (scope.root.is("container")) {
								scope.root.first?.select(true);
							}
		
							e.preventDefault();
						}
						break;
					case "ArrowRight": {
						if (!e.shiftKey) {
							const selected = scope.selected;
							if (selected && selected.value.is("container")) {
								selected.expanded = true;
								selected.value.first?.select(true);
							}
		
							e.preventDefault();
						}
						break;
					}
					case "ArrowLeft": {
						if (!e.shiftKey) {
							const selected = scope.selected;
							if (selected && selected.parent)
								selected.parent.parentProperty?.select(true);
		
							e.preventDefault();
						}
						break;
					}
				}
			}
		}
	});
	
	let scope = new JsonScope(json);
	scope.on("selectedchanged", onSelectionChanged);
	root.removeAll();
	root.append(scope.element);
}