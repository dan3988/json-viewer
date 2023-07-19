import ArrayLikeProxy, { type ReadOnlyArrayLikeProxyHandler } from "./array-like-proxy.js";
import { PropertyBag } from "./prop.js";
import { EventHandlers, type IEvent } from "./evt.js";
import Linq from "@daniel.pickett/linq-js";

type Key = string | number;
type JValueType = string | number | boolean | null;

interface JPropertyBag {
	isHidden: boolean;
	isExpanded: boolean;
	isSelected: boolean;
}

interface JsonClass<T extends json.JToken = json.JToken> {
	readonly prototype: T;
	new(owner?: JProperty): T;
}

interface ExposedJsonClass<T extends json.JToken = json.JToken> {
	readonly prototype: T;
	new(): T;
}

interface AbstractJsonClass<T extends json.JToken = json.JToken> {
	new(): never;
	readonly prototype: T;
}

function defaultCompare(x: JPropertyController<string>, y: JPropertyController<string>) {
	return x.key.localeCompare(y.key, undefined, { sensitivity: "base" });
}

function iterres<T>(done: true, value?: T): IteratorReturnResult<T>;
function iterres<T>(done: false, value: T): IteratorYieldResult<T>;
function iterres<T>(done: boolean, value: T): IteratorResult<T>;
function iterres(done: boolean, value?: any): IteratorResult<any> {
	return { done, value };
}

interface ChildrenChangedEvents<TKey extends Key = any> {
	added: [added: JProperty<TKey>];
	addedRange: [added: JProperty<TKey>[]]
	removed: [removed: JProperty<TKey>];
	removedRange: [removed: JProperty<TKey>[]];
	reset: [];
	replaced: [old: JProperty<TKey>, new: JProperty<TKey>];
}

type ChildrenChangedArgs<TKey extends Key = Key> = { [P in keyof ChildrenChangedEvents]: [type: P, ...args: ChildrenChangedEvents<TKey>[P]] }[keyof ChildrenChangedEvents]

enum JTokenFilterFlags {
	None,
	Keys = 1,
	Values = 2,
	Both = Keys | Values
}

export declare namespace json {
	export interface JTokenTypeMap {
		"container": JContainer;
		"property": JProperty;
		"value": JValue;
	}
	
	export interface JTokenSubTypeMap {
		"object": JObject;
		"array": JArray;
		"string": JValue<string>;
		"number": JValue<number>;
		"boolean": JValue<boolean>;
		"null": JValue<null>;
	}

	export enum JTokenFilterFlags {
		None,
		Keys = 1,
		Values = 2,
		Both = Keys | Values
	}
	
	export interface JProperty<TKey extends Key = Key> {
		readonly key: TKey;
		readonly value: JToken;
		readonly parent: null | JContainer<TKey>;
		readonly previous: null | JProperty<TKey>;
		readonly next: null | JProperty<TKey>;
		readonly path: readonly Key[];
		readonly bag: PropertyBag<JPropertyBag>;

		readonly isHidden: boolean;
		isExpanded: boolean;
		isSelected: boolean;

		setExpanded(expanded: boolean, recursive?: boolean): void;
		remove(): boolean;
		toggleExpanded(): boolean;
		filter(filter: string, filterMode: JTokenFilterFlags, isAppend: boolean): boolean;
	}

	export const JToken: AbstractJsonClass<JToken>;
	export const JValue: ExposedJsonClass<JValue>;
	export const JContainer: AbstractJsonClass<JContainer>;
	export const JArray: ExposedJsonClass<JArray>;
	export const JObject: ExposedJsonClass<JObject>;

	export interface JToken<T = any> extends Iterable<JProperty> {
		readonly type: keyof JTokenTypeMap;
		readonly subtype: keyof JTokenSubTypeMap;
		readonly proxy: T;
		readonly parent: null | JContainer;
		readonly owner: JProperty;

		is<K extends keyof JTokenTypeMap>(type: K): this is JTokenTypeMap[K];
		is<K extends keyof JTokenSubTypeMap>(type: K): this is JTokenSubTypeMap[K];

		get(key: Key): undefined | JToken;
		getProperty(key: Key): undefined | JProperty;

		keys(): IterableIterator<Key>;
		values(): IterableIterator<JToken>;

		[Symbol.iterator](): IterableIterator<JProperty>;

		toJSON(): T;
		toString(indent?: string): string;
	}

	export interface JValue<T extends JValueType = JValueType> extends JToken<T> {
		readonly type: "value";
		readonly subtype: "string" | "number" | "boolean" | "null";
		value: T;

		get(): undefined;
		getProperty(): undefined;

		keys(): IterableIterator<never>;
		values(): IterableIterator<never>;

		[Symbol.iterator](): IterableIterator<never>;
	}

	export interface JContainerAddMap {
		"value": JValue;
		"array": JArray;
		"object": JObject;
	}
	
	export interface JContainer<TKey extends Key = Key, T = any> extends JToken<T> {
		readonly type: "container";
		readonly subtype: "array" | "object";
		readonly first: null | JProperty<TKey>;
		readonly last: null | JProperty<TKey>;
		readonly count: number;
		readonly changed: IEvent<this, ChildrenChangedArgs>;

		getProperty(key: Key): undefined | JProperty<TKey>;
		remove(key: Key): undefined | JProperty<TKey>;
		clear(): boolean;

		[Symbol.iterator](): IterableIterator<JProperty<TKey>>;
	}

	export interface JArray<T = any> extends JContainer<number, readonly T[]> {
		readonly subtype: "array";

		add<K extends keyof JContainerAddMap>(type: K, index?: number): JContainerAddMap[K];
	}

	export interface JObject<T = any> extends JContainer<string, Readonly<Dict<T>>> {
		readonly subtype: "object";

		add<K extends keyof JContainerAddMap>(key: string, type: K): JContainerAddMap[K];
		sort(reverse?: boolean): void;
	}
}

const empty = Linq.empty();

interface InternalJContainerAddMap {
	"value": JValue;
	"array": JArray;
	"object": JObject;
}

function resolveClass<K extends keyof json.JContainerAddMap>(type: K): JsonClass<InternalJContainerAddMap[K]>
function resolveClass(type: string): JsonClass {
	switch (type) {
		case "value":
			return JValue;
		case "array":
			return JArray;
		case "object":
			return JObject;
	}

	throw new TypeError('Unknown type: "' + type + '"');
}

const enum JIteratorMode {
	Property, Key, Value
}

class JIterator<TKey extends Key, TResult> implements Iterable<TResult>, Iterator<TResult, void> {
	static properties<TKey extends Key>(container: JContainer<TKey, any>): JIterator<TKey, JProperty<TKey>> {
		return new JIterator(container, JIteratorMode.Property);
	}

	static keys<TKey extends Key>(container: JContainer<TKey, any>): JIterator<TKey, TKey> {
		return new JIterator(container, JIteratorMode.Key);
	}

	static values<TKey extends Key>(container: JContainer<TKey, any>): JIterator<TKey, JToken> {
		return new JIterator(container, JIteratorMode.Value);
	}

	readonly #container: JContainer<TKey, any>;
	readonly #mode: JIteratorMode;
	#current: null | JProperty<TKey>;

	constructor(container: JContainer<TKey, any>, mode: JIteratorMode) {
		this.#container = container;
		this.#mode = mode;
		this.#current = null;
	}

	next(): IteratorResult<TResult> {
		let next: null | JProperty<TKey>
		if (this.#current == null) {
			next = this.#container.first;
		} else {
			next = this.#current.next;
		}

		this.#current = next;
		if (next == null)
			return iterres(true);

		switch (this.#mode) {
			case JIteratorMode.Property:
				return iterres(false, <any>next);
			case JIteratorMode.Key:
				return iterres(false, <any>next.key);
			case JIteratorMode.Value:
				return iterres(false, <any>next.value);
		}
		
		throw null;
	}

	[Symbol.iterator](): this {
		return this;
	}
}

/** properties that should not be exposed outside this file */
class JPropertyController<TKey extends Key = Key, TValue extends JToken = JToken> {
	readonly #prop: JProperty<TKey, TValue>;
	parent: null | JContainer<TKey>;
	key: TKey;
	previous: null | JPropertyController<TKey>;
	next: null | JPropertyController<TKey>;

	get prop() {
		return this.#prop;
	}

	get value() {
		return this.#prop.value;
	}

	constructor(key: TKey, clazz: JsonClass<TValue>, instance?: TValue)
	constructor(key: TKey, instance: TValue)
	constructor(key: TKey, value: JsonClass<TValue> | TValue)
	constructor(key: TKey, value: JsonClass<TValue> | TValue) {
		this.#prop = new JProperty(this, value);
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

class JProperty<TKey extends Key = Key, TValue extends JToken = JToken> implements json.JProperty<TKey> {
	readonly #controller: JPropertyController<TKey>;
	readonly #value: TValue;
	readonly #bag: PropertyBag<JPropertyBag>;

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

	constructor(controller: JPropertyController<TKey>, value: JsonClass<TValue> | TValue) {
		this.#controller = controller;
		this.#value = typeof value === "function" ? new value(this) : value;
		this.#bag = new PropertyBag<JPropertyBag>({ isSelected: false, isExpanded: false, isHidden: false });
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

		const stack: Iterator<JProperty>[] = [];
		let cur: Iterator<JProperty> = this.value[Symbol.iterator]()
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

	filter(filter: string, filterMode: json.JTokenFilterFlags, isAppend: boolean) {
		if (isAppend && this.isHidden)
			return false;

		const showKey = Boolean(filterMode & json.JTokenFilterFlags.Keys) && String.prototype.toLowerCase.call(this.key).includes(filter);
		const showValue = this.#value.__shown(filter, filterMode, isAppend);
		const show = showKey || showValue;
		this.#bag.setValue("isHidden", !show);
		return show;
	}
}

abstract class JToken<T = any> implements json.JToken<T> {
	readonly #owner: JProperty;

	get parent() {
		return this.#owner.parent;
	}

	get owner() {
		return this.#owner;
	}

	abstract get type(): keyof json.JTokenTypeMap;
	abstract get subtype(): keyof json.JTokenSubTypeMap;
	abstract get proxy(): T;

	constructor(owner?: JProperty) {
		this.#owner = owner ?? new JPropertyController("$", this).prop;
	}

	/** @internal */
	abstract __shown(filter: string, filterMode: json.JTokenFilterFlags, isAppend: boolean): boolean;

	abstract get(key: Key): undefined | JToken;
	abstract getProperty(key: Key): undefined | JProperty;

	abstract keys(): IterableIterator<Key>;
	abstract values(): IterableIterator<JToken>;

	abstract [Symbol.iterator](): IterableIterator<JProperty>;

	is<K extends keyof json.JTokenTypeMap>(type: K): this is json.JTokenTypeMap[K];
	is<K extends keyof json.JTokenSubTypeMap>(type: K): this is json.JTokenSubTypeMap[K];
	is(type: string): boolean {
		return type === this.type || type === this.subtype;
	}

	abstract toJSON(): T;
	
	toString(indent?: string | undefined) {
		return JSON.stringify(this.proxy, undefined, indent); 
	}
}

class JValue extends JToken implements json.JValue {
	#value: JValueType;
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
					throw new TypeError('JValue.value cannot be of type "' + t + '"');
				}
			}
		}
	}

	constructor(owner?: JProperty) {
		super(owner);
		this.#value = null;
		this.#subtype = "null";
	}

	/** @internal */
	__shown(filter: string, filterMode: json.JTokenFilterFlags): boolean {
		if ((filterMode & json.JTokenFilterFlags.Values) === 0) 
			return false;

		const str = this.#value === null ? "null" :  String.prototype.toLowerCase.call(this.#value);
		return str.includes(filter);
	}


	toJSON() {
		return this.#value;
	}

	get(): undefined {
		return undefined;
	}

	getProperty(): undefined {
		return undefined;
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

interface InternalJObject extends json.JObject {
	add<K extends keyof InternalJContainerAddMap>(key: string, type: K): InternalJContainerAddMap[K];
}

interface InternalJArray extends json.JArray {
	add<K extends keyof InternalJContainerAddMap>(type: K, index?: number): InternalJContainerAddMap[K];
}

type JObject = JContainer<string> & InternalJObject;
type JObjectConstructor = JsonClass<JObject>;

type JArray = JContainer<number> & InternalJArray;
type JArrayConstructor = JsonClass<JArray>;

let JObject: JObjectConstructor;
let JArray: JArrayConstructor;

abstract class JContainer<TKey extends Key = Key, T = any> extends JToken<T> implements json.JContainer<TKey, T> {
	readonly #changed: EventHandlers<any, ChildrenChangedArgs>;
	#first: null | JPropertyController<TKey>;
	#last: null | JPropertyController<TKey>;

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

	constructor(owner?: JProperty) {
		super(owner);
		this.#first = null;
		this.#last = null;
		this.#changed = new EventHandlers();
	}

	abstract getProperty(key: Key): undefined | JProperty<TKey>;
	abstract clear(): boolean;
	abstract remove(key: Key): undefined | JProperty<TKey>;

	/** @internal */
	__shown(filter: string, filterMode: json.JTokenFilterFlags, isAppend: boolean): boolean {
		let show = false;

		for (const prop of this)
			if (prop.filter(filter, filterMode, isAppend))
				show = true;

		return show;
	}

	#insertAfter(value: JPropertyController<TKey>, prev?: null | JPropertyController<TKey>) {
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
			value.previous = this.#last;
			this.#last.next = value;
			this.#last = value;
		}

		value.parent = this;
		this.#changed.fire(this, "added", value.prop);
	}

	#insertBefore(value: JPropertyController<TKey>, next?: null | JPropertyController<TKey>) {
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
			value.next = this.#first;
			this.#first.previous = value;
			this.#first = value;
		}

		value.parent = this;
		this.#changed.fire(this, "added", value.prop);
	}

	/** @internal */
	#replaced(old: JPropertyController<TKey>, value: JPropertyController<TKey>) {
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

	#removed(value: JPropertyController<TKey>) {
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
		return JIterator.keys(this);
	}

	values() {
		return JIterator.values(this);
	}

	[Symbol.iterator]() {
		return JIterator.properties(this);
	}

	static readonly #object = class JObject extends JContainer<string> implements json.JObject {
		static readonly #proxyHandler: ProxyHandler<JObject> = {
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
	
		readonly #props: Map<string, JPropertyController<string>>;
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
	
		constructor(owner?: JProperty) {
			super(owner);
			this.#props = new Map();
			this.#proxy = new Proxy(this, JObject.#proxyHandler);
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
	
		get(key: Key): JToken | undefined {
			const c = typeof key === "string" && this.#props.get(key);
			return c ? c.value : undefined;
		}
	
		getProperty(key: Key): JProperty<string> | undefined {
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
	
		add<K extends keyof json.JContainerAddMap>(key: string, type: K): InternalJContainerAddMap[K]
		add(key: string, type: keyof json.JContainerAddMap): JToken {
			const props = this.#props;
			const old = props.get(key);
			const clazz = resolveClass(type);
			const cont = new JPropertyController(key, clazz);
	
			if (old) {
				this.#replaced(old, cont);
			} else {
				this.#insertAfter(cont);
			}
	
			props.set(key, cont);
			return cont.value;
		}
	
		remove(key: Key): JProperty<string> | undefined {
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
	
			const removed: JProperty<string>[] = [];
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
	
	static readonly #array = class JArray extends JContainer<number> implements json.JArray {
		static readonly #proxyHandler: ReadOnlyArrayLikeProxyHandler<JArray, any> = {
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
	
		readonly #items: JPropertyController<number>[];
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
	
		constructor(owner?: JProperty) {
			super(owner);
			this.#items = [];
			this.#proxy = new ArrayLikeProxy(this, JArray.#proxyHandler);
		}
	
		get(key: Key): JToken | undefined {
			const c = typeof key === "number" && this.#items.at(key);
			return c ? c.value : undefined;
		}
	
		getProperty(key: Key): JProperty<number> | undefined {
			const c = typeof key === "number" && this.#items.at(key);
			return c ? c.prop : undefined;
		}
	
		add<K extends keyof json.JContainerAddMap>(type: K, index?: number | undefined): InternalJContainerAddMap[K]
		add(type: keyof json.JContainerAddMap, index?: number | undefined): JToken {
			let cont: JPropertyController<number>;
			const clazz = resolveClass(type);
			const items = this.#items;
			if (index == null) {
				cont = new JPropertyController(items.length, clazz);
				items.push(cont);
				this.#insertAfter(cont);
			} else if (index < 0) {
				throw new TypeError("Index must be greater than or equal to 0");
			} else {
				cont = new JPropertyController(index, clazz);
	
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
					const range: JProperty<number>[] = [];
					let last = this.#last;
	
					for (let i = items.length; i < index; i++) {
						const c = new JPropertyController(i, JValue);
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
	
		remove(key: Key): JProperty<number> | undefined {
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
			const output: JProperty<number>[] = removed as any;
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
		JObject = this.#object;
		JArray = this.#array;
	}
}

function createArray(key: string, value: any[]) {
	const root = new JPropertyController(key, JArray);
	addArray(root.value, value);
	return root;
}

function createObject(key: string, value: Dict) {
	const root = new JPropertyController(key, JObject);
	addObject(root.value, value);
	return root;
}

function addArray(token: JArray, value: any[]) {
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

function addObject(token: JObject, value: Dict) {
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
		return new JPropertyController(key, JValue);

	if (typeof value === "object")
		return (Array.isArray(value) ? createArray : createObject)(key, value);

	const prop = new JPropertyController(key, JValue);
	prop.value.value = value;
	return prop;
}

export function json(value: any, key: string = "$"): json.JProperty<string> {
	return create(key, value).prop;
}

function def<T>(target: T, properties: Record<keyof T, any>, enumerable?: boolean, writable?: boolean, configurable?: boolean): void {
	for (const [key, value] of Object.entries(properties))
		Object.defineProperty(target, key, { value, enumerable, writable, configurable });
}

def(json, { JTokenFilterFlags, JToken, JValue, JContainer, JObject, JArray }, true);
export default json;
