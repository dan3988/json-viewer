import ButtonComponent from "./Button.svelte";
import ButtonStyleComponent, { ButtonTheme } from "./ButtonStyle.svelte";

export type ButtonStyle =  'base' | 'primary' | 'faded';

export { ButtonTheme };

export class Button extends ButtonComponent {
	static readonly Style = ButtonStyleComponent;
}

export default Button;
