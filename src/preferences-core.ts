import { ImmutableArray } from "./immutable-array.js";
import { State, StateController } from "./state.js";

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

	#getPref(key: string) {
		const pref = this.#prefs.get(key);
		if (pref == null)
			throw new TypeError(`Unknown setting: '${key}'`);

		return pref;
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
			const value = key in results ? type(results[key]) : pref.getDefaultValue();
			output[key] = entries ? [pref, value] : value;
		}
		
		return [output, watching];
	}

	#getPreferences(keys: readonly string[]) {
		return keys.length ? keys.map(this.#getPref, this) : Array.from(this.#prefs.values());
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
			const pref = this.#getPref(arg0);
			const store = chrome.storage[pref.synced ? "sync" : "local"];
			if (pref.type.serialize)
				arg1 = pref.type.serialize(arg1);

			await store.set({ [arg0]: arg1 });
		} else {
			let local: undefined | Dict;
			let sync: undefined | Dict;

			for (const key in arg0) {
				const pref = this.#getPref(key);
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
					values[key] = pref.type(changes[key].newValue);
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
		(value: any): T;
		serialize?(value: T): any;
		areSame(x: T, y: T): boolean;
	}

	export interface DefaultValueSettingType<T> extends SettingType<T> {
		createDefault(): T;
	}

	export namespace types {
		const strictEquals = (x: any, y: any) => x === y;

		export const bool: SettingType<boolean> = (v) => Boolean(v);
		bool.areSame = strictEquals;

		export const int: SettingType<number> = (v) => Number(v);
		int.areSame = strictEquals;

		export const number: SettingType<number> = (v) => Number(v);
		number.areSame = strictEquals;

		export const string: SettingType<string> = (v) => String(v);
		string.areSame = strictEquals;

		export function enumeration<T, const E extends T[]>(underlyingType: SettingType<T>, values: E, defaultValue: E[number]) {
			const impl: SettingType<E[number]> = (value: any) => {
				var i = values.indexOf(value);
				return i < 0 ? defaultValue : values[i];
			};

			impl.areSame = underlyingType.areSame;
			return impl;
		}

		export function list<T>(underlyingType: SettingType<T>) {
			const impl: SettingType<ImmutableArray<T>> = (value: any) => ImmutableArray.from(value, underlyingType);
			impl.areSame = (x, y) => {
				if (x.length !== y.length)
					return false;

				for (let i = 0; i < x.length; i++)
					if (!underlyingType.areSame(x[i], y[i]))
						return false;

				return true;
			};

			impl.serialize = (v) => v.toJSON();

			return impl;
		}

		export function nullable<T>(underlyingType: SettingType<T>) {
			const impl: SettingType<T | null> = (value: any) => value == null ? null : underlyingType(value);
			impl.areSame = strictEquals;
			return impl;
		}
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

		static list<K extends string, T>(key: K, underlyingType: SettingType<T>, synced: boolean, defaultValue: T[] | ImmutableArray<T>): Preference<ImmutableArray<T>, K> {
			return new Preference(key, types.list(underlyingType), synced, ImmutableArray.from(defaultValue));
		}

		static enum<K extends string, T, const E extends T[]>(key: K, underlyingType: SettingType<T>, values: E, synced: boolean, defaultValue: E[number]): Preference<E[number], K> {
			return new Preference(key, types.enumeration(underlyingType, values, defaultValue), synced, defaultValue);
		}

		static nullable<K extends string, T>(key: K, underlyingType: SettingType<T>, synced: boolean, defaultValue?: null | T): Preference<T | null, K> {
			return new Preference(key, types.nullable(underlyingType), synced, defaultValue ?? null);
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
}

export default preferences;