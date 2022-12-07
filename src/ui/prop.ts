import type { Readable, Subscriber, Unsubscriber } from "svelte/store";

type Invalidator<T> = (value?: T) => void;

interface IReadable<T = undefined> extends Readable<T> {
	readonly value: T;
}

interface IReadableImpl<T = undefined> extends IReadable<T> {
	setValue(value: T): void;
}

type Readables<T> = { readonly [P in keyof T]: IReadable<T[P]> };
type ReadableImpls<T> = { readonly [P in keyof T]: IReadableImpl<T[P]> };

export interface ReadOnlyPropertyBag<TRecord extends Record<string, any> = Record<string, any>> {
	readonly readables: Readables<TRecord>;

	getValue<K extends keyof TRecord>(key: K): TRecord[K];
}

type IReadOnlyPropertyBag<T extends Record<string, any>> = ReadOnlyPropertyBag<T>;

export class PropertyBag<TRecord extends Record<string, any> = Record<string, any>> implements ReadOnlyPropertyBag<TRecord> {
	static readonly #ReadOnly = class ReadOnlyPropertyBag<TRecord extends Record<string, any>> implements IReadOnlyPropertyBag<TRecord> {
		readonly #owner: PropertyBag<TRecord>;

		get readables() {
			return this.#owner.#readables;
		}

		constructor(owner: PropertyBag<TRecord>) {
			this.#owner = owner;
		}

		getValue<K extends keyof TRecord>(key: K): TRecord[K] {
			return this.#owner.getValue(key);
		}
	}

	static readonly #Readable = class ReadableImpl<TRecord extends Record<string | symbol, any>, TKey extends keyof TRecord> implements IReadableImpl<TRecord[TKey]> {
		readonly #owner: PropertyBag<TRecord>;
		readonly #key: TKey;
		#value: TRecord[TKey];
		readonly #subs: Map<number, Invalidator<TRecord[TKey]>>;
		#subNo: number;

		get value() {
			return this.#value;
		}

		constructor(owner: PropertyBag<TRecord>, key: TKey, value: TRecord[TKey]) {
			this.#owner = owner;
			this.#key = key;
			this.#value = value;
			this.#subs = new Map();
			this.#subNo = 0;
			//this.subscribe = this.subscribe.bind(this);
		}

		setValue(v: TRecord[TKey]) {
			if (this.#value !== v) {
				this.#value = v;
				this.#subs.forEach(fn => fn(v));
			}
		}

		#unsubscribe(subNo: number): void {
			this.#subs.delete(subNo);
		}

		subscribe(run: Subscriber<TRecord[TKey]>, invalidate?: Invalidator<TRecord[TKey]>): Unsubscriber {
			const value = this.#value;
			run(value);
			const subNo = this.#subNo++;
			this.#subs.set(subNo, invalidate ?? run);
			return this.#unsubscribe.bind(this, subNo);
		}
	}

	readonly #readables: ReadableImpls<TRecord>;
	readonly #readOnly: ReadOnlyPropertyBag<TRecord>;

	get readables(): Readables<TRecord> {
		return this.#readables as any;
	}

	get readOnly() {
		return this.#readOnly;
	}

	constructor(values: TRecord) {
		const readables: any = {};

		for (const key in values) {
			const v = values[key];
			readables[key] = new PropertyBag.#Readable(this, key, v);
		}

		this.#readables = readables;
		this.#readOnly = new PropertyBag.#ReadOnly(this);
	}

	getValue<K extends keyof TRecord>(key: K): TRecord[K] {
		return this.#readables[key].value;
	}

	setValue<K extends keyof TRecord>(key: K, value: TRecord[K]) {
		this.#readables[key].setValue(value);
	}
}