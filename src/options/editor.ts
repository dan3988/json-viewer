import type { Subscriber, Unsubscriber, Updater, Writable } from "svelte/store";

class EditorSlot<K extends string, V> implements Writable<V>, EntryValue<K, V> {
	readonly #listeners: Subscriber<V>[];
	readonly #key: K;
	#value: V;
	#dirty: boolean;

	get key() {
		return this.#key;
	}

	get value() {
		return this.#value;
	}

	get isDirty() {
		return this.#dirty;
	}


	constructor(key: K, value: V) {
		this.#listeners = [];
		this.#key = key;
		this.#value = value;
		this.#dirty = false;
	}

	set(value: V): void {
		if (this.#value !== value) {
			console.log("change", this.key, this.value, value);
			this.#value = value;
			this.#dirty = true;
			this.#listeners.forEach(v => v(value));
		}
	}
	
	update(updater: Updater<V>): void {
		const v = updater(this.#value);
		this.set(v);
	}

	#unsubscribe(fn: Subscriber<V>) {
		const i = this.#listeners.indexOf(fn);
		if (i >= 0)
			this.#listeners.splice(i, 1);
	}

	subscribe(run: Subscriber<V>, invalidate?: ((value?: V | undefined) => void) | undefined): Unsubscriber {
		run(this.#value);
		const fn = invalidate ?? run;
		this.#listeners.push(fn);
		return this.#unsubscribe.bind(this, fn);
	}
}

export type EditorValues<T extends object> = { [P in keyof T]: Writable<T[P]> };
export interface EntryValue<K, V> {
	readonly key: K;
	readonly value: V;
	readonly isDirty: boolean;
}

export class EditorModel<T extends Record<string, any> = Record<string, any>> implements Iterable<EntryValue<keyof T, T[string]>> {
	readonly #slots: EditorValues<T>;

	get values() {
		return this.#slots;
	}

	constructor(value: T) {
		const slots: any = {};
		for (const [key, v] of Object.entries(value))
			slots[key] = new EditorSlot(key, v);

		this.#slots = slots;
	}

	update(values: T) {
		for (const key in values) {
			const v = values[key];
			this.#slots[key].set(v);
		}
	}

	entries(): EntryValue<keyof T, T[string]>[] {
		return Object.values(this.#slots);
	}

	[Symbol.iterator]() {
		return this.entries()[Symbol.iterator]();
	}
}

export default EditorModel;