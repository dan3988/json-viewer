import type { ButtonTheme, ButtonStyle } from "../button.js";
import { getContext, setContext } from "svelte";
import Store, { StoreController } from "../../store";

const themeKey = Symbol('ButtonStyle');

export class ButtonThemeData {
	static readonly #default = new this('base');
	static readonly #defaultStore = Store.const(this.#default);

	static createContext(): StoreController<ButtonThemeData> {
		const store = Store.controller<ButtonThemeData>(undefined!);
		setContext(themeKey, store);
		return store;
	}

	static get current(): Store<ButtonThemeData> {
		return getContext(themeKey) ?? this.#defaultStore;
	}

	constructor(readonly style: ButtonStyle) {
	}
}

export default ButtonThemeData;