import ButtonComponent from "./button/Button.svelte";
import ButtonTheme from "./button/ButtonTheme.svelte";
import ButtonThemeData from "./button/theme";
import ToggleButton from "./button/ToggleButton.svelte";

export class Button extends ButtonComponent {
}

export namespace Button {
	export type Style =  'base' | 'primary' | 'faded';

	export const Theme = ButtonTheme;
	export type Theme = ButtonTheme;

	export const ThemeData = ButtonThemeData;
	export type ThemeData = ButtonThemeData;

	export const Toggle = ToggleButton;
	export type Toggle = ToggleButton;
}

export default Button;
