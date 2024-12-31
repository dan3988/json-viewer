import type { Subscriber, Unsubscriber, Updater, Writable } from "svelte/store";
import { Store, WritableStoreImpl } from "./store.js";
import { defValue } from "./util.js";

export interface Property<Props extends Dict, Key extends keyof Props> extends Store<Props[Key]> {
	readonly key: Key;
	readonly value: Props[Key];
}

export interface WritableProperty<Props extends Dict, Key extends keyof Props> extends Property<Props, Key>, Writable<Props[Key]> {
	readonly prop: Property<Props, Key>;
}

export type StateDict<T extends Dict> = { readonly [P in keyof T]: Property<T, P> };
export type WritableStateDict<T extends Dict> = { readonly [P in keyof T]: WritableProperty<T, P> };

export type StateChangeHandler<T> = (changes: Partial<T>) => void;

/**
 * Create a {@linkcode State} using another states properties
 */
export interface MappedStateBuilder<TRecord extends Dict, TCurrent extends Dict> {
	/**
	 * Map properties from the source state with the same property name
	 * @param keys The properties to map
	 */
	map<const K extends readonly (string & ({} extends TCurrent ? keyof TRecord : Exclude<keyof TRecord, keyof TCurrent>))[]>(keys: K): MappedStateBuilder<TRecord, TCurrent & { [P in K[number]]: TRecord[P] }>;
	/**
	 * Map one or more properties to a single property using a conversion function
	 * @param key The properties on the source state to use
	 * @param output The name of the property
	 * @param transform A function to map the properties to the output value
	 */
	map<const K extends readonly (string & keyof TRecord)[], const O extends string, T>(key: K, output: O, transform: (...values: KeysToArgs<TRecord, K>) => T): O extends keyof TCurrent ? never : MappedStateBuilder<TRecord, TCurrent & { [P in O]: T }>;
	/**
	 * Map a property with no conversion
	 * @param key The property on the source state to use
	 * @param output The name of the property
	 */
	map<K extends keyof TRecord, const O extends string>(key: K, output: O): O extends keyof TCurrent ? never : MappedStateBuilder<TRecord, TCurrent & { [P in O]: TRecord[K] }>;
	/**
	 * Map a property with a conversion function
	 * @param key The property on the source state to use
	 * @param output The name of the property
	 * @param transform A function to convert the property value to the output value
	 */
	map<K extends keyof TRecord, const O extends string, T>(key: K, output: O, transform: (value: TRecord[K]) => T): O extends keyof TCurrent ? never : MappedStateBuilder<TRecord, TCurrent & { [P in O]: T }>;

	/**
	 * Create the output state
	 */
	build(): State<{ [P in keyof TCurrent]: TCurrent[P] }>;
}

export type PropertyBagChangeHandler<TRecord> = (changes: Partial<TRecord>) => void;

type Entries<T extends Dict> = { readonly [P in keyof T]: Entry<T, P> };

type IProperty<Props extends Dict, Key extends keyof Props> = Property<Props, Key>;

class Entry<Props extends Dict = any, Key extends keyof Props = any> extends WritableStoreImpl<Props[Key]> {
	static readonly Property = class Property<Props extends Dict, Key extends keyof Props> extends Store<Props[Key]> implements IProperty<Props, Key> {
		readonly #entry: Entry<Props, Key>;

		get key() {
			return this.#entry.#key;
		}

		get value() {
			return this.#entry.value;
		}

		constructor(entry: Entry<Props, Key>) {
			super();
			this.#entry = entry;
		}

		listen(listener: Subscriber<Props[Key]>, invalidate?: Action): Unsubscriber {
			return this.#entry.listen(listener, invalidate);
		}

		static readonly WritableProperty = class<Props extends Dict, Key extends keyof Props> extends this<Props, Key> implements WritableProperty<Props, Key> {
			readonly #prop: Property<Props, Key>;
	
			get prop() {
				return this.#prop;
			}

			constructor(entry: Entry<Props, Key>) {
				super(entry);
				this.#prop = new Entry.Property(entry);
			}
	
			set(value: Props[Key]): void {
				this.#entry.set(value);
			}

			update(updater: Updater<Props[Key]>): void {
				const v = updater(this.#entry.value);
				this.#entry.set(v);
			}
		}
	}

	readonly #key: Key;
	readonly #prop: WritableProperty<Props, Key>;

	get prop() {
		return this.#prop;
	}

	constructor(key: Key, value: Props[Key]) {
		super(value);
		this.#key = key;
		this.#prop = new Entry.Property.WritableProperty(this);
	}

	/**
	 * @deprecated use set(value);
	 */
	setValue(v: Props[Key]): boolean {
		if (this.value !== v) {
			this.value = v;
			return true;
		} else {
			return false;
		}
	}
}

type MappedEntries<TSource extends Dict, TRecord extends Dict> = { readonly [P in keyof TRecord]: MappedEntry<TSource, TRecord, P> };

class MappedEntry<Source extends Dict, Props extends Dict = any, Key extends keyof Props = any> extends Entry<Props, Key> {
	readonly #transformer: TransformerHandler<Source>;

	constructor(key: Key, value: Props[Key], transformer: TransformerHandler<Source>) {
		super(key, value);
		this.#transformer = transformer;
	}

	sourceUpdated(src: IState<Source>) {
		const value = this.#transformer.call(undefined, src);
		return this.set(value);
	}
}

type IStateController<Props extends Dict> = StateController<Props>;
type IMappedStateBuilder<TRecord extends Dict, TCurrent extends Dict> = MappedStateBuilder<TRecord, TCurrent>;

function createDict<T extends Dict, M>(input: T, mapper: <K extends keyof T>(value: T[K], key: K) => M): { readonly [P in keyof T]: M } {
	const dict = Object.create(null);
	for (const [key, value] of Object.entries(input)) {
		const newValue = mapper(value, key);
		defValue(dict, key, newValue, true, false, false);
	}

	return Object.preventExtensions(dict);
}

export interface IState<Props extends Dict> {
	getValue<K extends string & keyof Props>(key: K): Props[K]
	onChange(handler: PropertyBagChangeHandler<Props>): void;
}

class State<Props extends Dict = Dict> implements IState<Props> {
	static bind<T extends Dict>(state: IState<T>): IMappedStateBuilder<T, {}> {
		return new State.#MappedStateBuilder(state);
	}

	readonly #keys: ReadonlySet<string>;
	readonly #entries: Entries<Props>;
	readonly #props: StateDict<Props>;
	readonly #handlers: PropertyBagChangeHandler<Props>[];

	get keys() {
		return this.#keys;
	}

	get props() {
		return this.#props;
	}

	protected constructor(entries: Entries<Props>, owner?: State<Props>) {
		this.#keys = new Set(Object.keys(entries));
		this.#entries = entries;
		this.#props = <any>createDict(entries, v => v.prop.prop);
		this.#handlers = owner == null ? [] : owner.#handlers;
	}

	getValue<K extends string & keyof Props>(key: K): Props[K] {
		return this.#entries[key].value;
	}

	getValues(): Props;
	getValues<const K extends (string & keyof Props)[]>(keys: K): { [P in K[number]]: Props[P] };
	getValues(keys?: string[]): any {
		const result: any = {};
		for (const key of keys ?? this.#keys)
			result[key] = this.#entries[key].value;

		return result;
	}

	onChange(handler: PropertyBagChangeHandler<Props>): void {
		this.#handlers.push(handler);
	}

	bind(): MappedStateBuilder<Props, {}> {
		return new State.#MappedStateBuilder(this);
	}

	#fireChange(bag: Partial<Props>) {
		this.#handlers.forEach(v => v.call(this, bag));
	}

	static readonly #StateController = class StateController<T extends Dict> extends this<T> implements IStateController<T> {
		readonly #props: WritableStateDict<T>;
		readonly #state: State<T>;

		get props() {
			return this.#props;
		}

		get state() {
			return this.#state;
		}

		constructor(values: T) {
			const entries: Entries<T> = createDict(values, (v, k) => <any>new Entry(k, v));
			super(entries);
			this.#state = new State(entries, this);
			this.#props = <any>createDict(entries, v => v.prop);
		}

		setValue<K extends keyof T>(key: K, value: T[K]): boolean {
			const changed = this.#entries[key].setValue(value);
			if (changed && this.#handlers.length)
				this.#fireChange({ [key]: value } as any);

			return changed;
		}
	
		setValues(values: Partial<T>) {
			let changed = false;
			if (this.#handlers.length) {
				let changedCount = 0;
				let changes: any = {};
		
				for (const key in values) {
					const value = values[key];
					if (this.#entries[key].setValue(value as any)) {
						changedCount++;
						changes[key] = value;
					}
				}
	
				changed = Boolean(changedCount);
				changed && this.#fireChange(changes);
			} else {
				for (const key in values)
					if (this.#entries[key].setValue(values[key] as any))
						changed = true;
			}

			return changed;
		}
	}

	static #MappedStateBuilder = class MappedStateBuilder<TRecord extends Dict, TCurrent extends Dict> implements IMappedStateBuilder<TRecord, TCurrent> {
		readonly #source: IState<any>;
		readonly #transformers: Record<string, Transformer<any>>;

		constructor(source: IState<any>) {
			this.#source = source;
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
	
		build(): State<any> {
			const [source, transformers] = [this.#source, this.#transformers];
			return new State.#MappedState(source, transformers);
		}
	}

	static #MappedState = class MappedState<TSource extends Dict, TRecord extends Dict> extends this<TRecord> {
		readonly #source: IState<TSource>;
		readonly #entries: MappedEntries<TSource, TRecord>
		readonly #mappings: Map<string, string[]>;
	
		constructor(source: IState<TSource>, transformers: Dict<Transformer<TSource>>) {
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
			this.#entries = entries;
			this.#source = source;
			this.#source.onChange(this.#onSourceChange.bind(this));
			this.#mappings = mappings;
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
			if (this.#handlers.length) {
				const changes: any = {};
				let count = 0;
	
				for (const key of toUpdate) {
					const entry = this.#entries[key];
					if (entry.sourceUpdated(src)) {
						count++;
						changes[key] = entry.value;
					}
				}
		
				if (count)
					this.#fireChange(changes);
			} else {
				for (const key of toUpdate)
					this.#entries[key].sourceUpdated(src);
			}
		}
	}

	static {
		StateController = this.#StateController;
	}
}

interface StateController<Props extends Dict = Dict> extends State<Props> {
	readonly state: State<Props>;
	setValue<K extends keyof Props>(key: K, value: Props[K]): boolean;
	setValues(values: Partial<Props>): boolean;
}

interface StateControllerConstructor {
	readonly prototype: StateController;
	new<Props extends Dict>(props: Props): StateController<Props>
}

var StateController: StateControllerConstructor;

type TransformerHandler<TSource extends Dict> = (src: IState<TSource>) => any;
type Transformer<TSource extends Dict> = [OneOrMany<string & keyof TSource>, TransformerHandler<TSource>];

type KeysToArgs<TRecord, K extends readonly (keyof TRecord)[]> = { [I in keyof K]: TRecord[K[I]] };

function transformMany<T extends Dict>(this: string[], transform: Fn, src: IState<T>) {
	const args = Array(this.length);
	for (let i = 0; i < args.length; i++)
		args[i] = src.getValue(this[i]);

	return transform.apply(undefined, args);
};

function transformSingle<T extends Dict>(key: string, transform: Func<any, any>, state: IState<T>) {
	const v = state.getValue(key);
	return transform(v);
}

function mapValue<T extends Dict>(key: string, state: IState<T>) {
	return state.getValue(key);
}

export { State, StateController };