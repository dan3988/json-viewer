export namespace settings {
	export type SettingsBag<K extends _SettingKey = _SettingKey> = { [P in K]: Settings[P] };
	export type SaveType = { [P in keyof Settings]?: Settings[P] };

	function _get(store: chrome.storage.StorageArea, output: any, settings: Setting[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const keys = settings.map(v => v.key);
			store.get(keys, items => {
				const e = chrome.runtime.lastError;
				if (e)
					return reject(e);
				
				for (const setting of settings) {
					const item = items[setting.key]
					const value = item == null ? setting.defaultValue : setting.type(item);
					output[setting.key] = value;
				}
	
				resolve();
			});
		})
	}
	
	function _set(store: chrome.storage.StorageArea, bag: any): Promise<void> {
		return new Promise((resolve, reject) => {
			store.set(bag, () => {
				const e = chrome.runtime.lastError;
				return e ? reject(e) : resolve();
			});
		})
	}
	
	function makeSetting<K extends string, T>(key: K, type: SettingType<T>, defaultValue?: T, synced?: boolean): NamedSetting<K, T> {
		synced ??= false;
		return { key, type, synced, defaultValue };
	}

	function Integer(v: any) {
		return typeof v === "number" ? Math.trunc(v) : parseInt(v);
	}

	function Enum<const T extends readonly any[]>(...values: T): SettingType<T[number]> {
		return Enum.value.bind(values);
	}

	Enum.value = function EnumImpl<T>(this: readonly T[], value: any) {
		var i = this.indexOf(value);
		return i < 0 ? undefined : this[i];
	}

	function ArrayType<T>(subType: SettingType<T>): SettingType<T[]> {
		return <any>ArrayType.value.bind(subType);
	}

	ArrayType.value = function ArrayTypeImpl<T>(this: SettingType<T>, value: any): T[] {
		return Array.prototype.map.call(value, this) as any;
	}

	function NullableType<T>(v: SettingType<T>): SettingType<T | null> {
		return <any>NullableType.value.bind(v);
	}

	NullableType.value = function NullableTypeImpl<T>(this: SettingType<T>, value: any): T | null {
		return value == null ? null : this(value);
	}

	const settingsList = [
		makeSetting("darkMode", NullableType(Boolean), null),
		makeSetting("mimes", ArrayType(String), ["application/json"]),
		makeSetting("scheme", String, "default"),
		makeSetting("whitelist", ArrayType(String), []),
		makeSetting("blacklist", ArrayType(String), []),
		makeSetting("enabled", Boolean, true),
		makeSetting("indentCount", Integer, 1),
		makeSetting("indentChar", String, "\t"),
		makeSetting("useHistory", Boolean, true),
		makeSetting("menuAlign", Enum("r", "l"), "r"),
		makeSetting("background", String, "")
	] as const;

	type _SettingsList = typeof settingsList[number];
	type _SettingKey = _SettingsList["key"];

	export type Settings = { [P in _SettingKey]: Extract<_SettingsList, NamedSetting<P, any>> extends NamedSetting<P, infer T> ? T : never };

	const settings: Record<string, Setting> = settingsList.reduce((x, y) => Object.defineProperty(x, y.key, { value: y, enumerable: true }), Object.create(null));

	export interface SettingType<T = unknown> {
		(value: any): T;
	}
	
	export interface Setting<T = unknown> {
		readonly key: string;
		readonly type: SettingType<T>;
		readonly synced: boolean;
		readonly defaultValue: undefined | T;
	}

	interface NamedSetting<TKey extends string, TType> extends Setting<TType> {
		readonly key: TKey;
	}

	export function getDefault(): SettingsBag {
		const bag: any = {};
		for (let setting of settingsList)
			bag[setting.key] = setting.defaultValue;

		return bag;
	}

	export interface SettingChange<T = any> {
		oldValue: undefined | T;
		newValue: T;
	}

	export interface SettingChangeEvent {
		changes: { [P in _SettingKey]?: SettingChange<Settings[P]> };
		synced: boolean;
	}

	type ChangeHandler = (arg: SettingChangeEvent) => any;

	export function addListener(handler: ChangeHandler, type?: "both" | "sync" | "local") {
		let [sync, local] = type == null || type === "both" ? [true, true] : [type === "sync", type === "local"];
		if (local)
			chrome.storage.local.onChanged.addListener((changes) => handler({ changes, synced: false }));

		if (sync)
			chrome.storage.sync.onChanged.addListener((changes) => handler({ changes, synced: true }));
	}

	export function getSetting<K extends _SettingKey>(key: K, required: true): Setting<Settings[K]>
	export function getSetting<K extends _SettingKey>(key: K, required?: false): undefined | Setting<Settings[K]>
	export function getSetting<K extends _SettingKey>(key: K, required?: boolean): undefined | Setting {
		const setting = settings[key];
		if (setting == null && required)
			throw new TypeError(`Unknown setting: '${key}'`);
		
		return setting;
	}

	export async function get<K extends _SettingKey[]>(): Promise<SettingsBag>;
	export async function get<K extends _SettingKey[]>(...keys: K): Promise<SettingsBag<K[number]>>;
	export async function get(...keys: string[]) {
		let local: Setting[] = [];
		let synced: Setting[] = [];
		for (const key of keys.length ? keys : Object.keys(settings)) {
			const setting = settings[key];
			if (setting == null)
				throw new TypeError(`Unknown setting: '${key}'`);

			(setting.synced ? synced : local).push(setting);
		}

		const output: any = {};

		if (local.length)
			await _get(chrome.storage.local, output, local);
		
		if (synced.length)
			await _get(chrome.storage.sync, output, synced);

		return output;
	}

	export function setValue<K extends _SettingKey>(key: K, value: Settings[K]) {
		const setting = settings[key];
		if (setting == null)
			throw new TypeError(`Unknown setting: '${key}'`);

		const store = chrome.storage[setting.synced ? "sync" : "local"];
		const v = setting.type(value);
		return _set(store, { [setting.key]: v });
	}

	export async function setValues(values: SaveType): Promise<void> {
		let local: any = {};
		let synced: any = {};
		let hasLocal = false;
		let hasSynced = false;

		for (const key in values) {
			const setting = settings[key];
			if (setting == null)
				throw new TypeError(`Unknown setting: '${key}'`);

			let value = (values as any)[key];
			if (value != null)
				value = setting.type(value);

			if (setting.synced) {
				hasSynced = true;
				synced[setting.key] = value;
			} else {
				hasLocal = true;
				local[setting.key] = value;
			}
		}

		if (hasLocal)
			await _set(chrome.storage.local, local);

		if (hasSynced)
			await _set(chrome.storage.sync, synced);
	}
}

export default settings;