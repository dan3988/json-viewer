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

function resolveConstructor<T>(value: T): Constructor<JsonToken<T>, [prop: null | JsonProperty, value: T]>
function resolveConstructor(value: any): Constructor<JsonToken, [prop: null | JsonProperty, value: any]> {
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
	abstract get type(): keyof JsonTokenTypeMap;

	protected constructor() {
	}

	abstract is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
}

export type ToToken<T> = T extends readonly any[] ? JsonArray<T> : (T extends object ? JsonObject<T> : (T extends JsonValueType ? JsonValue<T> : JsonToken))

export class JsonProperty<TKey extends number | string = number | string, TValue = any> extends JsonBase {
	readonly #parent: JsonContainer<TKey, any>;
	#prev: null | JsonProperty<TKey>;
	#next: null | JsonProperty<TKey>;
	readonly #key: TKey;
	readonly #value: JsonToken<TValue>;

	get type() {
		return "property" as const;
	}

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

	constructor(parent: JsonContainer<TKey, any>, prev: null | JsonProperty<TKey>, key: TKey, value: TValue, filterableKey?: boolean) {
		super();
		const ctor = resolveConstructor(value);
		this.#parent = parent;
		this.#prev = prev;
		this.#next = null;
		this.#key = key;
		this.#value = new ctor(this, value);

		if (prev != null)
			prev.#next = this;
	}
	
	is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	is(type: string) {
		return type === "property";
	}
}

export abstract class JsonToken<T = any> extends JsonBase {
	static create<T>(value: T): ToToken<T>
	static create(value: any): JsonToken {
		const ctor = resolveConstructor(value);
		return new ctor(null, value);
	}

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
	abstract get subtype(): keyof JsonTokenSubTypeMap;

	protected constructor(prop: null | JsonProperty) {
		super();
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
	
	is<K extends keyof JsonTokenTypeMap>(type: K): this is JsonTokenTypeMap[K];
	is<K extends keyof JsonTokenSubTypeMap>(type: K): this is JsonTokenSubTypeMap[K];
	is(type: string) {
		return type === this.type || type == this.subtype;
	}

	abstract toJSON(): T;

	abstract resolve(path: (number | string)[]): null | JsonToken;

	abstract properties(): Iterable<JsonProperty>;
	abstract get(key: number | string): undefined | JsonToken;
	abstract getProperty(key: number | string): undefined | JsonProperty;
	abstract keys(): Iterable<number | string>;
}

export abstract class JsonContainer<TKey extends string | number = string | number, T = any> extends JsonToken<T> {
	readonly #proxy: any;

	get type() {
		return "container" as const;
	}

	abstract get count(): number;
	abstract get first(): null | JsonProperty<TKey>;
	abstract get last(): null | JsonProperty<TKey>;

	get proxy() {
		return this.#proxy;
	}

	protected constructor(prop: null | JsonProperty, handler: ProxyHandler<JsonContainer<TKey, T>>) {
		super(prop);
		this.#proxy = new Proxy(this, handler);
	}

	resolve(path: (number | string)[]) {
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

	abstract override get(key: TKey): undefined | JsonToken;
	abstract override getProperty(key: TKey): undefined | JsonProperty<TKey>;
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

	get subtype() {
		return "array" as const;
	}

	get count() {
		return this.#items.length;
	}

	constructor(prop: null | JsonProperty, value: T[]) {
		super(prop, JsonArray.#proxyHandler as any);
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

	get subtype() {
		return "object" as const;
	}

	constructor(prop: null | JsonProperty, value: T) {
		super(prop, JsonObject.#proxyHandler as any);
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
}

type JsonValueType = string | number | boolean | null;

export class JsonValue<T extends JsonValueType = JsonValueType> extends JsonToken<T> {
	readonly #value: T;
	readonly #type: "string" | "number" | "boolean" | "null";

	get proxy() {
		return this.#value;
	}

	get value() {
		return this.#value;
	}

	get type() {
		return "value" as const;
	}

	get subtype() {
		return this.#type;
	}

	constructor(prop: null | JsonProperty, value: T) {
		super(prop);
		this.#value = value;
		this.#type = value === null ? "null" : <any>typeof value;
	}

	resolve(): JsonToken<any> | null {
		return null;
	}

	toJSON(): T {
		return this.#value;
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
