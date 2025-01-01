import StoreController from "../store";
import Color from "color";
import schemes from "../schemes";
import { WritableStore, WritableStoreImpl } from "../store";

type SchemeColorKey = 'key' | 'keyword' | 'str' | 'num' | 'text' | 'background';
type SetColorKey = 'text' | 'background' | 'border';
type SetModKey = 'lightnessMod' | 'saturationMod';

type SchemeKey = 'light' | 'dark';
type SchemeSetKey = 'primary' | 'tertiary';

type ColorStore = WritableStore<Color<any>>;
type OptionalColorStore = WritableStore<Color<any> | null>;
type ModifierColorStore = WritableStore<number>;

export class CustomScheme {
	static readonly #RootColorStore = class extends WritableStoreImpl<Color> {
		readonly #owner: CustomScheme;
		readonly #darkMode: boolean;
		readonly #key: SchemeColorKey;
	
		constructor(owner: CustomScheme, darkMode: boolean, values: schemes.ColorSchemeValues, key: SchemeColorKey) {
			const value = values[key];
			const color = schemes.deserializeColor(value);
			super(color);
			this.#owner = owner;
			this.#darkMode = darkMode;
			this.#key = key;
		}
	
		protected onChanged(_: Color, value: Color): void {
			const key = this.#key;
			this.#owner.#update(this.#darkMode, v => v[key] = schemes.serializeColor(value));
		}
	}

	static readonly #SetColorStore = class extends WritableStoreImpl<Color | null> {
		readonly #owner: CustomScheme;
		readonly #darkMode: boolean;
		readonly #set: SchemeSetKey;
		readonly #key: SetColorKey;
	
		constructor(owner: CustomScheme, darkMode: boolean, values: schemes.ColorSchemeValues, set: SchemeSetKey, key: SetColorKey) {
			const value = values[set][key];
			const color = (value && schemes.deserializeColor(value)) ?? null;
			super(color);
			this.#owner = owner;
			this.#darkMode = darkMode;
			this.#set = set;
			this.#key = key;
		}
	
		protected onChanged(_: Color, value: Color): void {
			const [set, key] = [this.#set, this.#key];
			this.#owner.#update(this.#darkMode, v => v[set][key] = value ? schemes.serializeColor(value) : undefined!);
		}
	}

	static readonly #SetModStore = class extends WritableStoreImpl<number> {
		readonly #owner: CustomScheme;
		readonly #darkMode: boolean;
		readonly #set: SchemeSetKey;
		readonly #key: SetModKey;
	
		constructor(owner: CustomScheme, darkMode: boolean, values: schemes.ColorSchemeValues, set: SchemeSetKey, key: SetModKey) {
			const value = (values[set][key] ?? 0) * 100;
			super(value);
			this.#owner = owner;
			this.#darkMode = darkMode;
			this.#set = set;
			this.#key = key;
		}
	
		protected onChanged(_: number, value: number): void {
			const [set, key] = [this.#set, this.#key];
			this.#owner.#update(this.#darkMode, v => v[set][key] = value ? Math.floor(value) / 100 : null);
		}
	}

	readonly #scheme: StoreController<schemes.ColorScheme>;
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
		this.#scheme = new StoreController(value);
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
		const indentColors = Array.from(values!.indents, schemes.deserializeColor);
		const indents = new StoreController<Color[]>(indentColors);
		indents.listen(value => this.#update(darkMode, v => v.indents = Array.from(value, schemes.serializeColor)));
		return new CustomSchemeValues(
			new CustomScheme.#RootColorStore(this, darkMode, values, 'key'),
			new CustomScheme.#RootColorStore(this, darkMode, values, 'keyword'),
			new CustomScheme.#RootColorStore(this, darkMode, values, 'str'),
			new CustomScheme.#RootColorStore(this, darkMode, values, 'num'),
			new CustomScheme.#RootColorStore(this, darkMode, values, 'text'),
			new CustomScheme.#RootColorStore(this, darkMode, values, 'background'),
			this.#createSet(values, darkMode, 'primary'),
			this.#createSet(values, darkMode, 'tertiary'),
			indents,
		)
	}

	#createSet(values: schemes.ColorSchemeValues, darkMode: boolean, key: SchemeSetKey) {
		return new CustomSchemeColorSet(
			new CustomScheme.#SetColorStore(this, darkMode, values, key, 'text'),
			new CustomScheme.#SetColorStore(this, darkMode, values, key, 'background') as ColorStore,
			new CustomScheme.#SetColorStore(this, darkMode, values, key, 'border'),
			new CustomScheme.#SetModStore(this, darkMode, values, key, 'lightnessMod'),
			new CustomScheme.#SetModStore(this, darkMode, values, key, 'saturationMod'),
		);
	}
}

export class CustomSchemeColorSet {
	constructor(
		readonly text: OptionalColorStore,
		readonly background: ColorStore,
		readonly border: OptionalColorStore,
		readonly lightnessMod: ModifierColorStore,
		readonly saturationMod: ModifierColorStore) {
	}
}

export class CustomSchemeValues {
	constructor(
		readonly key: ColorStore,
		readonly keyword: ColorStore,
		readonly str: ColorStore,
		readonly num: ColorStore,
		readonly text: ColorStore,
		readonly background: ColorStore,
		readonly primary: CustomSchemeColorSet,
		readonly tertiary: CustomSchemeColorSet,
		readonly indents: WritableStore<Color[]>) {
	}
}
