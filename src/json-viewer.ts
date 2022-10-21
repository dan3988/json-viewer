import HTML, { ElementInit } from "./html.js";

HTML(document.head).append('link', {
	props: {
		href: chrome.extension.getURL("res/json.css"),
		rel: "stylesheet"
	}
})

export function load(json: any) {
	console.debug(json);

	const root = HTML(document.body);
	buildUnknown(root, json);
}

function buildPrimitive(parent: HTML, item: string, type: "string"): void;
function buildPrimitive(parent: HTML, item: number, type: "number"): void;
function buildPrimitive(parent: HTML, item: bigint, type: "bigint"): void;
function buildPrimitive(parent: HTML, item: boolean, type: "boolean"): void;
function buildPrimitive(parent: HTML, item: any, type: any): void
function buildPrimitive(parent: HTML, item: any, type: any): void {
	parent.append("div", {
		class: `json-value json-${type}`,
		children: [
			JSON.stringify(item)
		]
	});
}

function buildKey(parent: HTML, item: string) {
	parent.append("div", {
		class: `json-key`,
		children: [
			item
		]
	});
}

function buildUnknown(parent: HTML, item: any): void {
	const type = typeof item;
	switch (type) {
		case "string":
		case "number":
		case "bigint":
		case "boolean":
			buildPrimitive(parent, item, type);
			return;
	}

	if (Array.isArray(item)) {
		buildArray(parent, item);
	} else {
		buildObject(parent, Object.entries(item));
	}
}

function buildSummary(parent: HTML, count: number, isObject: boolean): void {
	parent.append("span", {
		class: "summary",
		children: [
			isObject ? `{ ${count} }` : `[ ${count} ]`
		]
	})
}

function buildProperty(parent: HTML, key: any, value: any) {
	const li = parent.append("div", { class: "json-prop" });
	const type = typeof value;
	if (type !== "object") {
		buildKey(li, key);
		buildPrimitive(li, value, type);
	} else {
		if (Array.isArray(value)) {
			buildKey(li, key);
			buildSummary(li, value.length, false);

			if (value.length !== 0) {
				buildExpander(li);
				buildArray(li, value);
			}
		} else {
			const entries = Object.entries(value);
			buildKey(li, key);
			buildSummary(li, entries.length, true);

			if (entries.length !== 0) {
				buildExpander(li);
				buildObject(li, entries);
			}
		}
	}
}

function buildArray(parent: HTML, item: any[]): void {
	const element = parent.append("div", {
		class: "json-container json-array",
	});

	for (let i = 0; i < item.length; i++)
		buildProperty(element, i, item[i]);
}

function buildExpander(parent: HTML) {
	parent.append("span", {
		class: "expander",
		events: {
			click: toggleExpanded
		}
	})
}

function buildObject(parent: HTML, entries: [string, any][]): void {
	const element = parent.append("div", {
		class: "json-container json-object",
	});

	for (const [key, value] of entries)
		buildProperty(element, key, value);
}

function toggleExpanded(this: HTMLElement) {
	this.parentElement?.classList.toggle("expanded");
}