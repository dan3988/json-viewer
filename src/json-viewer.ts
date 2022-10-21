import HTML from "./html.js";

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
		buildObject(parent, item);
	}
}

function buildArray(parent: HTML, item: any[]): void {
	const element = parent.append("div", {
		class: `json-array`
	});

	const children = element.append("div");
	for (let child of item)
		buildUnknown(children, child);
}

function buildObject(parent: HTML, item: objecting): void {
	const element = parent.append("div", {
		class: `json-object`
	});

	for (let [key, value] of Object.entries(item)) {
		const li = element.append("div", { class: "json-prop" });
		buildKey(li, key);
		buildUnknown(li, value);
	}
}
