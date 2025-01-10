import type { Invalidator, Readable, Subscriber, Unsubscriber, Updater, Writable } from 'svelte/store';

export function bulkListen<K extends string, V>(stores: { [P in K]: Store<V> }, handler: (key: K, value: V) => void) {
	for (const [prop, store] of Object.entries(stores))
		(store as Store<any>).listen(v => handler(prop as K, v));
}

export function bulkSubscribe<K extends string, V>(stores: { [P in K]: Store<V> }, handler: (key: K, value: V) => void) {
	for (const [prop, store] of Object.entries(stores))
		(store as Store<any>).subscribe(v => handler(prop as K, v));
}

export abstract class Store<T> implements Readable<T> {
	abstract get value(): T;

	constructor() {
		this.subscribe = this.subscribe.bind(this);
	}

	abstract listen(listener: Subscriber<T>, invalidate?: Action): Unsubscriber;

	subscribe(run: Subscriber<T>, invalidate?: Invalidator<T> | undefined): Unsubscriber {
		run(this.value);
		return this.listen(run, invalidate);
	}
}

export abstract class WritableStore<T> extends Store<T> implements Writable<T> {
	/**
	 * Use another store's value until set() is called
	 */
	static rewritable<T>(source: Readable<T>): WritableStore<T>;
	static rewritable<T, V>(source: Readable<V>, converter: (row: V) => T): WritableStore<T>;
	static rewritable(source: Readable<any>, converter?: (row: any) => any): WritableStore<any> {
		return new RewritableStore(source, converter);
	}

	abstract get value(): T;
	abstract set value(value: T);

	constructor() {
		super();
		this.set = this.set.bind(this);
		this.update = this.update.bind(this);
	}

	abstract set(value: T): boolean;

	update(updater: Updater<T>): void {
		this.value = updater(this.value);
	}
}

class StoreListeners<T> {
	readonly #subs: Map<number, Subscriber<T> | readonly [Subscriber<T>, Action]>;
	#subId: number;

	constructor() {
		this.#subs = new Map();
		this.#subId = 0;
	}

	fire(value: T) {
		for (const subscriber of this.#subs.values()) {
			const run = typeof subscriber === 'function' ? subscriber : subscriber[0];
			run(value);
		}
	}

	#unsub(id: number) {
		const v = this.#subs.get(id);
		if (v) {
			const invalidator = typeof v !== 'function' && v[1];
			invalidator && invalidator();
			this.#subs.delete(id);
		}
	}

	listen(listener: Subscriber<T>, invalidate?: Action | undefined) {
		const value = invalidate ? [listener, invalidate] as const : listener;
		const id = ++this.#subId;
		this.#subs.set(id, value);
		return this.#unsub.bind(this, id);
	}
}

class RewritableStore<T> extends WritableStore<T> {
	readonly #converter?: (row: any) => T;
	readonly #listeners: StoreListeners<T>;
	#unsub: Action;
	#isSet = false;
	#value!: T;

	get value(): T {
		return this.#value;
	}

	set value(value: T) {
		this.set(value);
	}

	constructor(source: Readable<any>, converter?: (row: any) => T) {
		super();
		this.#converter = converter;
		this.#listeners = new StoreListeners();
		this.#unsub = source.subscribe(this.#onSourceUpdated.bind(this));
	}

	#onSourceUpdated(value: any) {
		if (this.#converter)
			value = this.#converter(value);

		if (this.#value !== value) {
			this.#value = value;
			this.#listeners.fire(value);
		}
	}

	set(value: T): boolean {
		if (!this.#isSet) {
			this.#isSet = true;
			this.#unsub();
			this.#unsub = undefined!;
		}

		if (this.#value === value)
			return false;

		this.#value = value;
		this.#listeners.fire(value);
		return true;
	}

	listen(listener: Subscriber<T>, invalidate?: Action): Unsubscriber {
		return this.#listeners.listen(listener, invalidate);
	}
}

export type Comparer<T> = (x: T, y: T) => boolean;

const strictEquals: Comparer<any> = (x, y) => x === y;

export class WritableStoreImpl<T> extends WritableStore<T> {
	readonly #comparer: Comparer<T>;
	readonly #listeners: StoreListeners<T>;
	#value: T;

	get value() {
		return this.#value;
	}

	set value(value: T) {
		this.set(value);
	}

	constructor(value: T, comparer: Comparer<T> = strictEquals) {
		super();
		this.#value = value;
		this.#comparer = comparer;
		this.#listeners = new StoreListeners();
	}

	protected onChanged(oldValue: T, newValue: T) {
	}

	set(value: T): boolean {
		const old = this.#value;
		if (this.#comparer(old, value))
			return false;

		this.#value = value;
		this.onChanged(old, value);
		this.#listeners.fire(value);
		return true;
	}

	listen(listener: Subscriber<T>, invalidate?: Action | undefined) {
		return this.#listeners.listen(listener, invalidate);
	}

	update(updater: Updater<T>): void {
		const value = updater(this.#value);
		this.#value = value;
		this.#listeners.fire(value);
	}
}

export interface DisposableStore<T> extends Store<T>, Disposable {
}

class ConstantStore<T> implements Store<T> {
	readonly #value: T;

	get value() {
		return this.#value;
	}

	constructor(value: T) {
		this.#value = value;
	}

	listen(): Unsubscriber {
		return Function.prototype as Unsubscriber;
	}

	subscribe(run: Subscriber<T>): Unsubscriber {
		run(this.#value);
		return Function.prototype as Unsubscriber;
	}
}

class ConvertStore<T, V> implements DisposableStore<V> {
	readonly #converter: (value: T) => V;
	readonly #dispose: Unsubscriber;
	readonly #controller: StoreController<V>;

	get value() {
		return this.#controller.value;
	}

	constructor(store: Readable<T>, converter: (value: T) => V) {
		const subscriber = this.#handler.bind(this);
		this.#converter = converter;
		this.#controller = new StoreController<V>(undefined!);
		this.#dispose = store.subscribe(subscriber);
	}

	listen(run: Subscriber<any>, invalidate?: Action): Unsubscriber {
		return this.#controller.listen(run, invalidate);
	}

	subscribe(run: Subscriber<any>, invalidate?: Action): Unsubscriber {
		return this.#controller.subscribe(run, invalidate);
	}

	[Symbol.dispose](): void {
		this.#dispose();
	}

	#handler(value: T) {
		this.#controller.value = this.#converter.call(undefined, value);
	}
}

class DerivedStore implements DisposableStore<any> {
	readonly #values: any[];
	readonly #converter?: (...values: any[]) => any;
	readonly #disposers: any[];
	readonly #controller: StoreController<any>;

	get value() {
		return this.#controller.value;
	}

	constructor(stores: Readable<any>[], converter?: (...values: any[]) => any) {
		this.#values = Array(stores.length);
		this.#disposers = Array(stores.length);
		this.#converter = converter;

		for (let i = 0; i < stores.length; i++) {
			const subscriber = this.#handler.bind(this, i);
			this.#disposers[i] = stores[i].subscribe(subscriber);
		}

		const value = converter ? converter.apply(undefined, this.#values) : this.#values;
		this.#controller = new StoreController(value);
	}

	listen(run: Subscriber<any>, invalidate?: Action): Unsubscriber {
		return this.#controller.listen(run, invalidate);
	}

	subscribe(run: Subscriber<any>, invalidate?: Action | undefined): Unsubscriber {
		return this.#controller.subscribe(run, invalidate);
	}

	[Symbol.dispose](): void {
		for (const disposer of this.#disposers)
			disposer();

		this.#disposers.length = 0;
	}

	#handler(index: number, value: any) {
		const values = this.#values;
		if (values[index] !== value) {
			values[index] = value;
			const [controller, converter] = [this.#controller, this.#converter];
			if (controller)
				controller.value = converter ? converter.apply(undefined, values) : values;
		}
	}
}

type GetValues<T extends Readable<any>[]> = { [P in keyof T]: T[P] extends Readable<infer V> ? V : unknown };

export class StoreController<T> extends WritableStoreImpl<T> {
	static const<T>(value: T): Store<T> {
		return new ConstantStore(value);
	}

	static derived<T, V>(store: Readable<T>, converter: (value: T) => V): DisposableStore<V>
	static derived<const T extends Readable<any>[]>(stores: T): DisposableStore<GetValues<T>>;
	static derived<V, const T extends Readable<any>[]>(stores: T, converter: (...values: GetValues<T>) => V): DisposableStore<V>;
	static derived(stores: Readable<any> | Readable<any>[], converter?: (...values: any[]) => any){
		if (Array.isArray(stores)) {
			return new DerivedStore(stores, converter);
		} else {
			return new ConvertStore(stores, converter!);
		}
	}

	readonly #store: Store<T>;

	get store() {
		return this.#store;
	}

	constructor(value: T) {
		super(value);
		this.#store = new StoreController.#StoreImpl(this);
	}

	static readonly #StoreImpl = class Store<T> implements Readable<T> {
		readonly #owner: StoreController<T>;

		get value() {
			return this.#owner.value;
		}

		constructor(owner: StoreController<T>) {
			this.#owner = owner;
		}

		listen(run: Subscriber<any>, invalidate?: Action): Unsubscriber {
			return this.#owner.listen(run, invalidate);
		}

		subscribe(run: Subscriber<T>, invalidate?: Action | undefined): Unsubscriber {
			return this.#owner.subscribe(run, invalidate);
		}
	}
}

export default StoreController;