import p from '../src/preferences-core.js';

describe('Preferences', () => {
	it('Should fire an event when changing a value', async () => {
		const prefs = [
			p.core.Preference.string('string', ''),
			p.core.Preference.number('number', 0),
			p.core.Preference.boolean('boolean', false),
			p.core.Preference.nullable('nullable', 'string'),
		];

		const storage = createLocalStorage();
		const manager = new p.core.PreferencesManager(prefs);
		const values = await manager.watch();

		const firedByOnChange = new Map<string, number>();
		const firedByListen = new Map<string, number>();

		values.onChange((changes) => {
			for (const key in changes)
				increment(firedByOnChange, key);
		});

		for (const key of values.keys)
			values.props[key].listen(() => increment(firedByListen, key));

		let changes = {
			string: 'test',
			number: 5,
			boolean: true,
			nullable: 'not null'
		};

		storage.set(changes);

		for (const { key } of prefs) {
			assert.equal(values.getValue(key), changes[key], `Expected getValue to return updated value of "${key}"`);
			assert.equal(values.props[key].value, changes[key], `Expected entry value to match updated value of "${key}"`);
			assert.equal(firedByOnChange.get(key), 1, `Expected onChange to fire for "${key}" when its value is changed`);
			assert.equal(firedByListen.get(key), 1, `Expected listen to fire for "${key}" when its value is changed`);
		}
		
		storage.set({
			string: 'test',
			number: 5,
			boolean: true,
			nullable: 'not null'
		});

		for (const { key } of prefs) {
			assert.equal(values.getValue(key), changes[key], `Expected getValue to return updated value of "${key}"`);
			assert.equal(values.props[key].value, changes[key], `Expected entry value to match updated value of "${key}"`);
			assert.equal(firedByOnChange.get(key), 1, `Expected onChange not to fire for "${key}" when its value is chagned to an equivelant value`);
			assert.equal(firedByListen.get(key), 1, `Expected listen not to fire for "${key}" when its value is chagned to an equivelant value`);
		}

		storage.clear();

		for (const pref of prefs) {
			const { key } = pref;
			assert.equal(values.getValue(key), pref.getDefaultValue(), `Expected getValue to return default value of "${key}"`);
			assert.equal(values.props[key].value, pref.getDefaultValue(), `Expected entry value to match default value of "${key}"`);
			assert.equal(firedByOnChange.get(key), 2, `Expected onChange to fire for "${key}" when its value is cleared`);
			assert.equal(firedByListen.get(key), 2, `Expected listen to fire for "${key}" when its value is cleared`);
		}
	});

	it('Should handle lists', async () => {
		const pref = p.core.Preference.list('value', 'string');
		const storage = createLocalStorage();
		const manager = new p.core.PreferencesManager([pref]);
		const values = await manager.watch();

		let firedByOnChange = 0;
		let firedByListen = 0;

		values.props.value.listen(() => firedByListen++);
		values.onChange((changes) => {
			assert.deepStrictEqual(Object.keys(changes), [pref.key]);
			firedByOnChange++;
		});

		storage.set({ value: [] });
		assert.deepStrictEqual(values.getValue('value'), [], `Expected initial value to be default value`);
		assert.equal(firedByOnChange, 0, `Expected onChange not to fire when changing to default value`);
		assert.equal(firedByListen, 0, `Expected listen not to fire when changing to default value`);

		storage.set({ value: ['a', 'b', 'c', 'd'] });
		assert.deepStrictEqual(values.getValue('value'), ['a', 'b', 'c', 'd'], `Expected value to match updated value`);
		assert.equal(firedByOnChange, 1, `Expected onChange to fire when changing value`);
		assert.equal(firedByListen, 1, `Expected listen to fire when changing value`);

		storage.set({ value: ['a', 'b', 'c', 'd'] });
		assert.equal(firedByOnChange, 1, `Expected onChange to fire when changing to an equivelant value`);
		assert.equal(firedByListen, 1, `Expected listen to fire when changing to an equivelant value`);

		storage.set({ value: ['a', 'b', 'c'] });
		assert.deepStrictEqual(values.getValue('value'), ['a', 'b', 'c'], `Expected value to match updated value`);
		assert.equal(firedByOnChange, 2, `Expected onChange to fire when changing value`);
		assert.equal(firedByListen, 2, `Expected listen to fire when changing value`);

		storage.clear();
		assert.deepStrictEqual(values.getValue('value'), [], `Expected value to match default value after clearing`);
		assert.equal(firedByOnChange, 3, `Expected onChange to fire when clearing value`);
		assert.equal(firedByListen, 3, `Expected listen to fire when clearing value`);
	});

	it('Should handle objects', async () => {
		const person = p.core.types.object(
			{
				firstName: p.core.types.string,
				lastName: p.core.types.string,
				age: p.core.types.int,
				address: p.core.types.object(
					{
						zipCode: p.core.types.string,
						city: p.core.types.string,
						line1: p.core.types.string,
						line2: p.core.types.string,
						line3: p.core.types.string,
					},
					['line2', 'line3']
				)
			}
		);

		type Person = p.core.types.ValueOf<typeof person>;

		const defaultValue: Person = {
			firstName: 'Joe',
			lastName: 'Bloggs',
			age: 50,
			address: {
				city: 'London',
				zipCode: 'SW1A 1AA',
				line1: 'Buckingham Palace',
				line2: undefined,
				line3: undefined
			}
		};

		const pref = new p.core.Preference('value', person, structuredClone(defaultValue));
		const storage = createLocalStorage();
		const manager = new p.core.PreferencesManager([pref]);
		const values = await manager.watch();

		let firedByOnChange = 0;
		let firedByListen = 0;

		values.props.value.listen(() => firedByListen++);
		values.onChange((changes) => {
			assert.deepStrictEqual(Object.keys(changes), [pref.key]);
			firedByOnChange++;
		});

		let value = defaultValue;
		storage.set({ value });
		assert.deepStrictEqual(values.getValue('value'), defaultValue, `Expected initial value to be default value`);
		assert.equal(firedByOnChange, 0, `Expected onChange not to fire when changing to default value`);
		assert.equal(firedByListen, 0, `Expected listen not to fire when changing to default value`);

		value = {
			firstName: 'Joe',
			lastName: 'Bloggs',
			age: 55,
			address: {
				city: 'London',
				zipCode: 'SW1A 2AA',
				line1: '10 Downing Street',
				line2: 'Westminster',
				line3: undefined
			}
		}

		storage.set({ value });
		assert.notEqual(values.getValue('value'), value, `Expected value to not be same object`);
		assert.deepStrictEqual(values.getValue('value'), value, `Expected getValue to return updated value`);
		assert.equal(firedByOnChange, 1, `Expected onChange to fire when changing value`);
		assert.equal(firedByListen, 1, `Expected listen to fire when changing value`);
	});
})

function increment<K>(map: Map<K, number>, key: K) {
	const v = (map.get(key) ?? 0) + 1;
	map.set(key, v);
	return v;
}

interface Promisified<A extends any[], R> {
	(...args: A): Promise<R>;
	(...args: [...A, callback: R extends void ? (a?: void) => void : (a: R) => void]): void;
}

type Unpromisify<F> = F extends Promisified<infer A, infer R>? (...args: A) => R : F;

type UnpromisifyObj<T> = { [P in keyof T]: Unpromisify<T[P]> };

type StorageArea = UnpromisifyObj<chrome.storage.LocalStorageArea>;
type StorageChangeDict = Dict<chrome.storage.StorageChange>;
type StorageChangeEvent = (changes: StorageChangeDict) => void;

function notSupported(): never {
	throw new TypeError('Not supported');
}

function promisify<T extends Function>(func: Unpromisify<T>): T {
	return <any>function(...args) {
		const last = args.at(-1);
		const result =  func.apply(this, args);
		if (typeof last === "function") {
			last(result);
		} else {
			return Promise.resolve(result);
		}
	}
}

function promisifyObj<T>(target: UnpromisifyObj<T>): T {
	const result: any = {};
	for (let [key, value] of Object.entries(target)) {
		if (typeof value === "function")
			value = promisify(value);

		result[key] = value;
	}

	return result;
}

function createLocalStorage(): StorageArea {
	const listeners: StorageChangeEvent[] = [];
	const storage = new Map<string, any>();

	function mutate(handler: (changes: StorageChangeDict) => void) {
		const changes: StorageChangeDict = {};
		handler(changes);
		if (Object.keys(changes).length)
			for (const listener of listeners)
				listener(changes);
	}

	const instance: StorageArea = {
		QUOTA_BYTES: Infinity,
		onChanged: {
			addListener(callback) {
				listeners.push(callback);
			},
			removeListener(callback) {
				const index = listeners.indexOf(callback);
				index < 0 || listeners.splice(index, 1);
			},
			getRules: notSupported,
			addRules: notSupported,
			removeRules: notSupported,
			hasListener: notSupported,
			hasListeners: notSupported
		},
		getBytesInUse: notSupported,
		setAccessLevel: notSupported,
		clear() {
			mutate(changes => {
				for (const [key, oldValue] of storage.entries())
					changes[key] = { oldValue };

				storage.clear();
			});
		},
		get(keys) {
			const results: Dict = {};
			if (typeof keys === "string") {
				if (storage.has(keys))
					results[keys] = storage.get(keys);

				return results;
			}

			if (keys == null) {
				keys = storage.keys();
			} else if (!Array.isArray(keys)) {
				Object.assign(results, keys);
				keys = Object.keys(keys);
			}

			for (const key in keys)
				if (storage.has(key))
					results[key] = storage.get(key);

			return results;
		},
		remove(keys) {
			mutate(changes => {
				for (const key of keys) {
					const oldValue = storage.get(key);
					if (storage.delete(key))
						changes[key] = { oldValue }
				}
			});
		},
		set(items) {
			mutate(changes => {
				for (const key in items) {
					const oldValue = storage.get(key);
					const newValue = items[key];
					storage.set(key, newValue);
					changes[key] = { oldValue, newValue };
				}
			});
		},
	};

	globalThis.chrome ??= <any>{};
	globalThis.chrome.storage ??= <any>{};
	globalThis.chrome.storage.local = promisifyObj(instance);
	return instance;
}
