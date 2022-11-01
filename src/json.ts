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

function resolveConstructor<T>(value: T): Constructor<JsonToken<T>, [scope: JsonScope, prop: null | JsonProperty, value: T]>
function resolveConstructor(value: any): Constructor<JsonToken, [scope: JsonScope, prop: null | JsonProperty, value: any]> {
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

function createPropertyElement(key: string, value: JsonToken, selected: boolean, expanded: boolean, onPropClick?: (evt: MouseEvent) => any, onExpanderClick?: (evt: MouseEvent) => any): HTMLElement {
	const child = value.element;
	const prop = DOM.createElement("div", {
		class: "json-prop",
		children: [
			DOM.createElement("span", {
				class: "json-key",
				children: [ key ],
				events: {
					click: onPropClick
				}
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

	if (selected)
		prop.classList.add("selected");

	if (expanded)
		prop.classList.add("expanded");

	if (value instanceof JsonContainer) {
		const expander = DOM.createElement("span", {
			class: "expander img-btn",
			events: {
				click: onExpanderClick
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
	} else if (value instanceof JsonValue) {
		const copyBtn = DOM.createElement("span", {
			props: {
				title: "Copy Value"
			},
			class: "btn copy-btn img-btn",
			events: {
				click() {
					navigator.clipboard.writeText(value.value);
				}
			}
		});

		prop.append(copyBtn);
	}

	prop.append(child);
	return prop;
}

//internal functions that we don't want to be accessible outside of this file, but need to be declared inside classes to access private members
let setSelected: (prop: JsonProperty) => void;
let jsonFilter: (this: JsonBase, text: string, isAppend: boolean, flags: JsonTokenFilterFlags, forceVisible: boolean) => boolean;
let jsonShow: (this: JsonBase, filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags) => boolean;

abstract class JsonBase {
	static {
		jsonShow = function(filterText, isAppend, flags) {
			return this.__show(filterText, isAppend, flags);
		}

		jsonFilter = function(text, isAppend, flags, forceVisible) {
			if (!this.#shown && isAppend)
				return false;

			const shown = jsonShow.call(this, text, isAppend, flags) || forceVisible;
			const e = this.#element;
			if (e != null)
				e.hidden = !shown;
	
			this.#shown = shown;
			return shown;
		}
	}

	readonly #scope: JsonScope;

	#element: null | HTMLElement;
	#shown: boolean;

	get scope() {
		return this.#scope;
	}

	get shown() {
		return this.#shown;
	}

	get element(): HTMLElement {
		if (this.#element == null) {
			this.#element = this.__createElement();
			this.#element.hidden = !this.#shown;
		}

		return this.#element;
	}

	protected constructor(scope: JsonScope) {
		this.#scope = scope;
		this.#element = null;
		this.#shown = true;
	}

	protected abstract __createElement(): HTMLElement;
	protected abstract __show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean;

	elementLoaded(): boolean {
		return this.#element !== null;
	}
}

export class ChangeEvent<V = any> extends Event {
	constructor(type: string, readonly oldValue: V, readonly newValue: V) {
		super(type)
	}
}

export type JsonScopeSelectedChangedEvent = ChangeEvent<null | JsonProperty>;

export class JsonScope<V = unknown> {
	static {
		setSelected = function (p) {
			const scope = p.scope;
			const old = scope.#selected;
			if (old === p)
				return;

			if (old != null && old.elementLoaded())
				old.element.classList.remove("selected");
			
			if (p != null && p.elementLoaded())
				p.element.classList.add("selected");

			scope.#selected = p;
			scope.#raise("selectedchanged", new ChangeEvent("selectedchanged", old, p));
		}
	}

	readonly #events: Map<string, Function[]>;
	readonly #root: JsonToken<V>;

	#element: null | HTMLElement;
	#selected: null | JsonProperty;
	#filter: string;
	#filterFlag: JsonTokenFilterFlags;

	get root() {
		return this.#root;
	}

	get element() {
		return this.#element ??= this.createElement();
	}

	get selected() {
		return this.#selected;
	}

	get filter() {
		return this.#filter;
	}

	set filter(value) {
		if (this.#filter !== (value = String(value))) {
			const isAppend = value.startsWith(this.#filter);
			this.#filter = value;
			jsonFilter.call(this.#root, value, isAppend, this.#filterFlag, false);
		}
	}

	get filterFlag() {
		return this.#filterFlag;
	}

	set filterFlag(value) {
		if (this.#filterFlag !== (value = Number(value))) {
			const isAppend = this.filterFlag === JsonTokenFilterFlags.Both;
			this.#filterFlag = value;
			jsonFilter.call(this.#root, this.#filter, isAppend, value, false);
		}
	}

	constructor(value: V) {
		const ctor = resolveConstructor(value);
		this.#events = new Map();
		this.#root = new ctor(this, null, value);
		this.#element = null;
		this.#selected = null;
		this.#filter = "";
		this.#filterFlag = JsonTokenFilterFlags.Both;
	}

	#raise(type: string, ...args: any[]) {
		let arr = this.#events.get(type);
		if (arr != null)
			for (let fn of arr)
				fn.apply(this, args);
	}

	on(type: "selectedchanged", eventHandler: Fn<[evt: ChangeEvent<JsonProperty>], any, this>): this;
	on(type: string, eventHandler: Fn<[evt: Event], any, this>): this;
	on(type: string, eventHandler: Function): this {
		let arr = this.#events.get(type);
		if (arr == null)
			this.#events.set(type, arr = []);

		arr.push(eventHandler);
		return this;
	}

	protected createElement(): HTMLElement {
		return createPropertyElement("$", this.#root, false, true);
	}
}

export class JsonProperty<TKey extends number | string = number | string, TValue = any> extends JsonBase {
	readonly #parent: JsonContainer<any, TKey>;
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

	get selected(): boolean {
		return this.scope.selected === this;
	}

	constructor(parent: JsonContainer<any, TKey>, key: TKey, value: TValue, filterableKey?: boolean) {
		super(parent.scope);
		const keyText = String(key);
		const ctor = resolveConstructor(value);
		this.#parent = parent;
		this.#key = key;
		this.#keyText = filterableKey ? [keyText, keyText.toLowerCase()] : [keyText];
		this.#value = new ctor(parent.scope, this, value);
		this.#expanded = false;
	}

	select() {
		setSelected(this);
	}

	protected __show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
		const kt = this.#keyText;
		const keyElement = this.element.querySelector(".json-key") as HTMLElement;
		const showKey = (flags & JsonTokenFilterFlags.Keys) !== 0 && kt.length == 2 && showMatches(keyElement, kt[0], kt[1]!, filterText);
		const showValue = jsonFilter.call(this.#value, filterText, isAppend, flags, showKey);
		if (!showKey)
			keyElement.innerText = kt[0];

		return showKey || showValue;
	}

	#toggleExpanded() {
		const expanded = !this.#expanded;
		this.#expanded = expanded;
		this.element.classList.toggle("expanded", expanded);
	}

	protected __createElement(): HTMLElement {
		const onExpanderClick = this.#toggleExpanded.bind(this);
		const onKeyClick = (e: Event) => {
			this.select();
			e.stopPropagation();
		}

		return createPropertyElement(this.#keyText[0], this.#value, this.selected, this.#expanded, onKeyClick, onExpanderClick);
	}
}

export abstract class JsonToken<T = unknown> extends JsonBase {
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

	protected constructor(scope: JsonScope, prop: null | JsonProperty) {
		super(scope);
		let root = prop?.parent?.root;
		this.#prop = prop;
		this.#root = root != null ? root : (this instanceof JsonContainer ? this : null);
	}

	abstract toJSON(): T;

	abstract resolve(path: string[]): null | JsonToken;

	abstract is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	abstract is(type: string): boolean;

	abstract properties(): Iterable<JsonProperty>;
	abstract get(key: number | string): undefined | JsonToken;
	abstract getProperty(key: number | string): undefined | JsonProperty;
	abstract keys(): Iterable<number | string>;
}

export abstract class JsonContainer<T = any, TKey extends string | number = string | number> extends JsonToken<T> {
	readonly #proxy: any;

	abstract get type(): "object" | "array";
	abstract get count(): number;

	get proxy() {
		return this.#proxy;
	}

	protected constructor(scope: JsonScope, prop: null | JsonProperty, handler: ProxyHandler<JsonContainer<T, TKey>>) {
		super(scope, prop);
		this.#proxy = new Proxy(this, handler);
	}

	protected __createElement(): HTMLElement {
		const container = DOM.createElement("div", {
			class: "json-container json-" + this.type
		});

		for (var child of this.properties())
			container.appendChild(child.element);

		return container;
	}

	protected __show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
		let any = false;
		for (let prop of this.properties())
			if (jsonFilter.call(prop, filterText, isAppend, flags, false))
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
			const keys: string[] = [];
			for (let i = 0; i < target.#items.length; i++)
				keys[i] = String(i);

			return keys;
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

	get count() {
		return this.#items.length;
	}

	constructor(scope: JsonScope, prop: null | JsonProperty, value: T[]) {
		super(scope, prop, JsonArray.#proxyHandler);
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

	get count() {
		return this.#props.size;
	}

	get type() {
		return "object" as const;
	}

	constructor(scope: JsonScope, prop: null | JsonProperty, value: T) {
		super(scope, prop, JsonObject.#proxyHandler);
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

	constructor(scope: JsonScope, prop: null | JsonProperty, value: T) {
		super(scope, prop);
		const text = String(value);
		this.#value = value;
		this.#text = [text, text.toLowerCase()];
		this.#type = value === null ? "null" : <any>typeof value;
	}

	protected __createElement(): HTMLElement {
		let value: any = this.#value;
		if (value == null)
			value = String(value);
	
		const span = DOM("span", {
			class: `json-value json-${this.#type}`
		});

		if (this.#type === "string" && (value.startsWith("http://") || value.startsWith("https://"))) {
			span.append("a", {
				props: {
					href: value,
					target: "_blank"
				},
				children: [
					value
				]
			})
		} else {
			span.appendText(value);
		}

		return span.element;
	}

	protected __show(filterText: string, _isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
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

	keys(): Iterable<never> {
		return Array.prototype as any;
	}

	properties(): Iterable<never> {
		return Array.prototype as any;
	}

	get(): undefined {
		return undefined;
	}

	getProperty(): undefined {
		return undefined;
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