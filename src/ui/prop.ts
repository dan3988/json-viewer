export type PropertyChangeHandler<T = any, TKey extends PropertyKey = any, TSource = unknown> = (this: TSource, evt: PropertyChangeEvent<T, TKey, TSource>) => void;

export class PropertyChangeEvent<T = any, TKey extends PropertyKey = any, TSource = unknown> {
	constructor(
		readonly source: TSource,
		readonly property: TKey,
		readonly oldValue: T,
		readonly newValue: T) { }
}

export interface PropertyChangeNotifier {
	addListener(handler: PropertyChangeHandler<any, any, this>): void;
	removeListener(handler: PropertyChangeHandler<any, any, this>): void;
}

type EventTypes<TRecord, TKey extends string & keyof TRecord, TSource> = { [P in TKey]: PropertyChangeEvent<TRecord[P], P, TSource> }[TKey];
type HandlerTypes<TRecord, TKey extends string & keyof TRecord, TSource> = Fn<[evt: EventTypes<TRecord, TKey, TSource>], any, TSource>

type A1 = { a: boolean, b: string, c: number };
type A2 = HandlerTypes<A1, keyof A1, any>;
type A3 = keyof A2;

export class PropertyBag<TRecord = any, TKey extends string & keyof TRecord = string & keyof TRecord> implements ReadonlyMap<TKey, any>, PropertyChangeNotifier {
	readonly #props: Map<TKey, any>;
	readonly #listeners: PropertyChangeHandler[];

	get size() {
		return this.#props.size;
	}

	constructor(values?: TRecord) {
		this.#props = new Map(values && <[TKey, any]>Object.entries(values));
		this.#listeners = [];
	}

	addListener(handler: HandlerTypes<TRecord, TKey, any>): void {
		this.#listeners.push(handler);
	}

	removeListener(handler: HandlerTypes<TRecord, TKey, any>): void {
		const ls = this.#listeners;
		const i = ls.indexOf(handler);
		if (i >= 0)
			ls.splice(i, 1);
	}

	#fireChange(prop: TKey, oldValue: any, newValue: any) {
		const ls = this.#listeners;
		if (ls.length) {
			const evt = new PropertyChangeEvent(this, prop, oldValue, newValue);
			for (let handler of ls)
				handler.call(this, evt);
		}
	}

	forEach(callbackfn: (value: any, key: TKey, map: this) => void, thisArg?: any): void {
		this.#props.forEach(function(value, key) { callbackfn.call(thisArg, value, key, this) }, this);
	}

	set<K extends TKey>(key: K, value: TRecord[K]): this {
		const old = this.#props.get(key);
		if (old !== value) {
			this.#props.set(key, value);
			this.#fireChange(key, old, value);
		}

		return this;
	}

	get<K extends TKey>(key: K): TRecord[K] {
		return this.#props.get(key);
	}

	has(key: TKey): boolean {
		return this.#props.has(key);
	}

	entries(): IterableIterator<[TKey, any]> {
		return this.#props.entries();
	}

	keys(): IterableIterator<TKey> {
		return this.#props.keys();
	}

	values(): IterableIterator<any> {
		return this.#props.values();
	}

	[Symbol.iterator](): IterableIterator<[TKey, any]> {
		return this.#props[Symbol.iterator]();
	}
}