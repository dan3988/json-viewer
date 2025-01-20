import { State, StateController } from "./state.js";
import ImmutableArray from "./immutable-array.js";

const _PreferencesManager = class PreferencesManager<T extends Dict> implements preferences.core.PreferencesManager<T> {
	readonly #prefs: Map<string, preferences.core.Preference>;

	constructor(prefs: readonly preferences.core.Preference[]) {
		this.#prefs = new Map();

		for (const pref of prefs)
			this.#prefs.set(pref.key, pref);
	}

	getPreference<K extends string & keyof T>(key: K): preferences.core.Preference<T[K], K> {
		const pref = this.#prefs.get(key);
		if (pref == null)
			throw new TypeError(`Unknown setting: '${key}'`);

		return pref as any;
	}

	async #get(prefs: preferences.core.Preference[], entries = false): Promise<Dict> {
		const keys = prefs.map(v => v.key);
		const values = await chrome.storage.local.get(keys);

		for (const pref of prefs) {
			const { key, type } = pref;
			const value = key in values ? type.deserialize(values[key]) : pref.getDefaultValue();
			values[key] = entries ? [pref, value] : value;
		}
		
		return values;
	}

	#getPreferences(keys: readonly string[]) {
		return keys.length ? keys.map(this.getPreference, this) : Array.from(this.#prefs.values());
	}

	get(): Promise<T>;
	get<const K extends (string & keyof T)[]>(...keys: K): Promise<Pick<T, K[number]>>;
	get(...keys: string[]): Promise<Dict> {
		const prefs = this.#getPreferences(keys);
		return this.#get(prefs);
	}

	getEntries(): Promise<preferences.core.ToEntries<T>>;
	getEntries<const K extends (string & keyof T)[]>(...keys: K): Promise<preferences.core.ToEntries<T, K[number]>>;
	getEntries(...keys: string[]): Promise<Dict> {
		const prefs = this.#getPreferences(keys);
		return this.#get(prefs, true);
	}

	set<K extends keyof T>(key: K, value: T[K]): Promise<void>;
	set(values: Partial<T>): Promise<void>;
	set(arg0: string | Dict, arg1?: any): Promise<void> {
		if (typeof arg0 === "string") {
			const pref = this.getPreference(arg0);
			return chrome.storage.local.set({ [arg0]: pref.type.serialize(arg1) });
		} else {
			const keys = Object.keys(arg0);
			if (keys.length === 0)
				return Promise.resolve();

			let bag: Dict = {};

			for (const key in arg0) {
				const pref = this.getPreference(key);
				bag[key] = pref.type.serialize(arg0[key]);
			}

			return chrome.storage.local.set(bag);
		}
	}

	watch(): Promise<State<T>>;
	watch<const K extends (string & keyof T)[]>(...keys: K): Promise<State<Pick<T, K[number]>>>;
	async watch(...keys: string[]): Promise<State<any>> {
		const prefs = this.#getPreferences(keys);
		const values = await this.#get(prefs);
		const controller = new StateController(values);
		const onChange = (changes: Dict<chrome.storage.StorageChange>) =>{
			let count = 0;
			let values: any = {};
	
			for (const key in changes) {
				if (controller.keys.has(key)) {
					const pref = this.#prefs.get(key)!;
					const { newValue } = changes[key];
					const existing = controller.getValue(key);
					const value = newValue === undefined ? pref.getDefaultValue() : pref.type.deserialize(newValue);
					if (!pref.type.areSame(existing, value)) {
						values[key] = value;
						count++;
					}
				}
			}
	
			if (count)
				controller.setValues(values);
		}

		chrome.storage.local.onChanged.addListener(onChange);
		return controller.state;
	}
}

export namespace preferences {
	export namespace core {
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
			let scopePath: undefined | (string | number)[];

			function scoped<TKey extends string | number, TResult>(operation: string, path: TKey, work: (key: TKey) => TResult): TResult {
				if (scopePath) {
					scopePath.push(path);
					const result = work(path);
					scopePath.pop();
					return result;
				}

				try {
					scopePath = [];
					return work(path);
				} catch (cause) {
					const path = scopePath!.join('.');
					throw new TypeError(`Error perfoming ${operation} at '${path}'`, { cause });
				} finally {
					scopePath = undefined;
				}
			}

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

			export type Primitives = { [P in keyof typeof primitives]: typeof primitives[P] extends SettingType<infer V> ? V : never };

			type PrimitiveKey<T> = { [P in keyof Primitives]: T extends Primitives[P] ? P : never }[keyof Primitives];

			export type SettingTypeInit<T = any> = SettingType<T> | PrimitiveKey<T>;
			export type SettingTypeOf<T extends SettingTypeInit> = T extends keyof Primitives ? Primitives[T] : (T extends SettingType<infer V> ? V : unknown);

			function toType(value: SettingTypeInit<any>) {
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

			export function enumeration<T extends SettingTypeInit, const E extends SettingTypeOf<T>[]>(underlyingType: T, values: E, defaultValue: E[number]): SettingType<E[number]> {
				return new EnumerationSettingType(toType(underlyingType), values, defaultValue);
			}

			class ListSettingType<T> extends BaseSettingType<ImmutableArray<T>> {
				constructor(readonly underlyingType: SettingType<T>) {
					super(`List<${underlyingType.name}>`);
				}

				serialize(value: ImmutableArray<T>) {
					const result: any[] = [];
					for (let i = 0; i < value.length; i++)
						result[i] = scoped('serialize', i, i => value[i]);

					return result;
				}

				deserialize(value: any): ImmutableArray<T> {
					const type = this.underlyingType;
					return ImmutableArray.from(value, (v, i) => scoped('deserialize', i, () => type.deserialize(v)));
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

			export function list<T extends SettingTypeInit>(underlyingType: T): SettingType<ImmutableArray<SettingTypeOf<T>>> {
				return new ListSettingType(toType(underlyingType));
			}

			class DictionarySettingType<T> extends BaseSettingType<Dict<T>> {
				constructor(readonly valueType: SettingType<T>) {
					super(`Dictionary<${valueType.name}>`);
				}

				serialize(value: Dict<T>) {
					const result: Dict<T> = {};
					for (const key in value)
						result[key] = scoped('serialize', key, k => this.valueType.serialize(value[k]));

					return result;
				}

				deserialize(value: any): Dict<T> {
					const result: Dict<T> = Object.create(null);
					for (const key in value)
						result[key] = scoped('deserialize', key, k => this.valueType.deserialize(value[k]));
		
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

			export function dictionary<T extends SettingTypeInit>(valueType: T): SettingType<Dict<SettingTypeOf<T>>> {
				return new DictionarySettingType(toType(valueType));
			}

			type ObjectSettingValue<T extends {}, O extends keyof T = never> = { [P in Exclude<keyof T, O>]: T[P] } & { [P in O]?: T[P] };
 
			class ObjectSettingType<T extends {}, R extends keyof T> extends BaseSettingType<ObjectSettingValue<T, R>> {
				readonly optional: ReadonlySet<string>;

				constructor(readonly schema: { [P in keyof T]: SettingType<T[P]> }, optional: Iterable<string> = []) {
					super('Object');
					this.optional = new Set(optional);
				}

				serialize(value: T) {
					const result: any = {};
					for (const key in this.schema)
						if (key in value)
							result[key] = scoped('serialize', key, k => this.schema[k].serialize(value[k]));

					return result;
				}

				deserialize(value: any): T {
					const result: any = {};
					for (const key in this.schema) {
						const v = value[key];
						if (v !== undefined) {
							result[key] = scoped('deserialize', key, k => this.schema[k].deserialize(value[k]));
						} else if (this.optional.has(key)) {
							result[key] = undefined;
						} else {
							throw new TypeError(`Required key "${key}" not found in value.`);
						}
					}

					return result;
				}

				areSame(x: T, y: T): boolean {
					for (const key in this.schema)
						if (key in x ? !(key in y && this.schema[key].areSame(x[key], y[key])) : key in y)
							return false;

					return true;
				}
			}

			export function object<T extends {}>(schema: { [P in keyof T]: SettingType<T[P]> }): SettingType<ObjectSettingValue<T>>;
			export function object<T extends {}, const K extends keyof T>(schema: { [P in keyof T]: SettingType<T[P]> }, optional: Iterable<K>): SettingType<ObjectSettingValue<T, K>>;
			export function object(schema: Dict<SettingType>, optional?: Iterable<string>): SettingType {
				return new ObjectSettingType(schema, optional);
			}

			type TupleSchema<T extends ImmutableArray> = readonly SettingType[] & { [P in number & keyof T]: SettingType<T[P]> };

			class TupleSettingType<const T extends ImmutableArray> extends BaseSettingType<T> {
				constructor(readonly schema: TupleSchema<T>) {
					super('Tuple');
				}

				serialize(value: T) {
					const result: any[] = [];
					for (let i = 0; i < this.schema.length; i++) {
						const v = scoped('serialize', i, i => this.schema[i].serialize(value[i]));
						result.push(v);
					}

					return result as any;
				}

				deserialize(value: any): T {
					const result: any[] = [];
					for (let i = 0; i < this.schema.length; i++) {
						const v = scoped('deserialize', i, i => this.schema[i].deserialize(value[i]));
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

			export function nullable<T extends SettingTypeInit>(underlyingType: T): SettingType<null | SettingTypeOf<T>> {
				return new NullableSettingType(toType(underlyingType));
			}

			export type ValueOf<T extends SettingType> = T extends SettingType<infer V> ? V : unknown;
		}

		export class Preference<T = any, K extends string = string> {
			static int<K extends string>(key: K, defaultValue: number): Preference<number, K> {
				return new Preference(key, types.int, defaultValue);
			}

			static number<K extends string>(key: K, defaultValue: number): Preference<number, K> {
				return new Preference(key, types.number, defaultValue);
			}

			static boolean<K extends string>(key: K, defaultValue: boolean): Preference<boolean, K> {
				return new Preference(key, types.bool, defaultValue);
			}

			static string<K extends string>(key: K, defaultValue: string): Preference<string, K> {
				return new Preference(key, types.string, defaultValue);
			}

			static list<K extends string, T extends types.SettingTypeInit>(key: K, underlyingType: T, defaultValue: types.SettingTypeOf<T>[] = []): Preference<ImmutableArray<types.SettingTypeOf<T>>, K> {
				return new Preference(key, types.list(underlyingType), ImmutableArray.from(defaultValue));
			}

			static enum<K extends string, T extends types.SettingTypeInit, const E extends types.SettingTypeOf<T>[]>(key: K, underlyingType: T, values: E, defaultValue: E[number]): Preference<E[number], K> {
				return new Preference(key, types.enumeration(underlyingType, values, defaultValue), defaultValue);
			}

			static nullable<K extends string, T extends types.SettingTypeInit>(key: K, underlyingType: T, defaultValue?: null | types.SettingTypeOf<T>): Preference<null | types.SettingTypeOf<T>, K> {
				return new Preference(key, types.nullable(underlyingType), defaultValue ?? null);
			}

			static dictionary<K extends string, T extends types.SettingTypeInit>(key: K, underlyingType: T, defaultValue: Dict<types.SettingTypeOf<T>> = {}): Preference<Dict<types.SettingTypeOf<T>>, K> {
				return new Preference(key, types.dictionary(underlyingType), defaultValue);
			}

			readonly #key: K;
			readonly #type: SettingType<T> | DefaultValueSettingType<T>;
			#defaultValue: undefined | T;

			get key() {
				return this.#key;
			}

			get type() {
				return this.#type;
			}

			constructor(key: K, type: SettingType<T>, defaultValue: T);
			constructor(key: K, type: DefaultValueSettingType<T>);
			constructor(key: K, type: SettingType<T>, defaultValue?: T) {
				this.#key = key;
				this.#type = type;
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

		export type Entries<V, K extends string> = [Preference<V, K>, V];
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
}

export default preferences;