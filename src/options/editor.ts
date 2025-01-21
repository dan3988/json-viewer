import type { Writable, Readable, Subscriber, Unsubscriber, Updater } from "svelte/store";
import type preferences from "../preferences-core";
import { writable } from "svelte/store";
import ImmutableArray from "../immutable-array";

type Dict<V = any> = Record<string, V>;
type Invalidator<T> = (value?: T) => void;

export interface Entry<V> {
	readonly value: V;
	readonly changed: boolean;
}

export interface NamedEntry<K extends string = any, V = any> extends Entry<V> {
	readonly key: K;
}

export type PropsType<T extends Dict> = { [P in string & keyof T]: EntryRef<P, T[P]> };

export interface EntryRef<K extends string, V> extends Writable<V>, NamedEntry<K, V> {
	readonly key: K;
	readonly value: V;
	readonly changed: boolean;

	reset(): boolean;
}

type EditorListener<T> = (this: T) => void;

export class EditorModel<T extends Dict = Dict> {
	readonly #props: PropsType<T>;
	readonly #listeners: EditorListener<this>[];
	readonly #changedSet: Set<string & keyof T>;
	readonly #changed: Writable<ImmutableArray<string & keyof T>>;

	get changed(): Readable<ImmutableArray<string & keyof T>> {
		return this.#changed;
	}

	get props() {
		return this.#props;
	}

	constructor(values: preferences.core.ToEntries<T>) {
		const props: any = {};

		this.#props = props;
		this.#listeners = [];
		this.#changedSet = new Set();
		this.#changed = writable(ImmutableArray.empty);
		
		for (const [key, [pref, value]] of Object.entries(values))
			props[key] = new EditorModel.#EntryImpl(this, pref, value);
	}

	addListener(listener: EditorListener<this>) {
		this.#listeners.push(listener);
	}

	removeListener(listener: EditorListener<this>) {
		const ix = this.#listeners.indexOf(listener);
		ix >= 0 && this.#listeners.splice(ix, 1);
	}

	#onEntryChanged(e: NamedEntry<string & keyof T>) {
		const wasChanged = this.#changedSet.has(e.key);
		if (wasChanged !== e.changed) {
			const fn = e.changed ? 'add' : 'delete';
			this.#changedSet[fn](e.key);
			this.#changed.set(ImmutableArray.from(this.#changedSet));
		}

		this.#listeners.forEach(v => v.call(this));
	}

	commit() {
		const props = this.#props;
		for (const key in props)
			(props[key] as any).__setOriginal();

		if (this.#changedSet.size) {
			this.#changedSet.clear();
			this.#changed.set(ImmutableArray.empty);
		}
	}

	static readonly #EntryImpl = class EntryImpl<K extends string, V> implements EntryRef<K, V> {
		readonly #owner: EditorModel;
		readonly #preference: preferences.core.Preference<V, K>;
		readonly #listeners: Subscriber<V>[];
		#original: V;
		#current: V;
		#changed: boolean;

		get key() {
			return this.#preference.key;
		}
		
		get preference() {
			return this.#preference;
		}
	
		get changed() {
			return this.#changed;
		}
	
		get value() {
			return this.#current;
		}
	
		constructor(owner: EditorModel, preference: preferences.core.Preference<V, K>, value: V) {
			this.#owner = owner;
			this.#preference = preference;
			this.#original = value;
			this.#current = value;
			this.#changed = false;
			this.#listeners = [];
		}

		#fireChanged() {
			const value = this.#current;
			this.#owner.#onEntryChanged(this);
			this.#listeners.forEach(fn => fn(value));
		}
	
		__setOriginal() {
			this.#original = this.#current;
			this.#changed = false;
		}
	
		reset(): boolean {
			if (!this.#changed)
				return false;
	
			this.#current = this.#original;
			this.#changed = false;
			this.#fireChanged();
			return true;
		}
	
		set(value: V): void {
			const changed = !this.#preference.areSame(value, this.#original);
			if (changed !== this.#changed || value !== this.#current) {
				this.#changed = changed;
				this.#current = value;
				this.#fireChanged();
			}
		}
	
		update(updater: Updater<V>): void {
			const v = updater(this.#current);
			this.set(v);
		}
	
		#unsubscribe(fn: Subscriber<V>) {
			const i = this.#listeners.indexOf(fn);
			if (i >= 0)
				this.#listeners.splice(i, 1);
		}
	
		subscribe(run: Subscriber<V>, invalidate?: Invalidator<V>): Unsubscriber {
			run(this.#current);
			const fn = invalidate ?? run;
			this.#listeners.push(fn);
			return this.#unsubscribe.bind(this, fn);
		}
	}
}

export default EditorModel;