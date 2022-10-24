import DOM from "./html.js";

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
	addTextFilter(element: HTMLElement, text: any): FilterHelper;
	addContainer(element?: HTMLElement): FilterHelperContainer;
}

abstract class FilterHelper {
	static readonly #TextFilter = class TextFilter extends FilterHelper {
		readonly #text: [normal: string, lower: string];

		constructor(parent: undefined | FilterHelper, element: HTMLElement, text: any) {
			super(parent, element);
			const str = String(text);
			this.#text = [str, str.toLowerCase()];
		}

		protected __show(filterText: string): boolean {
			let [text, lower] = this.#text;
			let e = this.#element!;

			if (!filterText) {
				e.innerText = text;
				return true;
			}

			let ix = lower.indexOf(filterText);
			if (ix < 0) {
				e.innerText = text;
				return false;
			}

			let last = 0;
			let dom = DOM(e);
			dom.removeAll();

			while (true) {
				if (ix > last)
					dom.appendText("span", text.substring(last, ix))

				dom.appendText("span", "match", text.substring(ix, ix + filterText.length));

				ix = text.indexOf(filterText, last = ix + filterText.length);

				if (ix < 0) {
					dom.appendText("span", text.substring(last));
					break;
				}
			}

			return true;
		}
	}

	static readonly #ContainerFilter = class ContainerFilter extends FilterHelper implements FilterHelperContainer {
		readonly #children: FilterHelper[];

		constructor(parent: undefined | FilterHelper, element: undefined | HTMLElement) {
			super(parent, element);
			this.#children = [];
		}

		addTextFilter(element: HTMLElement, text: string): FilterHelper {
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
	const rootProp = buildProperty(root, filters, "root", json, 0);
	rootProp.element.classList.add("expanded");
	current = json;
}

function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: string, type: "string"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: number, type: "number"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: bigint, type: "bigint"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: boolean, type: "boolean"): void;
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: any, type: any): void
function buildPrimitive(parent: DOM, parentFilter: FilterHelperContainer, item: any, type: any): void {
	const { element } = parent.append("span", {
		class: `json-value json-${type}`,
		children: [ item ]
	});

	parentFilter.addTextFilter(element, item);
}

function buildKey(html: DOM, item: string): DOM<HTMLSpanElement> {
	return html.append("span", {
		class: `json-key`,
		children: [
			item
		]
	});
}

function buildSummary(parent: DOM, count: number, isObject: boolean): void {
	parent.append("span", {
		class: "summary",
		children: [
			isObject ? `Object(${count})` : `Array(${count})`
		]
	})
}

function buildProperty(parent: DOM<HTMLElement>, parentFilter: FilterHelperContainer, key: any, value: any, depth: number): DOM {
	const prop = parent.append("div", { class: "json-prop" });
	const group = parentFilter.addContainer(prop.element);
	const keyItem = buildKey(prop, key);
	if (depth > 0)
		group.addTextFilter(keyItem.element, key);

	const type = typeof value;
	if (type !== "object") {
		buildPrimitive(prop, group, value, type);
	} else {
		if (Array.isArray(value)) {
			buildSummary(prop, value.length, false);

			if (value.length !== 0) {
				buildExpander(prop);
				buildArray(prop, group, value, depth);
			}
		} else {
			const entries = Object.entries(value);
			buildSummary(prop, entries.length, true);

			if (entries.length !== 0) {
				buildExpander(prop);
				buildObject(prop, group, entries, depth);
			}
		}
	}

	return prop;
}

function buildArray(parent: DOM, parentFilter: FilterHelperContainer, item: any[], depth: number): void {
	const container = parent.append("div", {
		class: "json-container json-array",
	});

	depth++;
	const fh = parentFilter.addContainer(container.element);

	for (let i = 0; i < item.length; i++)
		buildProperty(container, fh, i, item[i], depth);
}

function buildExpander(parent: DOM) {
	parent.append("span", {
		class: "expander",
		events: {
			click: toggleExpanded
		}
	})
}

function buildObject(parent: DOM, parentFilter: FilterHelperContainer, entries: [string, any][], depth: number): void {
	const container = parent.append("div", {
		class: "json-container json-object",
	});

	depth++;
	const fh = parentFilter.addContainer(container.element);

	for (const [key, value] of entries)
		buildProperty(container, fh, key, value, depth);
}

function toggleExpanded(this: HTMLElement) {
	this.parentElement?.classList.toggle("expanded");
}