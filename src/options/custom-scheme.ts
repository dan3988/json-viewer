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

	readonly name: WritableStore<string>;
	readonly key: ColorStore;
	readonly keyword: ColorStore;
	readonly str: ColorStore;
	readonly num: ColorStore;
	readonly text: ColorStore;
	readonly background: ColorStore;
	readonly primary: CustomSchemeColorSet;
	readonly tertiary: CustomSchemeColorSet;
	readonly indents: WritableStore<Color[]>;

	get scheme() {
		return this.#scheme.store;
	}

	constructor(schemes: schemes.ColorScheme) {
		this.#scheme = Store.controller(schemes);
		this.name = new WritableStoreImpl(schemes.name);
		this.name.listen(this.#updateName.bind(this));
		this.key = this.#rootColorStore(schemes, 'key');
		this.keyword = this.#rootColorStore(schemes, 'keyword');
		this.str = this.#rootColorStore(schemes, 'str');
		this.num = this.#rootColorStore(schemes, 'num');
		this.text = this.#rootColorStore(schemes, 'text');
		this.background = this.#rootColorStore(schemes, 'background');
		this.primary = this.#createSet(schemes, 'primary');
		this.tertiary = this.#createSet(schemes, 'tertiary');
		this.indents = Store.controller(Array.from(schemes.indents, v => Color(v)));
		this.indents.listen(value => this.#update(v => v.indents = Array.from(value, v => v.hex())));
	}

	#updateName(name: string) {
		this.#scheme.update(v => {
			const copy = { ...v };
			copy.name = name;
			return copy;
		});
	}

	#update(updater: (v: schemes.ColorScheme) => void) {
		this.#scheme.update(v => {
			const copy = structuredClone(v);
			updater(copy);
			return copy;
		});
	}

	#rootColorStore(scheme: schemes.ColorScheme, key: SchemeColorKey) {
		const value = scheme[key];
		const color = Color(value);
		const store = new WritableStoreImpl(color);
		store.listen(v => this.#update(obj => obj[key] = v.hex()));
		return store;
	}

	#createSet(values: schemes.ColorScheme, set: SchemeSetKey) {
		const background = (() => {
			const init = values[set].background;

			function handler(this: CustomScheme, mode: SetColorMode, value: Color) {
				this.#update(v => v[set].background[mode] = value.hex());
			}

			const def = new WritableStoreImpl(Color(init.def));
			def.listen(handler.bind(this, 'def'));
			const act = new WritableStoreImpl(init.act ? Color(init.act) : def.value);
			act.listen(handler.bind(this, 'act'));
			const hov = new WritableStoreImpl(init.hov ? Color(init.hov) : def.value);
			hov.listen(handler.bind(this, 'hov'));

			return { def, hov, act };
		})();

		const border = this.#createTogglebleSetColors(values, set, 'border', background.def, background.act, background.hov);
		const text = this.#createTogglebleSetColors(values, set, 'text', this.text);
		return { background, border, text };
	}

	#createTogglebleSetColors(values: schemes.ColorScheme, set: SchemeSetKey, prop: 'border' | 'text', fallbackDef: ColorStore, fallbackAct?: ColorStore, fallbackHov?: ColorStore) {
		const init = values[set][prop];
		const active = new WritableStoreImpl(!!init);

		active.listen(v => {
			if (v) {
				this.#update(v => v[set][prop] = {
					def: def.value.hex(),
					act: act.value.hex(),
					hov: hov.value.hex()
				});
			} else {
				this.#update(v => v[set][prop] = undefined);
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
			active.value && this.#update(v => v[set][prop]![mode] = value.hex());
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
