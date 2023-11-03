import Linq from "@daniel.pickett/linq-js";
import type { Readable, Subscriber, Unsubscriber } from "svelte/store";
import objectProxy from "./object-proxy.js";

type Invalidator<T> = (value?: T) => void;

interface IReadable<T = undefined> extends Readable<T> {
	readonly value: T;
}

type Readables<T> = { readonly [P in keyof T]: IReadable<T[P]> };

export interface ReadOnlyPropertyBag<TRecord extends Dict = Dict> {
	readonly keys: ReadonlySet<string>;
	readonly readables: Readables<TRecord>;

	getValue<K extends keyof TRecord>(key: K): TRecord[K];
	getValues(): TRecord;
	getValues<const K extends (keyof TRecord)[]>(keys: K): { [P in K[number]]: TRecord[P] };
	onChange(handler: PropertyBagChangeHandler<TRecord>): void;
}

type PropertyBagChangeHandler<TRecord> = (changes: Partial<TRecord>) => void;

type IReadOnlyPropertyBag<T extends Dict> = ReadOnlyPropertyBag<T>;

type Entries<T extends Dict> = { readonly [P in keyof T]: Entry<T, P> };

class Entry<Props extends Dict = any, Key extends keyof Props = any> {
	static readonly Readable = class Property<Props extends Dict, Key extends keyof Props> implements IReadable<Props[Key]> {
		readonly #entry: Entry<Props, Key>;

		get key() {
			return this.#entry.#key;
		}

		get value() {
			return this.#entry.#value;
		}

		constructor(entry: Entry<Props, Key>) {
			this.#entry = entry;
		}

		subscribe(run: Subscriber<Props[Key]>, invalidate?: Invalidator<Props[Key]> | undefined): Unsubscriber {
			return this.#entry.subscribe(run, invalidate);
		}
	}

	readonly #key: Key;
	readonly #subs: Map<number, Invalidator<Props[Key]>>;
	readonly #readable: IReadable<Props[Key]>;
	#subNo: number;
	#value: Props[Key];

	get readable() {
		return this.#readable;
	}

	get value() {
		return this.#value;
	}

	constructor(key: Key, value: Props[Key]) {
		this.#key = key;
		this.#value = value;
		this.#readable = new Entry.Readable(this);
		this.#subs = new Map;
		this.#subNo = 0;
	}

	#unsubscribe(subNo: number): void {
		this.#subs.delete(subNo);
	}

	setValue(v: Props[Key]): boolean {
		if (this.#value !== v) {
			this.#value = v;
			this.#subs.forEach(fn => fn(v));
			return true;
		} else {
			return false;
		}
	}

	subscribe(run: Subscriber<Props[Key]>, invalidate?: Invalidator<Props[Key]>): Unsubscriber {
		const value = this.#value;
		run(value);
		const subNo = this.#subNo++;
		this.#subs.set(subNo, <any>(invalidate ?? run));
		return this.#unsubscribe.bind(this, subNo);
	}
}

type MappedEntries<TSource extends Dict, TRecord extends Dict> = { readonly [P in keyof TRecord]: MappedEntry<TSource, TRecord, P> };

class MappedEntry<Source extends Dict, Props extends Dict = any, Key extends keyof Props = any> extends Entry<Props, Key> {
	readonly #transformer: TransformerHandler<Source>;

	constructor(key: Key, value: Props[Key], transformer: TransformerHandler<Source>) {
		super(key, value);
		this.#transformer = transformer;
	}

	update(src: ReadOnlyPropertyBag<Source>) {
		const value = this.#transformer.call(undefined, src);
		return this.setValue(value);
	}
}

class PropertyBagBase<TRecord extends Dict = Dict> implements ReadOnlyPropertyBag<TRecord> {
	readonly #keys: ReadonlySet<string>;
	readonly #entries: Entries<TRecord>;
	readonly #readables: Readables<TRecord>;
	readonly #handlers: PropertyBagChangeHandler<TRecord>[];

	get keys() {
		return this.#keys;
	}

	get readables() {
		return this.#readables;
	}

	protected get __hasHandlers() {
		return this.#handlers.length > 0;
	}

	constructor(entries: Entries<TRecord>) {
		this.#keys = Linq.fromKeys(entries).toSet();
		this.#entries = entries;
		this.#readables = objectProxy(entries, "readable");
		this.#handlers = [];
	}

	getValue<K extends keyof TRecord>(key: K): TRecord[K] {
		return this.#entries[key].value;
	}

	getValues(): TRecord;
	getValues<const K extends (keyof TRecord)[]>(keys: K): { [P in K[number]]: TRecord[P] };
	getValues(keys?: string[]): any {
		const result: any = {};
		for (const key of keys ?? this.#keys)
			result[key] = this.#entries[key].value;

		return result;
	}

	onChange(handler: PropertyBagChangeHandler<TRecord>): void {
		this.#handlers.push(handler);
	}

	protected __fireChange(bag: Partial<TRecord>) {
		this.#handlers.forEach(v => v.call(this, bag));
	}
}

export class PropertyBag<TRecord extends Dict = Dict> extends PropertyBagBase<TRecord> implements ReadOnlyPropertyBag<TRecord> {
	static readonly #ReadOnly = class ReadOnlyPropertyBag<TRecord extends Dict> implements IReadOnlyPropertyBag<TRecord> {
		readonly #owner: PropertyBag<TRecord>;

		get readables() {
			return this.#owner.readables;
		}

		get keys() {
			return this.#owner.keys;
		}

		constructor(owner: PropertyBag<TRecord>) {
			this.#owner = owner;
		}

		getValue<K extends keyof TRecord>(key: K): TRecord[K] {
			return this.#owner.getValue(key);
		}

		getValues(keys?: string[]) {
			return this.#owner.getValues(keys as any);
		}

		onChange(handler: PropertyBagChangeHandler<TRecord>): void {
			this.#owner.onChange(v => handler.call(this, v));
		}
	}

	readonly #entries: Entries<TRecord>;
	readonly #readOnly: ReadOnlyPropertyBag<TRecord>;

	get readOnly() {
		return this.#readOnly;
	}

	constructor(values: TRecord) {
		const entries: any = {};

		for (const key in values) {
			const v = values[key];
			entries[key] = new Entry(key, v);
		}

		super(entries);
		this.#entries = entries;
		this.#readOnly = new PropertyBag.#ReadOnly(this);
	}

	setValue<K extends keyof TRecord>(key: K, value: TRecord[K]) {
		const changed = this.#entries[key].setValue(value);
		if (changed && this.__hasHandlers)
			this.__fireChange({ [key]: value } as any);
	}

	setValues(values: Partial<TRecord>) {
		if (this.__hasHandlers) {
			let changedCount = 0;
			let changed: any = {};
	
			for (const key in values) {
				const value = values[key];
				if (this.#entries[key].setValue(value as any)) {
					changedCount++;
					changed[key] = value;
				}
			}

			changedCount && this.__fireChange(changed);
		} else {
			for (const key in values)
				this.#entries[key].setValue(values[key] as any);
		}
	}
}

type TransformerHandler<TSource extends Dict> = (src: ReadOnlyPropertyBag<TSource>) => any;
type Transformer<TSource extends Dict> = [OneOrMany<string & keyof TSource>, TransformerHandler<TSource>];

type KeysToArgs<TRecord, K extends readonly (keyof TRecord)[]> = { [I in keyof K]: TRecord[K[I]] };

/**
 * Create a {@linkcode ReadOnlyPropertyBag} using another property bag's properties
 */
export interface MappedBagBuilder<TRecord extends Dict, TCurrent extends Dict> {
	/**
	 * Map properties from the source bag with the same property name
	 * @param keys The properties to map
	 */
	map<const K extends readonly (string & ({} extends TCurrent ? keyof TRecord : Exclude<keyof TRecord, keyof TCurrent>))[]>(keys: K): MappedBagBuilder<TRecord, TCurrent & { [P in K[number]]: TRecord[P] }>;
	/**
	 * Map one or more properties to a single property using a conversion function
	 * @param key The properties on the source bag to use
	 * @param output The name of the property
	 * @param transform A function to map the properties to the output value
	 */
	map<const K extends readonly (string & keyof TRecord)[], const O extends string, T>(key: K, output: O, transform: (...values: KeysToArgs<TRecord, K>) => T): O extends keyof TCurrent ? never : MappedBagBuilder<TRecord, TCurrent & { [P in O]: T }>;
	/**
	 * Map a property with no conversion
	 * @param key The property on the source bag to use
	 * @param output The name of the property
	 */
	map<K extends keyof TRecord, const O extends string>(key: K, output: O): O extends keyof TCurrent ? never : MappedBagBuilder<TRecord, TCurrent & { [P in O]: TRecord[K] }>;
	/**
	 * Map a property with a conversion function
	 * @param key The property on the source bag to use
	 * @param output The name of the property
	 * @param transform A function to convert the property value to the output value
	 */
	map<K extends keyof TRecord, const O extends string, T>(key: K, output: O, transform: (value: TRecord[K]) => T): O extends keyof TCurrent ? never : MappedBagBuilder<TRecord, TCurrent & { [P in O]: T }>;

	/**
	 * Create the output property bag
	 */
	build(): ReadOnlyPropertyBag<{ [P in keyof TCurrent]: TCurrent[P] }>;
}

interface MappedBagBuilderConstructor {
	readonly prototype: MappedBagBuilder<any, any>;
	new<TRecord extends Dict>(bag: ReadOnlyPropertyBag<TRecord>): MappedBagBuilder<TRecord, {}>;
}

type IBindedBagBuilder = MappedBagBuilder<any, any>;

const MappedBagBuilderImpl: MappedBagBuilderConstructor = class BindedBagBuilder implements IBindedBagBuilder {
	readonly #bag: ReadOnlyPropertyBag<any>;
	readonly #transformers: Record<string, Transformer<any>>;

	constructor(bag: ReadOnlyPropertyBag<any>) {
		this.#bag = bag;
		this.#transformers = Object.create(null);
	}

	#validateKey(key: string) {
		if (key in this.#transformers)
			throw new TypeError('Duplicate key: ' + JSON.stringify(key));
	}

	map(key: string | string[], ...args: any[]): any {
		let transformer: TransformerHandler<any>;
		let outKey: string;
		if (Array.isArray(key)) {
			let transform: Fn;
			[outKey, transform] = args as any;
			if (outKey == undefined) {
				for (const k of key) {
					this.#validateKey(k);
					this.#transformers[k] = [k, mapValue.bind(undefined, k)];
				}

				return this;
			}

			this.#validateKey(outKey);
			transformer = transformMany.bind(key, transform);
		} else {
			const [arg0, arg1] = args;
			let transform: Func<any, any> | undefined;
			if (typeof arg0 === "string") {
				[outKey, transform] = [arg0, arg1];
			} else {
				[outKey, transform] = [key, arg0];
			}

			this.#validateKey(outKey);
			transformer = transform ? transformSingle.bind(undefined, key, transform) : mapValue.bind(undefined, key);
		}

		this.#transformers[outKey] = [key, transformer];
		return this;
	}

	build(): ReadOnlyPropertyBag<any> {
		const [bag, transformers] = [this.#bag, this.#transformers];
		return new MappedPropertyBag(bag, transformers);
	}
}

export var MappedBagBuilder = MappedBagBuilderImpl;

class MappedPropertyBag<TSource extends Dict, TRecord extends Dict> extends PropertyBagBase<TRecord> {
	readonly #source: ReadOnlyPropertyBag<TSource>;
	readonly #entries: MappedEntries<TSource, TRecord>;
	readonly #mappings: Map<string, string[]>;

	constructor(source: ReadOnlyPropertyBag<TSource>, transformers: Dict<Transformer<TSource>>) {
		const entries = Object.create(null);
		const mappings = new Map<string, string[]>();

		function addKey(source: string, key: string) {
			let list = mappings.get(source);
			if (list == null)
				mappings.set(source, list = []);

			list.push(key);
		}

		for (const [key, [props, handler]] of Object.entries(transformers)) {
			if (Array.isArray(props)) {
				for (const prop of props)
					addKey(prop, key);
			} else {
				addKey(props, key);
			}

			const value = handler(source);
			const readable = new MappedEntry(key, value, handler);
			entries[key] = readable;
		}

		super(entries);
		this.#source = source;
		this.#source.onChange(this.#onSourceChange.bind(this));
		this.#mappings = mappings;
		this.#entries = entries;
	}

	#onSourceChange(changes: Partial<TSource>) {
		const toUpdate = new Set<string>();

		for (const key in changes) {
			const dest = this.#mappings.get(key);
			if (dest)
				for (const key of dest)
					toUpdate.add(key);
		}

		if (toUpdate.size === 0)
			return;
		
		const src = this.#source;
		if (this.__hasHandlers) {
			const changes: any = {};
			let count = 0;

			for (const key of toUpdate) {
				const entry = this.#entries[key];
				if (entry.update(src)) {
					count++;
					changes[key] = entry.value;
				}
			}
	
			if (count)
				this.__fireChange(changes);
		} else {
			for (const key of toUpdate)
				this.#entries[key].update(src);
		}
	}
}

function transformMany<T extends Dict>(this: string[], transform: Fn, src: ReadOnlyPropertyBag<T>) {
	const args = Array(this.length);
	for (let i = 0; i < args.length; i++)
		args[i] = src.getValue(this[i]);

	return transform.apply(undefined, args);
};

function transformSingle<T extends Dict>(key: string, transform: Func<any, any>, bag: ReadOnlyPropertyBag<T>) {
	const v = bag.getValue(key);
	return transform(v);
}

function mapValue<T extends Dict>(key: string, bag: ReadOnlyPropertyBag<T>) {
	return bag.getValue(key);
}
