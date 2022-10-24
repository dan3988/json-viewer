import DOM, { ElementInit } from "./html.js";

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
				input(e) {
					const text = this.value.toLowerCase();
					filters.update(text);
				}
			}
		}),
		DOM("input", {
			class: "filter",
			props: {
				type: "search",
				placeholder: "Filter"
			},
			events: {
				input(e) {
					const text = this.value.toLowerCase();
					filters.update(text);
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

interface FilterHelperContainer extends FilterHelper {
	addTextFilter(element: undefined | HTMLElement, text: string): FilterHelper;
	addContainer(element?: HTMLElement): FilterHelperContainer;
}

abstract class FilterHelper {
	static readonly #TextFilter = class TextFilter extends FilterHelper {
		readonly #text: string;

		constructor(parent: undefined | FilterHelper, element: undefined | HTMLElement, text: any) {
			super(parent, element);
			this.#text = String.prototype.toLowerCase.call(text);
		}

		protected __show(filterText: string): boolean {
			let text = this.#text;
			if (text == "additionalProperties")
				console.log();

			return !filterText || this.#text.includes(filterText);
		}
	}

	static readonly #ContainerFilter = class ContainerFilter extends FilterHelper implements FilterHelperContainer {
		readonly #children: FilterHelper[];

		constructor(parent: undefined | FilterHelper, element: undefined | HTMLElement) {
			super(parent, element);
			this.#children = [];
		}

		addTextFilter(element: undefined | HTMLElement, text: string): FilterHelper {
			const f = new FilterHelper.#TextFilter(this, element, text);
			this.#children.push(f);
			return f;
		}

		addContainer(element?: undefined | HTMLElement): FilterHelperContainer {
			const f = new FilterHelper.#ContainerFilter(this, element);
			this.#children.push(f);
			return f;
		}

		protected __show(filterText: string): boolean {
			let any = false;
			for (let child of this.#children) {
				let shown = child.update(filterText)
				any ||= shown;
			}

			return any;
		}
	}

	static root(element: HTMLElement): FilterHelperContainer {
		return new FilterHelper.#ContainerFilter(undefined, element,);
	}

	readonly #parent: undefined | FilterHelper;
	readonly #element: undefined | HTMLElement;

	constructor(parent: undefined | FilterHelper, element: undefined | HTMLElement) {
		this.#parent = parent;
		this.#element = element;
	}

	protected abstract __show(filterText: string): boolean;

	update(filterText: string): boolean {
		let show = this.__show(filterText);
		let e = this.#element;
		if (e != null)
			e.hidden = !show;

		return show;
	}
}

let current: any;
let filters: FilterHelperContainer;

export function load(json: any) {
	current = null;
	filters = FilterHelper.root(root.element);
	root.removeAll();
	buildUnknown(root, filters, json);
	current = json;
}

function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: string, type: "string"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: number, type: "number"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: bigint, type: "bigint"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: boolean, type: "boolean"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: any, type: any): void
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: any, type: any): void {
	const { element } = parent.append("div", {
		class: `json-value json-${type}`,
		children: [
			JSON.stringify(item)
		]
	});

	parentFilter.addTextFilter(element, item);
}

function buildKey(html: DOM, item: string) {
	html.append("div", {
		class: `json-key`,
		children: [
			item
		]
	});
}

function buildUnknown(parent: DOM, parentFilter: FilterHelperContainer, item: any): void {
	const type = typeof item;
	switch (type) {
		case "string":
		case "number":
		case "bigint":
		case "boolean":
			buildPrimitive(parent, parentFilter, item, type);
			return;
	}

	if (Array.isArray(item)) {
		buildArray(parent, parentFilter, item);
	} else {
		buildObject(parent, parentFilter, Object.entries(item));
	}
}

function buildSummary(parent: DOM, count: number, isObject: boolean): void {
	parent.append("span", {
		class: "summary",
		children: [
			isObject ? `Object(${count})` : `Array(${count})`
		]
	})
}

function buildProperty(parent: DOM<HTMLElement>, parentFilter: FilterHelperContainer, key: any, value: any) {
	const li = parent.append("div", { class: "json-prop" });
	const group = parentFilter.addContainer(li.element);
	group.addTextFilter(undefined, key);
	const type = typeof value;
	if (type !== "object") {
		buildKey(li, key);
		buildPrimitive(li, group, value, type);
	} else {
		if (Array.isArray(value)) {
			buildKey(li, key);
			buildSummary(li, value.length, false);

			if (value.length !== 0) {
				buildExpander(li);
				buildArray(li, group, value);
			}
		} else {
			const entries = Object.entries(value);
			buildKey(li, key);
			buildSummary(li, entries.length, true);

			if (entries.length !== 0) {
				buildExpander(li);
				buildObject(li, group, entries);
			}
		}
	}
}

function buildArray(parent: DOM, parentFilter: FilterHelperContainer, item: any[]): void {
	const element = parent.append("div", {
		class: "json-container json-array",
	});

	const fh = parentFilter.addContainer(element.element);

	for (let i = 0; i < item.length; i++)
		buildProperty(element, fh, i, item[i]);
}

function buildExpander(parent: DOM) {
	parent.append("span", {
		class: "expander",
		events: {
			click: toggleExpanded
		}
	})
}

function buildObject(parent: DOM, parentFilter: FilterHelperContainer, entries: [string, any][]): void {
	const element = parent.append("div", {
		class: "json-container json-object",
	});

	const fh = parentFilter.addContainer(element.element);

	for (const [key, value] of entries)
		buildProperty(element, fh, key, value);
}

function toggleExpanded(this: HTMLElement) {
	this.parentElement?.classList.toggle("expanded");
}