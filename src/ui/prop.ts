import { type IEvent, EventHandlers } from "./evt";

export type PropertyChangeHandler<T = any, TKey extends PropertyKey = any, TSource = unknown> = (this: TSource, evt: PropertyChangeEvent<T, TKey, TSource>) => void;
export type PropertyChangeType = "create" | "change" | "delete";

export class PropertyChangeEvent<T = any, TKey extends PropertyKey = PropertyKey, TSource = unknown> {
	constructor(
		readonly source: TSource,
		readonly type: PropertyChangeType,
		readonly property: TKey,
		readonly oldValue: T,
		readonly newValue: T) { }
}

export interface PropertyChangeNotifier<TRecord extends Record<string, any> = Record<string, any>, TKey extends keyof TRecord = keyof TRecord> {
	propertyChange: IEvent<PropertyChangeHandlerTypes<this, TRecord, TKey>>;
}

export type PropertyChangeEventType<TSource> = TSource extends PropertyChangeNotifier<infer TRecord, infer TKey> ? PropertyChangeEventTypes<TSource, TRecord, TKey> : never;
export type PropertyChangeEventTypes<TSource, TRecord, TKey extends keyof TRecord = keyof TRecord> = { [P in TKey]: PropertyChangeEvent<TRecord[P], P, TSource> }[TKey];

export type PropertyChangeHandlerType<TSource> = TSource extends PropertyChangeNotifier<infer TRecord, infer TKey> ? PropertyChangeHandlerTypes<TSource, TRecord, TKey> : never;
export type PropertyChangeHandlerTypes<TSource, TRecord, TKey extends keyof TRecord = keyof TRecord> = Fn<[evt: PropertyChangeEventTypes<TSource, TRecord, TKey>], any, TSource>;

export class PropertyBag<TRecord = any, TKey extends keyof TRecord = keyof TRecord> implements PropertyChangeNotifier<TRecord, TKey> {
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
	readonly #pc: EventHandlers<PropertyChangeHandlerTypes<this, TRecord, TKey>>;

	get bag(): TRecord {
		return this.#bag;
	}

	get size() {
		return this.#props.size;
	}

	get propertyChange() {
		return this.#pc.event;
	}

	constructor(values?: TRecord) {
		this.#props = {};
		this.#bag = new Proxy(this, PropertyBag.#handler);
		this.#pc = new EventHandlers();
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

	#fireChange(prop: TKey, type: PropertyChangeType, oldValue: any, newValue: any) {
		const pc = this.#pc;
		if (pc.length) {
			const evt = new PropertyChangeEvent(this, type, prop, oldValue, newValue);
			pc.fire(this, [evt]);
		}
	}
}