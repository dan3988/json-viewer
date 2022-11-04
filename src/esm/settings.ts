export namespace settings {
	type SettingKey = string & keyof Settings;
	type GetSettingsResult<K extends SettingKey = SettingKey> = { [P in K]: Settings[P] };
	type SaveType = { [P in keyof Settings]?: Settings[P] };

	function _get(store: chrome.storage.StorageArea, output: any, settings: Setting[]): Promise<void> {
		return new Promise((resolve, reject) => {
			const keys = settings.map(v => v.key);
			store.get(keys, items => {
				console.debug("settings get:", items)
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
	
	function makeSetting<K extends SettingKey>(key: K, type: SettingType<Settings[K]>, defaultValue?: Settings[K], synced?: boolean): Setting<Settings[K]> {
		synced ??= false;
		return { key, type, synced, defaultValue } as any;
	}

	export enum LimitUnit {
		Disabled,
		B,
		KB,
		MB,
		GB
	}

	const list = [
		makeSetting("enabled", Boolean, false),
		makeSetting("limit", Number, 0),
		makeSetting("limitType", Number, LimitUnit.Disabled),
		makeSetting("indentType", Number, 1),
		makeSetting("indentTabs", Boolean, true)
	]

	const map = list.reduce((map, v) => map.set(v.key, v), new Map<string, settings.Setting>());
	
	export function getByteSize(limit: number, unit: LimitUnit): number {
		return unit === LimitUnit.Disabled ? Infinity : limit << (10 * (unit - 1));
	}

	export interface SettingType<T = unknown> {
		readonly name: string;
		(value: any): T;
	}
	
	export interface Setting<T = unknown> {
		readonly key: string;
		readonly type: SettingType<T>;
		readonly synced: boolean;
		readonly defaultValue: undefined | T;
	}

	export interface Settings {
		enabled: boolean;
		limit: number;
		limitType: LimitUnit;
		indentType: number;
		indentTabs: boolean;
	}

	export function getDefault(): GetSettingsResult {
		const bag: any = {};
		for (let setting of list)
			bag[setting.key] = setting.defaultValue;

		return bag;
	}

	export async function get<K extends SettingKey[]>(): Promise<GetSettingsResult>;
	export async function get<K extends SettingKey[]>(...keys: K): Promise<GetSettingsResult<K[number]>>;
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