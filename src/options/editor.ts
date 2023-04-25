import type { Writable, Readable, Subscriber, Unsubscriber, Updater } from "svelte/store";

type Dict<V = any> = Record<string, V>;
type DirtyType<V> = { [K in keyof V]: boolean };
type Invalidator<T> = (value?: T) => void;

export interface Entry<V> {
	value: V;
	changed: boolean;
}

export type PropsType<T extends Dict> = { [P in string & keyof T]: EntryRef<P, T[P]> };

export interface EntryRef<K extends string, V> extends Writable<Entry<V>>, Entry<V> {
	readonly key: K;
	readonly entry: Entry<V>;
}

type PropsTypeInternal<T extends Dict> = { [P in string & keyof T]: EntryImpl<P, T[P]> };

class EntryImpl<K extends string, V> implements EntryRef<K, V> {
	readonly #key: K;
	readonly #listeners: Subscriber<Entry<V>>[];
	#original: V;
	#current: V;
	#changed: boolean;
	
	get key() {
		return this.#key;
	}

	get changed() {
		return this.#changed;
	}

	get value() {
		return this.#current;
	}

	get entry(): Entry<V> {
		const value = this.#current;
		const changed = this.#changed;
		return { value, changed };
	}

	constructor(key: K, value: V) {
		this.#key = key;
		this.#original = value;
		this.#current = value;
		this.#changed = false;
		this.#listeners = [];
	}

	__setOriginal() {
		this.#original = this.#current;
		this.#changed = false;
		this.#listeners.forEach(fn => fn(this.entry));
	}

	set(entry: Entry<V>): void {
		const value = entry.value;
		const changed = value !== this.#original;
		if (changed !== this.#changed || value !== this.#current) {
			this.#changed = changed;
			this.#current = value;
			this.#listeners.forEach(fn => fn({ value, changed }));
		}
	}

	update(updater: Updater<Entry<V>>): void {
		const v = updater(this.entry);
		this.set(v);
	}

	#unsubscribe(fn: Subscriber<Entry<V>>) {
		const i = this.#listeners.indexOf(fn);
		if (i >= 0)
			this.#listeners.splice(i, 1);
	}

	subscribe(run: Subscriber<Entry<V>>, invalidate?: Invalidator<Entry<V>>): Unsubscriber {
		run(this.entry);
		const fn = invalidate ?? run;
		this.#listeners.push(fn);
		return this.#unsubscribe.bind(this, fn);
	}
}

type EditorListener = () => void;

export class EditorModel<T extends Dict = Dict> {
	readonly #props: PropsTypeInternal<T>;
	readonly #listeners: EditorListener[];

	get props(): PropsType<T> {
		return this.#props;
	}

	constructor(values: T) {
		const props: any = {};
		const handler = this.#handler.bind(this);

		this.#props = props;
		this.#listeners = [];

		for (const key in values) {
			const value = values[key];
			const entry = new EntryImpl(key, value);
			entry.subscribe(handler);
			props[key] = entry;
		}
	}

	addListener(listener: EditorListener) {
		this.#listeners.push(listener);
	}

	removeListener(listener: EditorListener) {
		const ix = this.#listeners.indexOf(listener);
		ix >= 0 && this.#listeners.splice(ix, 1);
	}

	#handler() {
		this.#listeners.forEach(v => v());
	}

	commit() {
		const props = this.#props;
		for (const key in props)
			props[key].__setOriginal();
	}
}

export default EditorModel;