import { getContext, setContext } from "svelte";
import Store, { StoreController } from "../store";
import ButtonComponent from "./Button.svelte";
import ButtonStyleComponent from "./ButtonStyle.svelte";

const themeKey = Symbol('ButtonStyle');

export class ButtonTheme {
	static readonly #default = new ButtonTheme('base');
	static readonly #defaultStore = Store.const(this.#default);

	static createContext(): StoreController<ButtonTheme> {
		const store = Store.controller<ButtonTheme>(undefined!);
		setContext(themeKey, store);
		return store;
	}

	static get current(): Store<ButtonTheme> {
		return getContext(themeKey) ?? ButtonTheme.#defaultStore;
	}

	constructor(readonly style: ButtonStyle) {
	}
}

export type ButtonStyle =  'base' | 'primary' | 'faded';

export class Button extends ButtonComponent {
	static readonly Style = ButtonStyleComponent;
}

export default Button;
