import DOM from "./html.js";

export interface JsonTokenTypeMap {
	"object": JsonObject;
	"array": JsonArray;
	"string": JsonValue<string>;
	"number": JsonValue<number>;
	"boolean": JsonValue<boolean>;
	"null": JsonValue<null>;
}

// export enum JsonTokenType {
// 	None		= 0,
// 	Null		= 1 << 0,
// 	String		= 1 << 1,
// 	Number 		= 1 << 2,
// 	Boolean		= 1 << 3,
// 	Array		= 1 << 4,
// 	Object		= 1 << 5,
// 	Value		= Null | String | Number | Boolean,
// 	Container	= Array | Object,
// }

export const enum JsonTokenFilterFlags {
	None,
	Keys = 1,
	Values = 2,
	Both = Keys | Values
}

function resolveConstructor<T>(value: T): Constructor<JsonToken<T>, [parent: null | JsonProperty, value: T]>
function resolveConstructor(value: any): Constructor<JsonToken, [parent: null | JsonProperty, value: any]> {
	if (value == null)
		return JsonValue;

	const type = typeof value;

	switch (type) {
		case "string":
		case "number":
		case "boolean":
			return JsonValue;
		case "object":
			return value instanceof Array ? JsonArray : JsonObject;
	}

	throw new TypeError("Values of type \"" + type + "\" are not supported in JSON.");
}

abstract class JsonBase {
	#element: null | HTMLElement;

	get element(): HTMLElement {
		return this.#element ??= this.createElement();
	}

	protected constructor() {
		this.#element = null;
	}

	protected abstract show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean;
	protected abstract createElement(): HTMLElement;

	protected elementLoaded(): boolean {
		return this.#element !== null;
	}
	
	filter(text: string, isAppend: boolean, flags: JsonTokenFilterFlags, forceVisible: boolean): boolean {
		const e = this.#element;
		if (e == null || (e.hidden && isAppend))
			return false;

		const shown = this.show(text, isAppend, flags);
		e.hidden = !forceVisible && !shown;
		return shown;
	}
}

export class JsonProperty<TKey extends number | string = number | string, TValue = any> extends JsonBase {
	readonly #parent: null | JsonContainer<any, TKey>;
	readonly #key: TKey;
	readonly #keyText: [key: string, lower?: string];
	readonly #value: JsonToken<TValue>;
	#expanded: boolean;

	get parent() {
		return this.#parent;
	}

	get key() {
		return this.#key;
	}

	get value() {
		return this.#value;
	}

	get expanded() {
		return this.#expanded;
	}

	set expanded(value) {
		if (this.#expanded !== (value = Boolean(value))) {
			this.#expanded = value;
			if (this.elementLoaded())
				this.element.classList.toggle("expanded", value);
		}
	}

	constructor(parent: null | JsonContainer<any, TKey>, key: TKey, value: TValue, filterableKey?: boolean) {
		super();
		const keyText = String(key);
		const ctor = resolveConstructor(value);
		this.#parent = parent;
		this.#key = key;
		this.#keyText = filterableKey ? [keyText, keyText.toLowerCase()] : [keyText];
		this.#value = new ctor(this, value);
		this.#expanded = false;
	}

	protected show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
		const kt = this.#keyText;
		const keyElement = this.element.querySelector(".json-key") as HTMLElement;
		const showKey = (flags & JsonTokenFilterFlags.Keys) !== 0 && kt.length == 2 && showMatches(keyElement, kt[0], kt[1]!, filterText);
		const showValue = this.#value.filter(filterText, isAppend, flags, showKey);
		if (!showKey)
			keyElement.innerText = kt[0];

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
			],
			events: {
				mouseenter() {
					this.parentElement?.closest(".json-prop")?.classList.add("hv-child");
					this.classList.add("hv");
				},
				mouseleave() {
					this.parentElement?.closest(".json-prop")?.classList.remove("hv-child");
					this.classList.remove("hv");
				}
			}
		});

		if (this.#expanded)
			prop.classList.add("expanded");
	
		if (value instanceof JsonContainer) {
			const expander = DOM.createElement("span", {
				class: "expander img-btn",
				events: {
					click: this.#toggleExpanded.bind(this)
				}
			});
	
			const count = DOM.createElement("span", {
				class: "summary-count summary-" + value.type,
				children: [ String(value.count) ]
			});

			const copyBtn = DOM.createElement("span", {
				props: {
					title: "Copy JSON"
				},
				class: "btn copy-btn img-btn",
				events: {
					click() {
						const json = JSON.stringify(value, undefined, "\t");
						navigator.clipboard.writeText(json);
					}
				}
			})

			prop.append(expander, count, copyBtn);
		}
	
		prop.appendChild(child);
		return prop;
	}
}

export abstract class JsonToken<T = unknown> extends JsonBase {
	static from<T extends string | number | boolean | null>(value: string): JsonValue<T>;
	static from<T extends object>(value: T): JsonObject<T>;
	static from<T>(value: T[]): JsonArray<T>;
	static from<T>(value: T): JsonToken<T>;
	static from(value: any): JsonToken {
		const ctor = resolveConstructor(value);
		return new ctor(null, value);
	}

	readonly #root: null | JsonContainer;
	readonly #prop: null | JsonProperty;

	get root() {
		return this.#root;
	}

	get parent(): null | JsonContainer {
		return this.#prop?.parent ?? null;
	}

	get parentProperty() {
		return this.#prop;
	}

	abstract get proxy(): any;
	abstract get type(): keyof JsonTokenTypeMap;

	protected constructor(prop: null | JsonProperty) {
		super();
		let root = prop?.parent?.root;
		this.#prop = prop;
		this.#root = root != null ? root : (this instanceof JsonContainer ? this : null);
	}

	abstract toJSON(): T;

	abstract resolve(path: string[]): null | JsonToken;

	abstract is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	abstract is(type: string): boolean;
}

export abstract class JsonContainer<T = any, TKey extends string | number = string | number> extends JsonToken<T> {
	readonly #proxy: any;

	abstract get type(): "object" | "array";
	abstract get count(): number;

	get proxy() {
		return this.#proxy;
	}

	protected constructor(prop: null | JsonProperty, handler: ProxyHandler<JsonContainer<T, TKey>>) {
		super(prop);
		this.#proxy = new Proxy(this, handler);
	}

	protected createElement(): HTMLElement {
		const container = DOM.createElement("div", {
			class: "json-container json-" + this.type
		});

		for (var child of this.properties())
			container.appendChild(child.element);

		return container;
	}

	protected show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
		let any = false;
		for (let prop of this.properties())
			if (prop.filter(filterText, isAppend, flags, false))
				any = true;

		return any;
	}

	resolve(path: string[]) {
		let container: JsonContainer = this;
		let i = 0;
		while (true) {
			const key = path[i];
			const child = container.get(key);
			if (child == null)
				return null;

			if (++i === path.length)
				return child;

			if (!(child instanceof JsonContainer))
				return null;
			
			container = child;
		}
	}

	abstract properties(): Iterable<JsonProperty<TKey>>;
	abstract get(key: TKey): undefined | JsonToken;
	abstract getProperty(key: TKey): undefined | JsonProperty<TKey>;
	abstract keys(): Iterable<TKey>;
}

export class JsonArray<T = any> extends JsonContainer<T[], number> {
	static readonly #proxyHandler: ProxyHandler<JsonArray> = {
		has(target, p) {
			return p in target.#items;
		},
		ownKeys(target) {
			return Array.prototype.map.call(target.keys(), String) as string[];
		},
		getOwnPropertyDescriptor(target, p) {
			let desc = Reflect.getOwnPropertyDescriptor(target.#items, p);
			if (desc === undefined)
				return;

			if (desc.value instanceof JsonProperty)
				desc.value = desc.value.value.proxy;

			return desc;
		},
		getPrototypeOf() {
			return Array.prototype;
		},
		get(target, p) {
			let value = Reflect.get(target.#items, p);
			if (value instanceof JsonProperty)
				value = value.value.proxy;

			return value;
		}
	}

	readonly #items: JsonProperty<number>[];

	get type() {
		return "array" as const;
	}

	get count(): number {
		return this.#items.length;
	}

	constructor(prop: null | JsonProperty, value: T[]) {
		super(prop, JsonArray.#proxyHandler);
		if (value && value.length) {
			this.#items = Array(value.length);
			for (let i = 0; i < value.length; i++)
				this.#items[i] = new JsonProperty(this, i, value[i], false);
		} else {
			this.#items = [];
		}
	}

	*keys(): Iterable<number> {
		for (let i = 0; i < this.#items.length; i++)
			yield i;
	}

	get(key: number): undefined | JsonToken {
		return this.#items.at(key)?.value;
	}

	getProperty(key: number): undefined | JsonProperty<number, any> {
		return this.#items.at(key);
	}

	properties(): Iterable<JsonProperty<number>> {
		return this.#items;
	}

	toJSON(): T[] {
		const elements = this.#items;
		const value = Array(elements.length);
		for (let i = 0; i < value.length; i++)
			value[i] = elements[i].value.toJSON();

		return value;
	}
	
	is(type: string): boolean {
		return type === "array";
	}
}

export class JsonObject<T extends object = any> extends JsonContainer<T, string> {
	static readonly #proxyHandler: ProxyHandler<JsonObject> = {
		has(target, p) {
			return typeof p === "string" && target.#props.has(p);
		},
		ownKeys(target) {
			return Array.from(target.#props.keys());
		},
		getOwnPropertyDescriptor(target, p) {
			const value = target.#props.get(p as any);
			if (value == null)
				return;

			return {
				configurable: true,
				enumerable: true,
				value
			}
		},
		getPrototypeOf() {
			return Object.prototype;
		},
		get(target, p) {
			return target.#props.get(p as any)?.value.proxy;
		}
	}

	readonly #props: Map<string, JsonProperty<string>>;

	get count(): number {
		return this.#props.size;
	}

	get type() {
		return "object" as const;
	}

	constructor(prop: null | JsonProperty, value: T) {
		super(prop, JsonObject.#proxyHandler);
		this.#props = new Map();
		if (value) {
			for (const key in value) {
				const item = value[key];
				const prop = new JsonProperty(this, key, item, true);
				this.#props.set(key, prop);
			}
		}
	}

	keys(): Iterable<string> {
		return this.#props.keys();
	}

	getProperty(key: string): undefined | JsonProperty<string> {
		return this.#props.get(key);
	}

	get(key: string): undefined | JsonToken {
		return this.#props.get(key)?.value;
	}

	properties(): Iterable<JsonProperty<string>> {
		return this.#props.values();
	}

	toJSON(): T {
		const obj: any = {};
		for (let { key, value } of this.#props.values())
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

	get proxy() {
		return this.#value;
	}

	get value() {
		return this.#value;
	}

	get type() {
		return this.#type;
	}

	constructor(prop: null | JsonProperty, value: T) {
		super(prop);
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

	protected show(filterText: string, _isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
		const [text, lower] = this.#text;
		if ((flags & JsonTokenFilterFlags.Values) === 0) {
			this.element.innerText = text;
			return false;
		}

		return showMatches(this.element, text, lower, filterText);
	}

	resolve(): JsonToken<unknown> | null {
		return null;
	}

	toJSON(): T {
		return this.#value;
	}
	
	is(type: string): boolean {
		return type === this.#type;
	}
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