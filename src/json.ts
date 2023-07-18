import ArrayLikeProxy, { type ReadOnlyArrayLikeProxyHandler } from "./array-like-proxy.js";
import { PropertyBag } from "./prop.js";
import { EventHandlers, type IEvent } from "./evt.js";
import Linq from "@daniel.pickett/linq-js";

type Key = string | number;
type JsonValueType = string | number | boolean | null;

interface JsonPropertyBag {
	isHidden: boolean;
	isExpanded: boolean;
	isSelected: boolean;
}

interface JsonClass<T extends json.JsonToken = json.JsonToken> {
	readonly prototype: T;
	new(owner: JsonProperty): T;
}

function defaultCompare(x: JsonPropertyController<string>, y: JsonPropertyController<string>) {
	return x.key.localeCompare(y.key, undefined, { sensitivity: "base" });
}

function iterres<T>(done: true, value?: T): IteratorReturnResult<T>;
function iterres<T>(done: false, value: T): IteratorYieldResult<T>;
function iterres<T>(done: boolean, value: T): IteratorResult<T>;
function iterres(done: boolean, value?: any): IteratorResult<any> {
	return { done, value };
}

interface ChildrenChangedEvents<TKey extends Key = any> {
	added: [added: JsonProperty<TKey>];
	addedRange: [added: JsonProperty<TKey>[]]
	removed: [removed: JsonProperty<TKey>];
	removedRange: [removed: JsonProperty<TKey>[]];
	reset: [];
	replaced: [old: JsonProperty<TKey>, new: JsonProperty<TKey>];
}

type ChildrenChangedArgs<TKey extends Key = Key> = { [P in keyof ChildrenChangedEvents]: [type: P, ...args: ChildrenChangedEvents<TKey>[P]] }[keyof ChildrenChangedEvents]

enum FilterFlags {
	None,
	Keys = 1,
	Values = 2,
	Both = Keys | Values
}

export declare namespace json {
	export interface JsonTokenTypeMap {
		"container": JsonContainer;
		"property": JsonProperty;
		"value": JsonValue;
	}
	
	export interface JsonTokenSubTypeMap {
		"object": JsonObject;
		"array": JsonArray;
		"string": JsonValue<string>;
		"number": JsonValue<number>;
		"boolean": JsonValue<boolean>;
		"null": JsonValue<null>;
	}

	export enum JsonTokenFilterFlags {
		None,
		Keys = 1,
		Values = 2,
		Both = Keys | Values
	}
	
	export interface JsonProperty<TKey extends Key = Key> {
		readonly key: TKey;
		readonly value: JsonToken;
		readonly parent: null | JsonContainer<TKey>;
		readonly previous: null | JsonProperty<TKey>;
		readonly next: null | JsonProperty<TKey>;
		readonly path: readonly Key[];
		readonly bag: PropertyBag<JsonPropertyBag>;

		readonly isHidden: boolean;
		isExpanded: boolean;
		isSelected: boolean;

		setExpanded(expanded: boolean, recursive?: boolean): void;
		remove(): boolean;
		toggleExpanded(): boolean;
		filter(filter: string, filterMode: JsonTokenFilterFlags, isAppend: boolean): boolean;
	}

	export const JsonToken: JsonClass<JsonToken>;
	export const JsonValue: JsonClass<JsonValue>;
	export const JsonContainer: JsonClass<JsonContainer>;
	export const JsonArray: JsonClass<JsonArray>;
	export const JsonObject: JsonClass<JsonObject>;

	export interface JsonToken<T = any> extends Iterable<JsonProperty> {
		readonly type: keyof JsonTokenTypeMap;
		readonly subtype: keyof JsonTokenSubTypeMap;
		readonly proxy: T;
		readonly parent: null | JsonContainer;
		readonly owner: JsonProperty;

		is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
		is<K extends keyof JsonTokenSubTypeMap>(type: K): this is JsonTokenSubTypeMap[K];

		get(key: Key): undefined | JsonToken;
		getProperty(key: Key): undefined | JsonProperty;

		keys(): IterableIterator<Key>;
		values(): IterableIterator<JsonToken>;

		[Symbol.iterator](): IterableIterator<JsonProperty>;

		toJSON(): T;
		toString(indent?: string): string;
	}

	export interface JsonValue<T extends JsonValueType = JsonValueType> extends JsonToken<T> {
		readonly type: "value";
		readonly subtype: "string" | "number" | "boolean" | "null";
		value: T;

		get(): undefined;
		getProperty(): undefined;

		keys(): IterableIterator<never>;
		values(): IterableIterator<never>;

		[Symbol.iterator](): IterableIterator<never>;
	}

	export interface JsonContainerAddMap {
		"value": JsonValue;
		"array": JsonArray;
		"object": JsonObject;
	}
	
	export interface JsonContainer<TKey extends Key = Key, T = any> extends JsonToken<T> {
		readonly type: "container";
		readonly subtype: "array" | "object";
		readonly first: null | JsonProperty<TKey>;
		readonly last: null | JsonProperty<TKey>;
		readonly count: number;
		readonly changed: IEvent<this, ChildrenChangedArgs>;

		getProperty(key: Key): undefined | JsonProperty<TKey>;
		remove(key: Key): undefined | JsonProperty<TKey>;
		clear(): boolean;

		[Symbol.iterator](): IterableIterator<JsonProperty<TKey>>;
	}

	export interface JsonArray<T = any> extends JsonContainer<number, readonly T[]> {
		readonly subtype: "array";

		add<K extends keyof JsonContainerAddMap>(type: K, index?: number): JsonContainerAddMap[K];
	}

	export interface JsonObject<T = any> extends JsonContainer<string, Readonly<Dict<T>>> {
		readonly subtype: "object";

		add<K extends keyof JsonContainerAddMap>(key: string, type: K): JsonContainerAddMap[K];
		sort(reverse?: boolean): void;
	}
}

const empty = Linq.empty();

interface InternalJsonContainerAddMap {
	"value": JsonValue;
	"array": JsonArray;
	"object": JsonObject;
}

function resolveClass<K extends keyof json.JsonContainerAddMap>(type: K): JsonClass<InternalJsonContainerAddMap[K]>
function resolveClass(type: string): JsonClass {
	switch (type) {
		case "value":
			return JsonValue;
		case "array":
			return JsonArray;
		case "object":
			return JsonObject;
	}

	throw new TypeError('Unknown type: "' + type + '"');
}

const enum JsonIteratorMode {
	Property, Key, Value
}

class JsonIterator<TKey extends Key, TResult> implements Iterable<TResult>, Iterator<TResult, void> {
	static properties<TKey extends Key>(container: JsonContainer<TKey, any>): JsonIterator<TKey, JsonProperty<TKey>> {
		return new JsonIterator(container, JsonIteratorMode.Property);
	}

	static keys<TKey extends Key>(container: JsonContainer<TKey, any>): JsonIterator<TKey, TKey> {
		return new JsonIterator(container, JsonIteratorMode.Key);
	}

	static values<TKey extends Key>(container: JsonContainer<TKey, any>): JsonIterator<TKey, JsonToken> {
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

/** properties that should not be exposed outside this file */
class JsonPropertyController<TKey extends Key = Key, TValue extends JsonToken = JsonToken> {
	readonly #prop: JsonProperty<TKey, TValue>;
	parent: null | JsonContainer<TKey>;
	key: TKey;
	previous: null | JsonPropertyController<TKey>;
	next: null | JsonPropertyController<TKey>;

	get prop() {
		return this.#prop;
	}

	get value() {
		return this.#prop.value;
	}

	constructor(key: TKey, clazz: JsonClass<TValue>) {
		this.#prop = new JsonProperty(this, clazz);
		this.parent = null;
		this.key = key;
		this.previous = null;
		this.next = null;
	}

	removed() {
		this.parent = null;
		this.previous = null;
		this.next = null;
	}
}

class JsonProperty<TKey extends Key = Key, TValue extends JsonToken = JsonToken> implements json.JsonProperty<TKey> {
	readonly #controller: JsonPropertyController<TKey>;
	readonly #value: TValue;
	readonly #bag: PropertyBag<JsonPropertyBag>;

	get key() {
		return this.#controller.key;
	}

	get value() {
		return this.#value;
	}

	get parent() {
		return this.#controller.parent;
	}

	get previous() {
		const prev = this.#controller.previous;
		return prev && prev.prop;
	}

	get next() {
		const next = this.#controller.next;
		return next && next.prop;
	}

	get path() {
		const p: Key[] = [];
		this.#buildPath(p);
		return p;
	}

	get bag() {
		return this.#bag;
	}

	get isHidden() {
		return this.#bag.getValue("isHidden");
	}

	get isExpanded() {
		return this.#bag.getValue("isExpanded");
	}

	set isExpanded(value) {
		this.#bag.setValue("isExpanded", value);
	}

	get isSelected() {
		return this.#bag.getValue("isSelected");
	}

	set isSelected(value) {
		this.#bag.setValue("isSelected", value);
	}

	constructor(controller: JsonPropertyController<TKey>, clazz: JsonClass<TValue>) {
		this.#controller = controller;
		this.#value = new clazz(this);
		this.#bag = new PropertyBag<JsonPropertyBag>({ isSelected: false, isExpanded: false, isHidden: false });
	}

	#buildPath(path: Key[]) {
		if (this.parent != null)
			this.parent.owner.#buildPath(path);

		path.push(this.key);
	}

	setExpanded(expanded: boolean, recursive?: boolean) {
		this.#bag.setValue("isExpanded", expanded);
		if (!recursive)
			return;

		const stack: Iterator<JsonProperty>[] = [];
		let cur: Iterator<JsonProperty> = this.value[Symbol.iterator]()
		while (true) {
			let r = cur.next();
			if (r.done) {
				let last = stack.pop();
				if (last == null)
					return;

				cur = last;
			} else {
				r.value.isExpanded = expanded;
				const it = r.value.value[Symbol.iterator]();
				stack.push(it);
			}
		}
	}

	remove() {
		const p = this.parent;
		return !!(p && p.remove(this.key));
	}

	toggleExpanded() {
		const v = !this.#bag.getValue("isExpanded");
		this.#bag.setValue("isExpanded", v);
		return v;
	}

	filter(filter: string, filterMode: json.JsonTokenFilterFlags, isAppend: boolean) {
		if (isAppend && this.isHidden)
			return false;

		const showKey = Boolean(filterMode & json.JsonTokenFilterFlags.Keys) && String.prototype.toLowerCase.call(this.key).includes(filter);
		const showValue = this.#value.__shown(filter, filterMode, isAppend);
		const show = showKey || showValue;
		this.#bag.setValue("isHidden", !show);
		return show;
	}
}

abstract class JsonToken<T = any> implements json.JsonToken<T> {
	readonly #owner: JsonProperty;

	get parent() {
		return this.#owner.parent;
	}

	get owner() {
		return this.#owner;
	}

	abstract get type(): keyof json.JsonTokenTypeMap;
	abstract get subtype(): keyof json.JsonTokenSubTypeMap;
	abstract get proxy(): T;

	constructor(owner: JsonProperty) {
		this.#owner = owner;
	}

	/** @internal */
	abstract __shown(filter: string, filterMode: json.JsonTokenFilterFlags, isAppend: boolean): boolean;

	abstract get(key: Key): undefined | JsonToken;
	abstract getProperty(key: Key): undefined | JsonProperty;

	abstract keys(): IterableIterator<Key>;
	abstract values(): IterableIterator<JsonToken>;

	abstract [Symbol.iterator](): IterableIterator<JsonProperty>;

	is<K extends keyof json.JsonTokenTypeMap>(type: K): this is json.JsonTokenTypeMap[K];
	is<K extends keyof json.JsonTokenSubTypeMap>(type: K): this is json.JsonTokenSubTypeMap[K];
	is(type: string): boolean {
		return type === this.type || type === this.subtype;
	}

	abstract toJSON(): T;
	
	toString(indent?: string | undefined) {
		return JSON.stringify(this.proxy, undefined, indent); 
	}
}

class JsonValue extends JsonToken implements json.JsonValue {
	#value: JsonValueType;
	#subtype: "string" | "number" | "boolean" | "null";

	get type() {
		return "value" as const;
	}

	get subtype() {
		return this.#subtype;
	}

	get proxy() {
		return this.#value;
	}

	get value() {
		return this.#value;
	}

	set value(value) {
		if (this.#value !== value) {
			if (value === null) {
				this.#value = null;
				this.#subtype = "null";
			} else {
				const t = typeof value;
				if (t === "string" || t === "number" || t === "boolean") {
					this.#value = value;
					this.#subtype = t;
				} else {
					throw new TypeError('JsonValue.value cannot be of type "' + t + '"');
				}
			}
		}
	}

	constructor(owner: JsonProperty) {
		super(owner);
		this.#value = null;
		this.#subtype = "null";
	}

	/** @internal */
	__shown(filter: string, filterMode: json.JsonTokenFilterFlags): boolean {
		if ((filterMode & json.JsonTokenFilterFlags.Values) === 0) 
			return false;

		const str = this.#value === null ? "null" :  String.prototype.toLowerCase.call(this.#value);
		return str.includes(filter);
	}


	toJSON() {
		return this.#value;
	}

	get(): undefined {
	}

	getProperty(): undefined {
	}

	keys(): IterableIterator<never> {
		return empty[Symbol.iterator]();
	}

	values(): IterableIterator<never> {
		return empty[Symbol.iterator]();
	}

	[Symbol.iterator](): IterableIterator<never> {
		return empty[Symbol.iterator]();
	}
}

interface InternalJsonObject extends json.JsonObject {
	add<K extends keyof InternalJsonContainerAddMap>(key: string, type: K): InternalJsonContainerAddMap[K];
}

interface InternalJsonArray extends json.JsonArray {
	add<K extends keyof InternalJsonContainerAddMap>(type: K, index?: number): InternalJsonContainerAddMap[K];
}

type JsonObject = JsonContainer<string> & InternalJsonObject;
type JsonObjectConstructor = JsonClass<JsonObject>;

type JsonArray = JsonContainer<number> & InternalJsonArray;
type JsonArrayConstructor = JsonClass<JsonArray>;

let JsonObject: JsonObjectConstructor;
let JsonArray: JsonArrayConstructor;

abstract class JsonContainer<TKey extends Key = Key, T = any> extends JsonToken<T> implements json.JsonContainer<TKey, T> {
	readonly #changed: EventHandlers<any, ChildrenChangedArgs>;
	#first: null | JsonPropertyController<TKey>;
	#last: null | JsonPropertyController<TKey>;

	get type() {
		return "container" as const;
	}

	get first() {
		const first = this.#first;
		return first && first.prop;
	}

	get last() {
		const last = this.#last;
		return last && last.prop;
	}

	get changed() {
		return this.#changed.event;
	}

	abstract get subtype(): "array" | "object";
	abstract get count(): number;

	constructor(owner: JsonProperty) {
		super(owner);
		this.#first = null;
		this.#last = null;
		this.#changed = new EventHandlers();
	}

	abstract getProperty(key: Key): undefined | JsonProperty<TKey>;
	abstract clear(): boolean;
	abstract remove(key: Key): undefined | JsonProperty<TKey>;

	/** @internal */
	__shown(filter: string, filterMode: json.JsonTokenFilterFlags, isAppend: boolean): boolean {
		let show = false;

		for (const prop of this)
			if (prop.filter(filter, filterMode, isAppend))
				show = true;

		return show;
	}

	#insertAfter(value: JsonPropertyController<TKey>, prev?: null | JsonPropertyController<TKey>) {
		if (prev != null) {
			prev.next = value;
			value = prev;

			if (prev.next) {
				value = prev.next;
			} else {
				this.#last = value;
			}
		} else if (this.#last == null) {
			this.#first = value;
			this.#last = value;
		} else {
			this.#last.next = value;
			this.#last = value;
		}

		value.parent = this;
		this.#changed.fire(this, "added", value.prop);
	}

	#insertBefore(value: JsonPropertyController<TKey>, next?: null | JsonPropertyController<TKey>) {
		if (next != null) {
			next.previous = value;
			value.next = next;

			if (next.previous) {
				value.previous = next.previous;
			} else {
				this.#first = value;
			}
		} else if (this.#first == null) {
			this.#first = value;
			this.#last = value;
		} else {
			this.#first.previous = value;
			this.#first = value;
		}

		value.parent = this;
		this.#changed.fire(this, "added", value.prop);
	}

	/** @internal */
	#replaced(old: JsonPropertyController<TKey>, value: JsonPropertyController<TKey>) {
		if (old.previous) {
			old.previous.next = value;
		} else {
			this.#first = value;
		}

		if (old.next) {
			old.next.previous = value;
		} else {
			this.#last = value;
		}

		old.removed();
		value.parent = this;
		this.#changed.fire(this, "replaced", old.prop, value.prop);
	}

	#removed(value: JsonPropertyController<TKey>) {
		const { previous, next } = value;
		if (previous == null) {
			if (next == null) {
				this.#first = null;
				this.#last = null;
			} else {
				this.#first = next;
				next.previous = null;
			}
		} else if (next == null) {
			this.#last = previous;
			previous.next = null;
		} else {
			next.previous = previous;
			previous.next = next;
		}

		value.removed();
		this.#changed.fire(this, "removed", value.prop);
	}

	keys() {
		return JsonIterator.keys(this);
	}

	values() {
		return JsonIterator.values(this);
	}

	[Symbol.iterator]() {
		return JsonIterator.properties(this);
	}

	static readonly #object = class JsonObject extends JsonContainer<string> implements json.JsonObject {
		static readonly #proxyHandler: ProxyHandler<JsonObject> = {
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
	
		readonly #props: Map<string, JsonPropertyController<string>>;
		readonly #proxy: any;
	
		get subtype() {
			return "object" as const;
		}
	
		get count() {
			return this.#props.size;
		}
	
		get proxy() {
			return this.#proxy;
		}
	
		constructor(owner: JsonProperty) {
			super(owner);
			this.#props = new Map();
			this.#proxy = new Proxy(this, JsonObject.#proxyHandler);
		}
	
		#reflectGet(key: string | symbol, wrap: true): undefined | [value: any, enumerable: boolean]
		#reflectGet(key: string | symbol, wrap?: false): any 
		#reflectGet(key: string | symbol, wrap?: boolean): any {
			if (typeof key === "string") {
				const cont = this.#props.get(key);
				if (cont == null)
					return undefined;
	
				return wrap ? [cont.value.proxy, true] : cont.value.proxy;
			} else if (key === Symbol.toPrimitive) {
				return wrap ? [Object.prototype.toString, false] : Object.prototype.toString;
			}
		}
	
		get(key: Key): JsonToken | undefined {
			const c = typeof key === "string" && this.#props.get(key);
			return c ? c.value : undefined;
		}
	
		getProperty(key: Key): JsonProperty<string> | undefined {
			const c = typeof key === "string" && this.#props.get(key);
			return c ? c.prop : undefined;
		}
	
		sort(reverse?: boolean) {
			const props = this.#props;
			if (props.size === 0)
				return;
	
			const sorted = [...props.values()].sort(defaultCompare);
			if (reverse)
				sorted.reverse();
	
			const first = sorted[0];
			let last = first;
			first.previous = null;
	
			for (let i = 1; i < sorted.length; i++) {
				const next = sorted[i];
				next.previous = last;
				last.next = next;
				last = next;
			}
	
			last.next = null;
			this.#first = first;
			this.#last = last;
			this.#changed.fire(this, "reset");
		}
	
		add<K extends keyof json.JsonContainerAddMap>(key: string, type: K): InternalJsonContainerAddMap[K]
		add(key: string, type: keyof json.JsonContainerAddMap): JsonToken {
			const props = this.#props;
			const old = props.get(key);
			const clazz = resolveClass(type);
			const cont = new JsonPropertyController(key, clazz);
	
			if (old) {
				this.#replaced(old, cont);
			} else {
				this.#insertAfter(cont);
			}
	
			props.set(key, cont);
			return cont.value;
		}
	
		remove(key: Key): JsonProperty<string> | undefined {
			const cont = typeof key === "string" && this.#props.get(key);
			if (cont) {
				this.#props.delete(key);
				this.#removed(cont);
				return cont.prop;
			}
		}
	
		clear(): boolean {
			const items = this.#props;
			if (items.size === 0)
				return false;
	
			const removed: JsonProperty<string>[] = [];
			for (const item of items.values()) {
				item.removed();
				removed.push(item.prop);
			}
	
			items.clear();
			this.#first = null;
			this.#last = null;
			this.#changed.fire(this, "removedRange", removed);
			return true;
		}
	
		toJSON() {
			const obj: any = {};
			for (const cont of this)
				obj[cont.key] = cont.value.toJSON();
	
			return obj;
		}
	}
	
	static readonly #array = class JsonArray extends JsonContainer<number> implements json.JsonArray {
		static readonly #proxyHandler: ReadOnlyArrayLikeProxyHandler<JsonArray, any> = {
			getAt(self, index) {
				return self.#items[index].value.proxy;
			},
			getLength(self) {
				return self.#items.length;
			},
			getIterator(self) {
				return self.#proxyIterator;
			}
		}
	
		readonly #items: JsonPropertyController<number>[];
		readonly #proxy: any;
	
		get subtype() {
			return "array" as const;
		}
	
		get count() {
			return this.#items.length;
		}
	
		get proxy() {
			return this.#proxy;
		}
	
		constructor(owner: JsonProperty) {
			super(owner);
			this.#items = [];
			this.#proxy = new ArrayLikeProxy(this, JsonArray.#proxyHandler);
		}
	
		get(key: Key): JsonToken | undefined {
			const c = typeof key === "number" && this.#items.at(key);
			return c ? c.value : undefined;
		}
	
		getProperty(key: Key): JsonProperty<number> | undefined {
			const c = typeof key === "number" && this.#items.at(key);
			return c ? c.prop : undefined;
		}
	
		add<K extends keyof json.JsonContainerAddMap>(type: K, index?: number | undefined): InternalJsonContainerAddMap[K]
		add(type: keyof json.JsonContainerAddMap, index?: number | undefined): JsonToken {
			let cont: JsonPropertyController<number>;
			const clazz = resolveClass(type);
			const items = this.#items;
			if (index == null) {
				cont = new JsonPropertyController(items.length, clazz);
				items.push(cont);
				this.#insertAfter(cont);
			} else if (index < 0) {
				throw new TypeError("Index must be greater than or equal to 0");
			} else {
				cont = new JsonPropertyController(index, clazz);
	
				if (index < items.length) {
					const next = items[index];
					const { previous } = next;
					items.splice(index, 0, cont);
	
					while (++index < items.length)
						items[index].key = index;
	
					if (previous) {
						this.#insertBefore(next);
					} else {
						this.#insertAfter(next);
					}
				} else {
					const range: JsonProperty<number>[] = [];
					let last = this.#last;
	
					for (let i = items.length; i < index; i++) {
						const c = new JsonPropertyController(i, JsonValue);
						if (last) {
							last.next = c;
							c.previous = last;
						} else {
							this.#first = c;
						}
	
						items.push(c);
						range.push(c.prop);
						last = c;
						last.parent = this;
					}
					
					range.push(cont.prop);
					this.#last = cont;
					this.#changed.fire(this, "addedRange", range);
				}
			}
	
			return cont.value;
		}
	
		remove(key: Key): JsonProperty<number> | undefined {
			const c = typeof key === "number" && this.#items.at(key);
			if (c) {
				key = +key;
				while (key < this.#items.length)
					this.#items[key].key = key++;
		
				this.#removed(c);
				return c.prop;
			}
		}
	
		clear(): boolean {
			const items = this.#items;
			if (items.length === 0)
				return false;
	
			const removed = items.splice(0, items.length);
			const output: JsonProperty<number>[] = removed as any;
			for (let i = 0; i < removed.length; i++) {
				removed[i].removed();
				output[i] = removed[i].prop;
			}

			this.#first = null;
			this.#last = null;
			this.#changed.fire(this, "removedRange", output);
			return true;
		}
	
		toJSON() {
			const items = this.#items;
			const arr = Array<any>(items.length);
			for (let i = 0; i < items.length; i++)
				arr[i] = items[i].value.toJSON();
	
			return arr;
		}
	
		*#proxyIterator() {
			for (const prop of this.#items)
				yield prop.value.toJSON();
		}
	}

	static {
		JsonObject = this.#object;
		JsonArray = this.#array;
	}
}

function createArray(key: string, value: any[]) {
	const root = new JsonPropertyController(key, JsonArray);
	addArray(root.value, value);
	return root;
}

function createObject(key: string, value: Dict) {
	const root = new JsonPropertyController(key, JsonObject);
	addObject(root.value, value);
	return root;
}

function addArray(token: JsonArray, value: any[]) {
	for (const item of value) {
		if (item === null) {
			token.add("value");
		} else if (typeof item === "object") {
			if (Array.isArray(item)) {
				const child = token.add("array");
				addArray(child, item);
			} else {
				const child = token.add("object");
				addObject(child, item);
			}
		} else {
			const child = token.add("value");
			child.value = item;
		}
	}
}

function addObject(token: JsonObject, value: Dict) {
	for (const key in value) {
		const item = value[key];
		if (item === null) {
			token.add(key, "value");
		} else if (typeof item === "object") {
			if (Array.isArray(item)) {
				const child = token.add(key, "array");
				addArray(child, item);
			} else {
				const child = token.add(key, "object");
				addObject(child, item);
			}
		} else {
			const child = token.add(key, "value");
			child.value = item;
		}
	}
}

function create(key: string, value: any) {
	if (value === null)
		return new JsonPropertyController(key, JsonValue);

	if (typeof value === "object")
		return (Array.isArray(value) ? createArray : createObject)(key, value);

	const prop = new JsonPropertyController(key, JsonValue);
	prop.value.value = value;
	return prop;
}

export function json(value: any, key: string = "$"): json.JsonProperty<string> {
	return create(key, value).prop;
}

function defValue(object: object, p: PropertyKey, value: any, enumerable?: boolean, writable?: boolean, configurable?: boolean): void {
	Object.defineProperty(object, p, { value, enumerable, writable, configurable });
}

defValue(json, "JsonTokenFilterFlags", FilterFlags, true);
defValue(json, "JsonToken", JsonToken, true);
defValue(json, "JsonValue", JsonValue, true);
defValue(json, "JsonContainer", JsonContainer, true);
defValue(json, "JsonObject", JsonObject, true);
defValue(json, "JsonArray", JsonArray, true);

export default json;
