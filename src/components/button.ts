import { getContext, setContext } from "svelte";
import Store, { StoreController } from "../store";
import ButtonComponent from "./Button.svelte";
import ToggleButton from "./ToggleButton.svelte";
import ButtonTheme from "./ButtonTheme.svelte";

const themeKey = Symbol('ButtonStyle');

export class Button extends ButtonComponent {
}

export namespace Button {
	export type Style =  'base' | 'primary' | 'faded';

	export const Theme = ButtonTheme;
	export type Theme = ButtonTheme;

	export const Toggle = ToggleButton;
	export type Toggle = ToggleButton;

	export class ThemeData {
		static readonly #default = new this('base');
		static readonly #defaultStore = Store.const(this.#default);

		static createContext(): StoreController<ThemeData> {
			const store = Store.controller<ThemeData>(undefined!);
			setContext(themeKey, store);
			return store;
		}

		static get current(): Store<ButtonTheme> {
			return getContext(themeKey) ?? this.#defaultStore;
		}

		constructor(readonly style: Style) {
		}
	}
}

export default Button;
