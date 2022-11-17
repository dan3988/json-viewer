import DOM from "./html.js";

export interface JsonTokenTypeMap {
	"object": JsonObject;
	"array": JsonArray;
	"container": JsonContainer;
	"value": JsonValue;
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

function iterres<T>(done: true, value?: T): IteratorReturnResult<T>;
function iterres<T>(done: false, value: T): IteratorYieldResult<T>;
function iterres<T>(done: boolean, value: T): IteratorResult<T>;
function iterres(done: boolean, value?: any): IteratorResult<any> {
	return { done, value };
}

const enum JsonIteratorMode {
	Property, Key, Value
}

class JsonIterator<TKey extends string | number, TResult> implements Iterable<TResult>, Iterator<TResult, void> {
	static properties<TKey extends string | number>(container: JsonContainer<TKey, any>): JsonIterator<TKey, JsonProperty<TKey>> {
		return new JsonIterator(container, JsonIteratorMode.Property);
	}

	static keys<TKey extends string | number>(container: JsonContainer<TKey, any>): JsonIterator<TKey, TKey> {
		return new JsonIterator(container, JsonIteratorMode.Key);
	}

	static values<TKey extends string | number>(container: JsonContainer<TKey, any>): JsonIterator<TKey, JsonToken> {
		return new JsonIterator(container, JsonIteratorMode.Value);
	}

	readonly #container: JsonContainer<TKey, any>;
	readonly #mode: JsonIteratorMode;
	#current: null | JsonProperty<TKey>;

	constructor(container: JsonContainer<TKey, any>, mode: JsonIteratorMode) {
		this.#container = container;
		this.#mode = mode;
		this.#current = null;
	}

	next(): IteratorResult<TResult> {
		let next: null | JsonProperty<TKey>
		if (this.#current == null) {
			next = this.#container.first;
		} else {
			next = this.#current.next;
		}

		this.#current = next;
		if (next == null)
			return iterres(true);

		switch (this.#mode) {
			case JsonIteratorMode.Property:
				return iterres(false, <any>next);
			case JsonIteratorMode.Key:
				return iterres(false, <any>next.key);
			case JsonIteratorMode.Value:
				return iterres(false, <any>next.value);
		}
		
		throw null;
	}

	[Symbol.iterator](): this {
		return this;
	}
}

function resolveConstructor<T>(value: T): Constructor<JsonToken<T>, [scope: JsonScope<any>, prop: null | JsonProperty, value: T]>
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
	const child = loadElement(value);
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
		]
	});

	if (value.is("container"))
		prop.classList.add("for-" + value.type);

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
			children: [ value.count ]
		});

		prop.append(expander, count);
	}

	prop.append(child);
	return prop;
}

//internal functions that we don't want to be accessible outside of this file, but need to be declared inside classes to access private fields
let setSelected: (prop: JsonProperty, scroll?: boolean, blink?: boolean) => void;
let jsonFilter: (this: JsonBase, text: string, isAppend: boolean, flags: JsonTokenFilterFlags, forceVisible: boolean) => boolean;
let jsonShow: (this: JsonBase, filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags) => boolean;
let loadElement: (json: JsonBase) => HTMLElement;
let getElement: {
	(json: JsonBase): HTMLElement;
	(json: JsonBase | null): null | HTMLElement;
}

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

		loadElement = function(json) {
			if (json.#element == null)
				json.#element = json.__createElement();
			
			return json.#element;
		}

		getElement = function(json) {
			return (json == null ? null : json.#element)!;
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

	protected constructor(scope: JsonScope) {
		this.#scope = scope;
		this.#element = null;
		this.#shown = true;
	}

	protected abstract __createElement(): HTMLElement;
	protected abstract __show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean;

	protected elementLoaded(): boolean {
		return this.#element !== null;
	}
}

export class ChangeEvent<V = any> extends Event {
	constructor(type: string, readonly oldValue: V, readonly newValue: V) {
		super(type)
	}
}

export type JsonScopeSelectedChangedEvent = ChangeEvent<null | JsonProperty>;
export type ToToken<T> = T extends readonly any[] ? JsonArray<T> : (T extends object ? JsonObject<T> : (T extends JsonValueType ? JsonValue<T> : JsonToken))

export class JsonScope<V = unknown> {
	static {
		setSelected = function (p, scroll, blink) {
			p.scope.#setSelected(p, scroll, blink);
		}
	}

	readonly #events: Map<string, Function[]>;
	readonly #root: JsonToken<V>;

	#element: null | HTMLElement;
	#selected: null | JsonProperty;
	#filter: string;
	#filterFlag: JsonTokenFilterFlags;

	get root(): ToToken<V> {
		return this.#root as any;
	}

	get element() {
		return this.#element ??= this.#createElement();
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

	#setSelected(prop: null | JsonProperty, scroll?: boolean, blink?: boolean) {
		const old = this.#selected;
		if (old === prop) {
			if (scroll && old != null)
				old.scrollIntoView();

			return;
		}

		if (old != null)
			getElement(old).classList.remove("selected", "blink");
		
		if (prop != null) {
			const e = getElement(prop);
			e.classList.add("selected");
			if (blink)
				e.classList.add("blink");

			if (scroll) 
				prop.scrollIntoView();
		}

		this.#selected = prop;
		this.#raise("selectedchanged", new ChangeEvent("selectedchanged", old, prop));
	}

	deselect() {
		this.#setSelected(null);
	}

	#raise(type: string, ...args: any[]) {
		let arr = this.#events.get(type);
		if (arr != null)
			for (let fn of arr)
				fn.apply(this, args);
	}

	on(type: "selectedchanged", eventHandler: Fn<[evt: JsonScopeSelectedChangedEvent], any, this>): this;
	on(type: string, eventHandler: Fn<[evt: Event], any, this>): this;
	on(type: string, eventHandler: Function): this {
		let arr = this.#events.get(type);
		if (arr == null)
			this.#events.set(type, arr = []);

		arr.push(eventHandler);
		return this;
	}

	#createElement(): HTMLElement {
		return createPropertyElement("$", this.#root, false, true);
	}
}

export class JsonProperty<TKey extends number | string = number | string, TValue = any> extends JsonBase {
	readonly #parent: JsonContainer<TKey, any>;
	#prev: null | JsonProperty<TKey>;
	#next: null | JsonProperty<TKey>;
	readonly #key: TKey;
	readonly #keyText: [key: string, lower?: string];
	readonly #value: JsonToken<TValue>;
	#expanded: boolean;

	get parent() {
		return this.#parent;
	}
	
	get previous() {
		return this.#prev;
	}

	get next() {
		return this.#next;
	}

	get key() {
		return this.#key;
	}

	get value(): ToToken<TValue> {
		return this.#value as any;
	}

	get expanded() {
		return this.#expanded;
	}

	set expanded(value) {
		if (this.#expanded !== (value = Boolean(value))) {
			this.#expanded = value;
			getElement(this).classList.toggle("expanded", value);
		}
	}

	get selected(): boolean {
		return this.scope.selected === this;
	}

	constructor(parent: JsonContainer<TKey, any>, prev: null | JsonProperty<TKey>, key: TKey, value: TValue, filterableKey?: boolean) {
		super(parent.scope);
		const keyText = String(key);
		const ctor = resolveConstructor(value);
		this.#parent = parent;
		this.#prev = prev;
		this.#next = null;
		this.#key = key;
		this.#keyText = filterableKey ? [keyText, keyText.toLowerCase()] : [keyText];
		this.#value = new ctor(parent.scope, this, value);
		this.#expanded = false;

		if (prev != null)
			prev.#next = this;
	}

	scrollIntoView() {
		getElement(this).scrollIntoView({ block: "center" });
		//getElement(this).querySelector(".json-key")?.scrollIntoView({ block: "center" });
	}

	select(scroll?: boolean, blink?: boolean) {
		setSelected(this, scroll, blink);
	}

	protected __show(filterText: string, isAppend: boolean, flags: JsonTokenFilterFlags): boolean {
		const kt = this.#keyText;
		const keyElement = getElement(this).querySelector(".json-key") as HTMLElement;
		const showKey = (flags & JsonTokenFilterFlags.Keys) !== 0 && kt.length == 2 && showMatches(keyElement, kt[0], kt[1]!, filterText);
		const showValue = jsonFilter.call(this.#value, filterText, isAppend, flags, showKey);
		if (!showKey)
			keyElement.innerText = kt[0];

		return showKey || showValue;
	}

	toggleExpanded() {
		const expanded = !this.#expanded;
		this.#expanded = expanded;
		getElement(this).classList.toggle("expanded", expanded);
	}

	protected __createElement(): HTMLElement {
		const onExpanderClick = this.toggleExpanded.bind(this);
		const onKeyClick = (e: Event) => {
			this.select();
			e.stopPropagation();
		}

		return createPropertyElement(this.#keyText[0], this.#value, this.selected, this.#expanded, onKeyClick, onExpanderClick);
	}
}

export abstract class JsonToken<T = any> extends JsonBase {
	readonly #root: null | JsonContainer;
	readonly #prop: null | JsonProperty;
	readonly #path: (string | number)[];

	get root() {
		return this.#root;
	}

	get parent(): null | JsonContainer {
		return this.#prop?.parent ?? null;
	}

	get parentProperty() {
		return this.#prop;
	}

	get path(): readonly (string | number)[] {
		return this.#path;
	}

	abstract get proxy(): T;
	abstract get type(): keyof JsonTokenTypeMap;

	protected constructor(scope: JsonScope, prop: null | JsonProperty) {
		super(scope);
		if (prop == null) {
			this.#root = this instanceof JsonContainer ? this : null;
			this.#prop = null;
			this.#path = ["$"];
		} else {
			this.#root = prop.parent.root;
			this.#prop = prop;
			this.#path = Array.from(prop.parent.#path);
			this.#path.push(prop.key);
		}
		let root = prop?.parent?.root;
		this.#prop = prop;
		this.#root = root != null ? root : (this instanceof JsonContainer ? this : null);
	}

	abstract toJSON(): T;

	abstract resolve(path: string[]): null | JsonToken;

	abstract is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];

	abstract properties(): Iterable<JsonProperty>;
	abstract get(key: number | string): undefined | JsonToken;
	abstract getProperty(key: number | string): undefined | JsonProperty;
	abstract keys(): Iterable<number | string>;
}

export abstract class JsonContainer<TKey extends string | number = string | number, T = any> extends JsonToken<T> {
	readonly #proxy: any;

	abstract get type(): "object" | "array";
	abstract get count(): number;
	abstract get first(): null | JsonProperty<TKey>;
	abstract get last(): null | JsonProperty<TKey>;

	get proxy() {
		return this.#proxy;
	}

	protected constructor(scope: JsonScope, prop: null | JsonProperty, handler: ProxyHandler<JsonContainer<TKey, T>>) {
		super(scope, prop);
		this.#proxy = new Proxy(this, handler);
	}

	protected __createElement(): HTMLElement {
		const container = DOM.createElement("div", {
			class: "json-container json-" + this.type
		});

		for (var child of this.properties()) {
			const e = loadElement(child);
			container.appendChild(e);
		}

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

	properties(): IterableIterator<JsonProperty<TKey>> {
		return JsonIterator.properties(this);
	}

	keys(): IterableIterator<TKey> {
		return JsonIterator.keys(this);
	}

	values(): IterableIterator<JsonToken> {
		return JsonIterator.values(this);
	}

	abstract get(key: TKey): undefined | JsonToken;
	abstract getProperty(key: TKey): undefined | JsonProperty<TKey>;
}

export class JsonArray<T extends readonly any[] = readonly any[]> extends JsonContainer<number & keyof T, T> {
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

			desc.configurable = true;
			desc.writable = false;
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
	readonly #first: null | JsonProperty<number>;
	readonly #last: null | JsonProperty<number>;

	get first() {
		return this.#first;
	}

	get last() {
		return this.#last;
	}

	get type() {
		return "array" as const;
	}

	get count() {
		return this.#items.length;
	}

	constructor(scope: JsonScope, prop: null | JsonProperty, value: T[]) {
		super(scope, prop, JsonArray.#proxyHandler as any);
		if (value && value.length) {
			let prop = new JsonProperty(this, null, 0, value[0], false);
			this.#items = Array(value.length);
			this.#items[0] = prop;
			this.#first = prop;
			for (let i = 1; i < value.length; i++)
				this.#items[i] = prop = new JsonProperty(this, prop, i, value[i], false);

			this.#last = prop;
		} else {
			this.#items = [];
			this.#first = null;
			this.#last = null;
		}
	}

	getProperty<K extends number & keyof T>(key: K): JsonProperty<K, JsonToken<T[K]>>;
	getProperty(key: number): undefined | JsonProperty<number & keyof T>;
	getProperty(key: number): undefined | JsonProperty<number & keyof T> {
		return this.#items.at(key);
	}

	get<K extends number & keyof T>(key: K): ToToken<T[K]>;
	get(key: number): undefined | JsonToken;
	get(key: number): undefined | JsonToken {
		return this.#items.at(key)?.value;
	}

	toJSON(): T {
		const elements = this.#items;
		const value = Array(elements.length);
		for (let i = 0; i < value.length; i++)
			value[i] = elements[i].value.toJSON();

		return value as any;
	}

	is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	is(type: string): boolean {
		return type === "container" || type === "array";
	}
}

export class JsonObject<T extends object = any> extends JsonContainer<string & keyof T, T> {
	static readonly #proxyHandler: ProxyHandler<JsonObject<any>> = {
		has(target, p) {
			return typeof p === "string" ? target.#props.has(p) : p === Symbol.toPrimitive;
		},
		ownKeys(target) {
			const keys: (string | symbol)[] = Array.from(target.#props.keys());
			keys.push(Symbol.toPrimitive);
			return keys;
		},
		getOwnPropertyDescriptor(target, p) {
			const value = target.#reflectGet(p, true);
			if (value === undefined)
				return;

			return {
				configurable: true,
				enumerable: value[1],
				value: value[0]
			}
		},
		getPrototypeOf() {
			return Object.prototype;
		},
		get(target, p) {
			return target.#reflectGet(p);
		}
	}

	#reflectGet(key: string | symbol, wrap: true): undefined | [value: any, enumerable: boolean]
	#reflectGet(key: string | symbol, wrap?: false): any 
	#reflectGet(key: string | symbol, wrap?: boolean): any {
		if (typeof key === "string") {
			const prop = this.#props.get(key);
			if (prop == null)
				return undefined;

			return wrap ? [prop.value.proxy, true] : prop.value.proxy;
		} else if (key === Symbol.toPrimitive) {
			return wrap ? [Object.prototype.toString, false] : Object.prototype.toString;
		}
	}

	readonly #props: Map<string, JsonProperty<string & keyof T>>;
	readonly #first: null | JsonProperty<string & keyof T>;
	readonly #last: null | JsonProperty<string & keyof T>;

	get first() {
		return this.#first;
	}

	get last() {
		return this.#last;
	}

	get count() {
		return this.#props.size;
	}

	get type() {
		return "object" as const;
	}

	constructor(scope: JsonScope, prop: null | JsonProperty, value: T) {
		super(scope, prop, JsonObject.#proxyHandler as any);
		this.#props = new Map();
		if (value) {
			type Key = string & keyof T;

			const keys = Object.keys(value) as Array<Key>;
			if (keys.length) {
				let key = keys[0];
				let item = (value as any)[key];
				let prop = new JsonProperty<Key>(this, null, key, item, true);

				this.#props.set(key, prop);
				this.#first = prop;
				for (let i = 1; i < keys.length; i++) {
					key = keys[i];
					item = (value as any)[key];
					prop = new JsonProperty<Key>(this, prop, key, item, true);
					this.#props.set(key, prop);
				}

				this.#last = prop;
				return;
			}
		}

		this.#first = null;
		this.#last = null;
	}

	getProperty<K extends string & keyof T>(key: K): JsonProperty<K, JsonToken<T[K]>>;
	getProperty(key: string): undefined | JsonProperty<string & keyof T>;
	getProperty(key: string): undefined | JsonProperty<string & keyof T> {
		return this.#props.get(key);
	}

	get<K extends string & keyof T>(key: K): ToToken<T[K]>;
	get(key: string): undefined | JsonToken;
	get(key: string): undefined | JsonToken {
		return this.#props.get(key)?.value;
	}

	toJSON(): T {
		const obj: any = {};
		for (let { key, value } of this.#props.values())
			obj[key] = value.toJSON();

		return obj;
	}

	is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	is(type: string): boolean {
		return type === "container" || type === "object";
	}
}

type Filterable = [text: string, lower: string];
type JsonValueType = string | number | boolean | null;

export class JsonValue<T extends JsonValueType = JsonValueType> extends JsonToken<T> {
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
		const e = getElement(this);
		if ((flags & JsonTokenFilterFlags.Values) === 0) {
			e.innerText = text;
			return false;
		}

		return showMatches(e, text, lower, filterText);
	}

	resolve(): JsonToken<any> | null {
		return null;
	}

	toJSON(): T {
		return this.#value;
	}

	is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	is(type: string): boolean {
		return type === "value" || type === this.#type;
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