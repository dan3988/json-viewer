export type PropertyChangeHandler<T = any, TKey extends PropertyKey = any, TSource = unknown> = (this: TSource, evt: PropertyChangeEvent<T, TKey, TSource>) => void;
export type PropertyChangeType = "create" | "change" | "delete";

export class PropertyChangeEvent<T = any, TKey extends PropertyKey = any, TSource = unknown> {
	constructor(
		readonly source: TSource,
		readonly type: PropertyChangeType,
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

export class PropertyBag<TRecord = any, TKey extends string & keyof TRecord = string & keyof TRecord> implements PropertyChangeNotifier {
	static readonly #handler: ProxyHandler<PropertyBag<any>> = {
		get(t, p) {
			return Reflect.get(t.#props, p);
		},
		getOwnPropertyDescriptor(t, p) {
			return Reflect.getOwnPropertyDescriptor(t.#props, p);
		},
		set(t, p, value) {
			const props = t.#props;
			const desc = Reflect.getOwnPropertyDescriptor(props, p);
			if (desc === undefined) {
				t.#props[p] = value;
				t.#fireChange(p, "create", undefined, desc.value);
			} else if (desc.writable) {
				const old = desc.value;
				desc.value = value;
				Reflect.defineProperty(props, p, desc);
				if (old !== value)
					t.#fireChange(p, "change", old, value);
			} else {
				return false;
			}

			return true;
		},
		defineProperty(t, p, desc) {
			if (desc.get || desc.set)
				throw new TypeError("Cannot define accessor properies on PropertyBag.bag");

			const props = t.#props;
			const oldDesc = Reflect.getOwnPropertyDescriptor(props, p);
			if (oldDesc === undefined) {
				Reflect.defineProperty(props, p, desc);
				t.#fireChange(p, "create", undefined, desc.value);
			} else {
				Reflect.defineProperty(props, p, desc);
				if (oldDesc.value !== desc.value)
					t.#fireChange(p, "change", oldDesc.value, desc.value);
			}

			return true;
		},
		deleteProperty(t, p) {
			const props = t.#props;
			const desc = Reflect.getOwnPropertyDescriptor(t.#props, p);
			if (desc === undefined)
				return false;

			Reflect.deleteProperty(props, p);
			t.#fireChange(p, "delete", desc.value, undefined);
			return true;
		},
		ownKeys(t) {
			return Reflect.ownKeys(t.#props);
		},
		getPrototypeOf() {
			return null;
		},
		setPrototypeOf() {
			return false;
		},
		has(t, p) {
			return p in t.#props;
		}
	}

	readonly #props: any;
	readonly #bag: any;
	readonly #listeners: PropertyChangeHandler[];

	get bag(): TRecord {
		return this.#bag;
	}

	get size() {
		return this.#props.size;
	}

	constructor(values?: TRecord) {
		this.#props = {};
		this.#bag = new Proxy(this, PropertyBag.#handler);
		this.#listeners = [];
		if (values) {
			const p = this.#props;
			for (const [key, value] of Object.entries(values)) {
				Reflect.defineProperty(p, key, {
					enumerable: true,
					writable: true,
					value
				});
			}
		}
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

	#fireChange(prop: PropertyKey, type: PropertyChangeType, oldValue: any, newValue: any) {
		const ls = this.#listeners;
		console.log(Array.prototype.join.call(arguments, ", "));
		if (ls.length) {
			const evt = new PropertyChangeEvent(this, type, prop, oldValue, newValue);
			for (let handler of ls)
				handler.call(this, evt);
		}
	}
}