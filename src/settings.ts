export namespace settings {
	export type SettingsBag<K extends SettingKey = SettingKey> = { [P in K]: Settings[P] };
	export type SaveType = { [P in keyof Settings]?: Settings[P] };

	type SettingKey = string & keyof Settings;

	function _get(store: chrome.storage.StorageArea, output: any, settings: Setting[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const keys = settings.map(v => v.key);
			store.get(keys, items => {
				console.debug("settings get:", items);
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
		console.debug("settings set:", bag);
		return new Promise((resolve, reject) => {
			store.set(bag, () => {
				const e = chrome.runtime.lastError;
				return e ? reject(e) : resolve();
			});
		})
	}
	
	function makeSetting<K extends SettingKey>(key: K, type: SettingType<Settings[K]>, defaultValue?: Settings[K], synced?: boolean): Setting<Settings[K]> {
		synced ??= false;
		return { key, type, synced, defaultValue } as any;
	}

	function Integer(v: any) {
		return typeof v === "number" ? Math.trunc(v) : parseInt(v);
	}

	function ArrayType(v: any) {
		return Array.isArray(v) ? v : [...v];
	}

	function NullableType<T>(v: SettingType<T>): SettingType<T | null> {
		return <any>NullableType.value.bind(v);
	}

	NullableType.value = function<T>(this: SettingType<T>, value: any): T | null {
		return value == null ? null : this(value);
	}

	const list = [
		makeSetting("darkMode", NullableType(Boolean), null),
		makeSetting("mimes", ArrayType, ["application/json"]),
		makeSetting("jsonStyle", String, "default"),
		makeSetting("whitelist", ArrayType, []),
		makeSetting("blacklist", ArrayType, []),
		makeSetting("enabled", Boolean, true),
		makeSetting("indentCount", Integer, 1),
		makeSetting("indentChar", String, "\t"),
		makeSetting("indentStyle", String, "default")
	]

	const map = list.reduce((map, v) => map.set(v.key, v), new Map<string, settings.Setting>());

	export interface SettingType<T = unknown> {
		(value: any): T;
	}
	
	export interface Setting<T = unknown> {
		readonly key: string;
		readonly type: SettingType<T>;
		readonly synced: boolean;
		readonly defaultValue: undefined | T;
	}

	export interface Settings {
		darkMode: null | boolean;
		mimes: string[];
		whitelist: string[];
		blacklist: string[];
		enabled: boolean;
		indentCount: number;
		indentChar: string;
		indentStyle: string;
		jsonStyle: string;
	}

	export function getDefault(): SettingsBag {
		const bag: any = {};
		for (let setting of list)
			bag[setting.key] = setting.defaultValue;

		return bag;
	}

	export interface SettingChange<T = any> {
		oldValue: undefined | T;
		newValue: T;
	}

	export interface SettingChangeEvent {
		changes: { [P in SettingKey]?: SettingChange<Settings[P]> };
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

	export function getSetting<K extends keyof Settings>(key: K, required: true): Setting<Settings[K]>
	export function getSetting<K extends keyof Settings>(key: K, required?: false): undefined | Setting<Settings[K]>
	export function getSetting<K extends keyof Settings>(key: K, required?: boolean): undefined | Setting {
		const setting = map.get(key);
		if (setting == null && required)
			throw new TypeError(`Unknown setting: '${key}'`);
		
		return setting;
	}

	export async function get<K extends SettingKey[]>(): Promise<SettingsBag>;
	export async function get<K extends SettingKey[]>(...keys: K): Promise<SettingsBag<K[number]>>;
	export async function get(...keys: string[]) {
		let local: Setting[] = [];
		let synced: Setting[] = [];
		for (const key of keys.length ? keys : map.keys()) {
			const setting = map.get(key);
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

	export function setValue<K extends SettingKey>(key: K, value: Settings[K]) {
		const setting = map.get(key);
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
			const setting = map.get(key);
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