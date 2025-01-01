import { State, StateController } from "./state.js";
import ImmutableArray from "./immutable-array.js";

const enum WatchTypes {
	None,
	Local = 1,
	Sync = 2,
	Both = 3
}

const _PreferencesManager = class PreferencesManager<T extends Dict> implements preferences.PreferencesManager<T> {
	readonly #prefs: Map<string, preferences.Preference>;

	constructor(prefs: readonly preferences.Preference[]) {
		this.#prefs = new Map();

		for (const pref of prefs)
			this.#prefs.set(pref.key, pref);
	}

	getPreference<K extends string & keyof T>(key: K): preferences.Preference<T[K], K> {
		const pref = this.#prefs.get(key);
		if (pref == null)
			throw new TypeError(`Unknown setting: '${key}'`);

		return pref as any;
	}

	async #get(prefs: preferences.Preference[], entries = false): Promise<[Dict, WatchTypes]> {
		let local: string[] = [];
		let synced: string[] = [];
		let watching = WatchTypes.None;

		for (const pref of prefs)
			(pref.synced ? synced : local).push(pref.key);

		const promises: Promise<any>[] = [];

		if (local.length) {
			promises.push(chrome.storage.local.get(local));
			watching |= WatchTypes.Local;
		}

		if (synced.length) {
			promises.push(chrome.storage.sync.get(synced));
			watching |= WatchTypes.Sync;
		}

		const results: Dict = {};

		for (const obj of await Promise.all(promises))
			for (const key in obj)
				results[key] = obj[key];

		const output: Dict = {};

		for (const pref of prefs) {
			const { key, type } = pref;
			const value = key in results ? type.deserialize(results[key]) : pref.getDefaultValue();
			output[key] = entries ? [pref, value] : value;
		}
		
		return [output, watching];
	}

	#getPreferences(keys: readonly string[]) {
		return keys.length ? keys.map(this.getPreference, this) : Array.from(this.#prefs.values());
	}

	get(): Promise<T>;
	get<const K extends (string & keyof T)[]>(...keys: K): Promise<Pick<T, K[number]>>;
	async get(...keys: string[]): Promise<Dict> {
		const prefs = this.#getPreferences(keys);
		const [result] = await this.#get(prefs);
		return result;
	}

	getEntries(): Promise<preferences.ToEntries<T>>;
	getEntries<const K extends (string & keyof T)[]>(...keys: K): Promise<preferences.ToEntries<T, K[number]>>;
	async getEntries(...keys: string[]): Promise<Dict> {
		const prefs = this.#getPreferences(keys);
		const [result] = await this.#get(prefs, true);
		return result;
	}

	set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
	set(values: Partial<T>): Promise<void>;
	async set(arg0: string | Dict, arg1?: any): Promise<void> {
		if (typeof arg0 === "string") {
			const pref = this.getPreference(arg0);
			const store = chrome.storage[pref.synced ? "sync" : "local"];
			if (pref.type.serialize)
				arg1 = pref.type.serialize(arg1);

			await store.set({ [arg0]: arg1 });
		} else {
			let local: undefined | Dict;
			let sync: undefined | Dict;

			for (const key in arg0) {
				const pref = this.getPreference(key);
				const bag = (pref.synced ? local ??= {} : sync ??= {})
				let value = arg0[key];
				if (pref.type.serialize)
					value = pref.type.serialize(value);

				bag[key] = value;
			}

			const promises: Promise<any>[] = [];

			local && promises.push(chrome.storage.local.set(local));
			sync && promises.push(chrome.storage.local.set(sync));

			await Promise.all(promises);
		}
	}

	watch(): Promise<State<T>>;
	watch<const K extends (string & keyof T)[]>(...keys: K): Promise<State<Pick<T, K[number]>>>;
	async watch(...keys: string[]): Promise<State<any>> {
		const prefs = this.#getPreferences(keys);
		const [values, watching] = await this.#get(prefs);
		const controller = new StateController(values);

		const onChange = (changes: Dict<chrome.storage.StorageChange>) =>{
			let count = 0;
			let values: any = {};
	
			for (const key in changes) {
				if (controller.keys.has(key)) {
					const pref = this.#prefs.get(key)!;
					values[key] = pref.type.deserialize(changes[key].newValue);
					count++;
				}
			}
	
			if (count)
				controller.setValues(values);
		}

		if ((watching & WatchTypes.Local) != 0)
			chrome.storage.local.onChanged.addListener(onChange);

		if ((watching & WatchTypes.Sync) != 0)
			chrome.storage.sync.onChanged.addListener(onChange);

		return controller.state;
	}
}

export namespace preferences {
	export interface SettingType<T = unknown> {
		readonly name: string;
		deserialize(value: any): T;
		serialize(value: T): any;
		areSame(x: T, y: T): boolean;
	}

	export interface DefaultValueSettingType<T> extends SettingType<T> {
		createDefault(): T;
	}

	export namespace types {
		abstract class BaseSettingType<T> implements SettingType<T> {
			constructor(readonly name: string) {}

			abstract deserialize(value: any): T;
			abstract areSame(x: T, y: T): boolean;

			serialize(value: T): any {
				return value;
			}
		}

		class PrimitiveSettingType<T> extends BaseSettingType<T> {
			constructor(readonly type: (v: any) => T, name: string = type.name) {
				super(name);
			}

			deserialize(value: any): T {
				return this.type(value);
			}

			areSame(x: T, y: T): boolean {
				return x === y;
			}
		}

		export const bool = new PrimitiveSettingType(Boolean);
		export const int = new PrimitiveSettingType(parseInt, 'Integer');
		export const number = new PrimitiveSettingType(Number);
		export const string = new PrimitiveSettingType(String);

		const primitives = { bool, int, number, string };

		type Primitives = { [P in keyof typeof primitives]: typeof primitives[P] extends SettingType<infer V> ? V : never };

		function toType(value: SettingType | keyof Primitives) {
			return typeof value === 'string' ? primitives[value] : value;
		}

		class EnumerationSettingType<T, const E extends T[]> extends BaseSettingType<E[number]> {
			constructor(readonly underlyingType: SettingType<T>, readonly values: E, readonly defaultValue: E[number]) {
				super(`Enum<${underlyingType.name}>`);
			}

			deserialize(value: any): E[number] {
				var i = this.values.indexOf(value);
				return i < 0 ? this.defaultValue : this.values[i];
			}

			areSame(x: E[number], y: E[number]): boolean {
				return this.underlyingType.areSame(x, y);
			}
		}

		export function enumeration<T, const E extends T[]>(underlyingType: SettingType<T>, values: E, defaultValue: E[number]): SettingType<E[number]>
		export function enumeration<K extends keyof Primitives, const E extends Primitives[K][]>(underlyingType: K, values: E, defaultValue: E[number]): SettingType<E[number]>
		export function enumeration(underlyingType: SettingType | keyof Primitives, values: any[], defaultValue: any) {
			return new EnumerationSettingType(toType(underlyingType), values, defaultValue);
		}

		class ListSettingType<T> extends BaseSettingType<ImmutableArray<T>> {
			constructor(readonly underlyingType: SettingType<T>) {
				super(`List<${underlyingType.name}>`);
			}

			deserialize(value: any): ImmutableArray<T> {
				const type = this.underlyingType;
				return ImmutableArray.from(value, (value) => type.deserialize(value));
			}

			areSame(x: ImmutableArray<T>, y: ImmutableArray<T>): boolean {
				if (x.length !== y.length)
					return false;

				for (let i = 0; i < x.length; i++)
					if (!this.underlyingType.areSame(x[i], y[i]))
						return false;

				return true;
			}
		}

		export function list<T>(underlyingType: SettingType<T>): SettingType<ImmutableArray<T>>
		export function list<K extends keyof Primitives>(underlyingType: K): SettingType<readonly Primitives[K][]>
		export function list(underlyingType: SettingType | keyof Primitives) {
			return new ListSettingType(toType(underlyingType));
		}

		class DictionarySettingType<T> extends BaseSettingType<Dict<T>> {
			constructor(readonly valueType: SettingType<T>) {
				super(`Dictionary<${valueType.name}>`);
			}

			serialize(value: Dict<T>) {
				const result: Dict<T> = {};
				for (const key in value)
					result[key] = this.valueType.serialize(value[key]);

				return result;
			}

			deserialize(value: any): Dict<T> {
				const result: Dict<T> = Object.create(null);
				for (const key in value)
					result[key] = this.valueType.deserialize(value[key]);
	
				return result;
			}

			areSame(x: Dict<T>, y: Dict<T>): boolean {
				const keys = Object.keys(x);
				if (keys.length != Object.keys(y).length)
					return false;
	
				for (const key of keys)
					if (!(key in y) || !this.valueType.areSame(x[key], y[key]))
						return false;

				return true;
			}
		}

		export function dictionary<T>(valueType: SettingType<T>): SettingType<Dict<T>>
		export function dictionary<K extends keyof Primitives>(valueType: K): SettingType<Dict<Primitives[K]>>
		export function dictionary(valueType: SettingType | keyof Primitives) {
			return new DictionarySettingType(toType(valueType));
		}

		class ObjectSettingType<T> extends BaseSettingType<T> {
			constructor(readonly schema: { [P in keyof T]: SettingType<T[P]> }) {
				super('Object');
			}

			serialize(value: T) {
				const result: any = {};
				for (const key in this.schema)
					result[key] = this.schema[key].serialize(value[key]);

				return result;
			}

			deserialize(value: any): T {
				const result: any = {};
				for (const key in this.schema)
					result[key] = this.schema[key].deserialize(value[key]);

				return result;
			}

			areSame(x: T, y: T): boolean {
				for (const key in this.schema) {
					const type = this.schema[key];
					if (!type.areSame(x[key], y[key]))
						return false;
				}

				return true;
			}
		}

		export function object<T>(schema: { [P in keyof T]: SettingType<T[P]> }) {
			return new ObjectSettingType(schema);
		}

		type TupleSchema<T extends ImmutableArray> = readonly SettingType[] & { [P in number & keyof T]: SettingType<T[P]> };

		class TupleSettingType<const T extends ImmutableArray> extends BaseSettingType<T> {
			constructor(readonly schema: TupleSchema<T>) {
				super('Tuple');
			}

			serialize(value: T) {
				const result: any[] = [];
				for (let i = 0; i < this.schema.length; i++) {
					const v = this.schema[i].serialize(value[i]);
					result.push(v);
				}

				return result as any;
			}
			
			deserialize(value: any): T {
				const result: any[] = [];
				for (let i = 0; i < this.schema.length; i++) {
					const v = this.schema[i].deserialize(value[i]);
					result.push(v);
				}

				return result as any;
			}

			areSame(x: T, y: T): boolean {
				for (const key in this.schema) {
					const type = this.schema[key];
					if (!type.areSame(x[key], y[key]))
						return false;
				}

				return true;
			}
		}

		export function tuple<const T extends ImmutableArray>(...schema: TupleSchema<T>) {
			return new TupleSettingType(schema);
		}

		class NullableSettingType<T> extends BaseSettingType<T | null> {
			constructor(readonly underlyingType: SettingType<T>) {
				super(`Nullable<${underlyingType.name}>`);
			}

			serialize(value: T | null) {
				return value == null ? null : this.underlyingType.serialize(value);
			}

			deserialize(value: any): T | null {
				return value == null ? null : this.underlyingType.deserialize(value);
			}

			areSame(x: T | null, y: T | null): boolean {
				return x === null ? y === null : (y !== null && this.underlyingType.areSame(x, y));
			}
		}

		export function nullable<T>(underlyingType: SettingType<T>): SettingType<null | T>
		export function nullable<K extends keyof Primitives>(underlyingType: K): SettingType<null | Primitives[K]>
		export function nullable(underlyingType: SettingType | keyof Primitives) {
			return new NullableSettingType(toType(underlyingType));
		}

		export type ValueOf<T extends SettingType> = T extends SettingType<infer V> ? V : unknown;
	}

	export class Preference<T = any, K extends string = string> {
		static int<K extends string>(key: K, synced: boolean, defaultValue: number): Preference<number, K> {
			return new Preference(key, types.int, synced, defaultValue);
		}

		static number<K extends string>(key: K, synced: boolean, defaultValue: number): Preference<number, K> {
			return new Preference(key, types.number, synced, defaultValue);
		}

		static boolean<K extends string>(key: K, synced: boolean, defaultValue: boolean): Preference<boolean, K> {
			return new Preference(key, types.bool, synced, defaultValue);
		}

		static string<K extends string>(key: K, synced: boolean, defaultValue: string): Preference<string, K> {
			return new Preference(key, types.string, synced, defaultValue);
		}

		static list<K extends string, T>(key: K, underlyingType: SettingType<T>, synced: boolean, defaultValue: T[]): Preference<ImmutableArray<T>, K> {
			return new Preference(key, types.list(underlyingType), synced, ImmutableArray.from(defaultValue));
		}

		static enum<K extends string, T, const E extends T[]>(key: K, underlyingType: SettingType<T>, values: E, synced: boolean, defaultValue: E[number]): Preference<E[number], K> {
			return new Preference(key, types.enumeration(underlyingType, values, defaultValue), synced, defaultValue);
		}

		static nullable<K extends string, T>(key: K, underlyingType: SettingType<T>, synced: boolean, defaultValue?: null | T): Preference<null | T, K> {
			return new Preference(key, types.nullable(underlyingType), synced, defaultValue ?? null);
		}

		static dictionary<K extends string, T>(key: K, underlyingType: SettingType<T>, synced: boolean, defaultValue: Dict<T> = {}): Preference<Dict<T>, K> {
			return new Preference(key, types.dictionary(underlyingType), synced, defaultValue);
		}

		readonly #key: K;
		readonly #type: SettingType<T> | DefaultValueSettingType<T>;
		readonly #synced: boolean;
		#defaultValue: undefined | T;

		get key() {
			return this.#key;
		}

		get type() {
			return this.#type;
		}

		get synced() {
			return this.#synced;
		}

		constructor(key: K, type: SettingType<T>, synced: boolean, defaultValue: T);
		constructor(key: K, type: DefaultValueSettingType<T>, synced: boolean);
		constructor(key: K, type: SettingType<T>, synced: boolean, defaultValue?: T) {
			this.#key = key;
			this.#type = type;
			this.#synced = synced;
			this.#defaultValue = defaultValue;
		}

		getDefaultValue(): T {
			const type = this.#type;
			if ("createDefault" in type) {
				this.#defaultValue ??= type.createDefault();
			}

			return this.#defaultValue!;
		}
	}

	export type Entries<V, K extends string> = [preferences.Preference<V, K>, V];
	export type ToEntries<T, K extends string & keyof T = string & keyof T> = { [P in K]: Entries<T[P], P> };

	export interface PreferencesManager<T extends Dict> {
		getPreference<K extends string & keyof T>(key: K): Preference<T[K], K>;

		get(): Promise<T>;
		get<const K extends (string & keyof T)[]>(...keys: K): Promise<Pick<T, K[number]>>;
		
		getEntries(): Promise<ToEntries<T>>;
		getEntries<const K extends (string & keyof T)[]>(...keys: K): Promise<ToEntries<T, K[number]>>;

		set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
		set(values: Partial<T>): Promise<void>;

		watch(): Promise<State<T>>;
		watch<const K extends (string & keyof T)[]>(...keys: K): Promise<State<Pick<T, K[number]>>>;
	}

	interface PreferencesManagerConstructor {
		readonly prototype: PreferencesManager<any>;
		new<const T extends readonly Preference[]>(prefs: T): PreferencesManager<{ [P in T[number]["key"]]: Extract<T[number], Preference<any, P>> extends Preference<infer V, P> ? V : never }>;
	}
	
	export var PreferencesManager: PreferencesManagerConstructor = _PreferencesManager;

	export type ValuesOf<T extends PreferencesManager<any>> = T extends PreferencesManager<infer V> ? V : unknown;
	export type ValueOf<T extends Preference> = T extends Preference<infer V> ? V : unknown;
}

export default preferences;