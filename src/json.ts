import DOM from "./html.js";

export interface JsonTokenTypeMap {
	"object": JsonObject;
	"array": JsonArray;
	"property": JsonProperty;
	"string": JsonValue<string>;
	"number": JsonValue<number>;
	"boolean": JsonValue<boolean>;
	"null": JsonValue<null>;
}

export abstract class JsonToken<T = unknown> {
	static from<T extends string | number | boolean | null>(value: string): JsonValue<T>;
	static from<T extends object>(value: T): JsonObject<T>;
	static from<T>(value: T[]): JsonArray<T>;
	static from<T>(value: T): JsonToken<T>;
	static from(value: any): JsonToken {
		if (value === null || typeof value != "object")
			return new JsonValue(value);

		if (Array.isArray(value)) {
			return new JsonArray(value);
		} else {
			return new JsonObject(value);
		}
	}

	#element: null | HTMLElement;

	get element(): HTMLElement {
		return this.#element ??= this.createElement();
	}

	abstract get type(): keyof JsonTokenTypeMap;

	protected constructor() {
		this.#element = null;
	}

	protected elementLoaded(): boolean {
		return this.#element !== null;
	}

	filter(text: string, isAppend: boolean): boolean {
		const e = this.#element;
		if (e == null || (e.hidden && isAppend))
			return false;

		const shown = this.show(text, isAppend);
		e.hidden = !shown;
		return shown;
	}

	protected abstract createElement(): HTMLElement;
	protected abstract show(filterText: string, isAppend: boolean): boolean;

	abstract toJSON(): T;

	abstract is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	abstract is(type: string): boolean;
}

export abstract class JsonContainer<T, TKey extends string | number> extends JsonToken<T> {
	abstract get type(): "object" | "array";
	abstract get count(): number;

	protected createElement(): HTMLElement {
		const container = DOM.createElement("div", {
			class: "json-container json-" + this.type,
		});

		for (var child of this.properties())
			container.appendChild(child.element);

		return container;
	}

	protected show(filterText: string, isAppend: boolean): boolean {
		let any = false;
		for (let prop of this.properties())
			if (prop.filter(filterText, isAppend))
				any = true;

		return any;
	}

	abstract properties(): Iterable<JsonProperty<TKey>>;
	abstract get(key: TKey): undefined | JsonToken;
	abstract keys(): Iterable<TKey>;
}

export class JsonArray<T = any> extends JsonContainer<T[], number> {
	readonly #items: JsonProperty<number>[];

	get type() {
		return "array" as const;
	}

	get count(): number {
		return this.#items.length;
	}

	constructor(value?: T[]) {
		super();
		if (value && value.length) {
			this.#items = Array(value.length);
			for (let i = 0; i < value.length; i++) {
				const token = JsonToken.from(value[i]);
				this.#items[i] = new JsonProperty(i, token, false);
			}
		} else {
			this.#items = [];
		}
	}

	*keys(): Iterable<number> {
		for (let i = 0; i < this.#items.length; i++)
			yield i;
	}

	get(key: number): undefined | JsonToken {
		return this.#items[key];
	}

	properties(): Iterable<JsonProperty<number>> {
		return this.#items;
	}

	toJSON(): T[] {
		const elements = this.#items;
		const value = Array(elements.length);
		for (let i = 0; i < value.length; i++)
			value[i] = elements[i].toJSON();

		return value;
	}
	
	is(type: string): boolean {
		return type === "array";
	}
}

export class JsonProperty<TKey extends number | string = number | string, TValue = any> extends JsonToken<never> {
	readonly #key: TKey;
	readonly #keyText: [key: string, lower?: string];
	readonly #value: JsonToken<TValue>;
	#expanded: boolean;

	get key(): TKey {
		return this.#key;
	}

	get value(): JsonToken<TValue> {
		return this.#value;
	}

	get type() {
		return "property" as const;
	}

	get expanded(): boolean {
		return this.#expanded;
	}

	set expanded(value: boolean) {
		if (this.#expanded !== (value = Boolean(value))) {
			this.#expanded = value;
			if (this.elementLoaded())
				this.element.classList.toggle("expanded", value);
		}
	}

	constructor(key: TKey, value: JsonToken<TValue>, filterableKey?: boolean) {
		super();
		const keyText = String(key);
		this.#key = key;
		this.#keyText = filterableKey ? [keyText, keyText.toLowerCase()] : [keyText];
		this.#value = value;
		this.#expanded = false;
	}

	protected show(filterText: string, isAppend: boolean): boolean {
		const kt = this.#keyText;
		const showKey = kt.length == 2 && showMatches(this.element.querySelector(".json-key")!, kt[0], kt[1]!, filterText);
		const showValue = this.#value.filter(filterText, isAppend);
		return showKey || showValue;
	}

	#toggleExpanded() {
		const expanded = !this.#expanded;
		this.#expanded = expanded;
		this.element.classList.toggle("expanded", expanded);
	}

	protected createElement(): HTMLElement {
		const [key] = this.#keyText;
		const value = this.#value;
		const child = value.element;
		const prop = DOM.createElement("div", {
			class: "json-prop",
			children: [
				DOM.createElement("span", {
					class: `json-key`,
					children: [ key ]
				})
			]
		});

		if (this.#expanded)
			prop.classList.add("expanded");
	
		if (value instanceof JsonContainer) {
			const expander = DOM.createElement("span", {
				class: "expander",
				events: {
					click: this.#toggleExpanded.bind(this)
				}
			});
	
			const count = DOM.createElement("span", {
				class: "summary-count summary-" + value.type,
				children: [ String(value.count) ]
			});
	
			prop.append(expander, count);
		}
	
		prop.appendChild(child);
		return prop;
	}

	toJSON(): never {
		throw new TypeError("Cannot serialize a JsonProperty directly.");
	}
	
	is(type: string): boolean {
		return type === "property";
	}
}

export class JsonObject<T extends object = any> extends JsonContainer<T, string> {
	readonly #props: Map<string, JsonProperty<string>>;

	get count(): number {
		return this.#props.size;
	}

	get type() {
		return "object" as const;
	}

	constructor(value?: T) {
		super();
		this.#props = new Map();
		if (value) {
			for (const key in value) {
				const token = JsonToken.from(value[key]);
				this.#props.set(key, new JsonProperty(key, token, true));
			}
		}
	}

	keys(): Iterable<string> {
		return this.#props.keys();
	}

	get(key: string): undefined | JsonToken {
		return this.#props.get(key);
	}

	properties(): Iterable<JsonProperty<string>> {
		return this.#props.values();
	}

	toJSON(): T {
		const obj: any = {};
		for (let [key, value] of this.#props)
			obj[key] = value.toJSON();

		return obj;
	}
	
	is(type: string): boolean {
		return type === "object";
	}
}

type Filterable = [text: string, lower: string];

export class JsonValue<T extends string | number | boolean | null> extends JsonToken<T> {
	readonly #value: T;
	readonly #text: Filterable;
	readonly #type: "string" | "number" | "boolean" | "null";

	get value() {
		return this.#value;
	}

	get type() {
		return this.#type;
	}

	constructor(value: T) {
		super();
		const text = String(value);
		this.#value = value;
		this.#text = [text, text.toLowerCase()];
		this.#type = value === null ? "null" : <any>typeof value;
	}

	protected createElement(): HTMLElement {
		let value: any = this.#value;
		if (value == null)
			value = String(value);
	
		return DOM.createElement("span", {
			class: `json-value json-${this.#type}`,
			children: [ value ]
		});
	}

	protected show(filterText: string): boolean {
		const [text, lower] = this.#text;
		return showMatches(this.element, text, lower, filterText);
	}

	toJSON(): T {
		return this.#value;
	}
	
	is(type: string): boolean {
		return type === this.#type;
	}
}

function toggleExpanded(this: HTMLElement) {
	this.parentElement?.classList.toggle("expanded");
}

function createPropElement(key: string, value: JsonToken) {
}

function showMatches(e: HTMLElement, text: string, lower: string, filterText: string): boolean {
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