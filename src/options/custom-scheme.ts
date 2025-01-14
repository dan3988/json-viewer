import Store, { type IStoreController } from "../store";
import Color from "color";
import schemes from "../schemes";
import { WritableStore, WritableStoreImpl } from "../store";

type SchemeColorKey = 'key' | 'keyword' | 'str' | 'num' | 'text' | 'background';
type SetColorKey = 'text' | 'background' | 'border';
type SetColorMode = 'def' | 'act' | 'hov';

type SchemeKey = 'light' | 'dark';
type SchemeSetKey = 'primary' | 'tertiary';

type ColorStore = WritableStore<Color<any>>;

export class CustomScheme {
	readonly #scheme: IStoreController<schemes.ColorScheme>;
	readonly #name: WritableStore<string>;

	#light: null | CustomSchemeValues;
	#dark: null | CustomSchemeValues;

	get scheme() {
		return this.#scheme.store;
	}

	get name() {
		return this.#name;
	}

	get light() {
		return this.#light;
	}

	get dark() {
		return this.#dark;
	}

	constructor(value: schemes.ColorScheme) {
		this.#scheme = Store.controller(value);
		this.#name = new WritableStoreImpl(value.name);
		this.#name.listen(this.#updateName.bind(this));
		this.#light = value.light ? this.#createValues(false, value.light) : null;
		this.#dark = value.dark ? this.#createValues(true, value.dark) : null;
	}

	getValues(darkMode: boolean) {
		if (darkMode) {
			return this.#dark ??= this.#createValues(true, this.#scheme.value.light!);
		} else {
			return this.#light ??= this.#createValues(false, this.#scheme.value.dark!);
		}
	}

	#updateName(name: string) {
		this.#scheme.update(v => {
			const { light, dark } = v;
			return { name, light, dark };
		});
	}

	#update(darkMode: boolean, updater: (v: schemes.ColorSchemeValues) => void) {
		this.#scheme.update(v => {
			const { name, light, dark } = v;
			const copy = { name, light, dark };
			const [key, other] = darkMode ? ['dark', 'light'] : ['light', 'dark'];
			const values = structuredClone(v[key] ?? v[other]!);
			copy[key] = values;
			updater(values);
			return copy;
		});
	}

	#createValues(darkMode: boolean, values: schemes.ColorSchemeValues) {
		const key = this.#rootColorStore(darkMode, values, 'key');
		const keyword = this.#rootColorStore(darkMode, values, 'keyword');
		const str = this.#rootColorStore(darkMode, values, 'str');
		const num = this.#rootColorStore(darkMode, values, 'num');
		const text = this.#rootColorStore(darkMode, values, 'text');
		const background = this.#rootColorStore(darkMode, values, 'background');
		const primary = this.#createSet(values, darkMode, 'primary', text);
		const tertiary = this.#createSet(values, darkMode, 'tertiary', text);
		const indents = Store.controller(Array.from(values.indents, v => Color(v)));
		indents.listen(value => this.#update(darkMode, v => v.indents = Array.from(value, v => v.hex())));
		return { key, keyword, str, num, text, background, primary, tertiary, indents };
	}

	#rootColorStore(darkMode: boolean, values: schemes.ColorSchemeValues, key: SchemeColorKey) {
		const value = values[key];
		const color = Color(value);
		const store = new WritableStoreImpl(color);
		store.listen(v => this.#update(darkMode, obj => obj[key] = v.hex()));
		return store;
	}

	#createSet(values: schemes.ColorSchemeValues, darkMode: boolean, set: SchemeSetKey, rootText: ColorStore) {
		const background = (() => {
			const init = values[set].background;

			function handler(this: CustomScheme, mode: SetColorMode, value: Color) {
				this.#update(darkMode, v => v[set].background[mode] = value.hex());
			}

			const def = new WritableStoreImpl(Color(init.def));
			def.listen(handler.bind(this, 'def'));
			const act = new WritableStoreImpl(Color(init.act));
			act.listen(handler.bind(this, 'act'));
			const hov = new WritableStoreImpl(Color(init.hov));
			hov.listen(handler.bind(this, 'hov'));

			return { def, hov, act };
		})();

		const border = this.#createTogglebleSetColors(darkMode, values, set, 'border', background.def, background.act, background.hov);
		const text = this.#createTogglebleSetColors(darkMode, values, set, 'text', rootText);
		return { background, border, text };
	}

	#createTogglebleSetColors(darkMode: boolean, values: schemes.ColorSchemeValues, set: SchemeSetKey, prop: 'border' | 'text', fallbackDef: ColorStore, fallbackAct?: ColorStore, fallbackHov?: ColorStore) {
		const init = values[set][prop];
		const active = new WritableStoreImpl(!!init);

		active.listen(v => {
			if (v) {
				this.#update(darkMode, v => v[set][prop] = {
					def: def.value.hex(),
					act: act.value.hex(),
					hov: hov.value.hex()
				});
			} else {
				this.#update(darkMode, v => v[set][prop] = null);
			}
		});

		let def: ColorStore;
		let act: ColorStore;
		let hov: ColorStore;
		if (init) {
			def = new WritableStoreImpl(Color(init.def));
			act = init.act ? new WritableStoreImpl(Color(init.act)) : Store.rewritable(def);
			hov = init.hov ? new WritableStoreImpl(Color(init.hov)) : Store.rewritable(def);
		} else {
			def = Store.rewritable(fallbackDef);
			act = Store.rewritable(fallbackAct ?? def);
			hov = Store.rewritable(fallbackHov ?? def);
		}

		function handler(this: CustomScheme, mode: SetColorMode, value: Color) {
			active.value && this.#update(darkMode, v => v[set][prop]![mode] = value.hex());
		}

		def.listen(handler.bind(this, 'def'));
		act.listen(handler.bind(this, 'act'));
		hov.listen(handler.bind(this, 'hov'));

		return { def, act, hov, active };
	}
}

export interface CustomSchemeColorSet {
	readonly background: SetColors;
	readonly border: TogglebleSetColors;
	readonly text: TogglebleSetColors;
}

export interface SetColors {
	readonly def: ColorStore;
	readonly hov: ColorStore;
	readonly act: ColorStore;
}

export interface TogglebleSetColors extends SetColors {
	readonly active: WritableStore<boolean>;
}

export interface CustomSchemeValues {
	readonly key: ColorStore;
	readonly keyword: ColorStore;
	readonly str: ColorStore;
	readonly num: ColorStore;
	readonly text: ColorStore;
	readonly background: ColorStore;
	readonly primary: CustomSchemeColorSet;
	readonly tertiary: CustomSchemeColorSet;
	readonly indents: WritableStore<Color[]>;
}
