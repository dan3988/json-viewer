import type { Command } from "./commands.js";
import ViewerModel from "./viewer-model.js";

type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type Function = `F${Exclude<Digit, "0"> | `1${Digit}` | "20"}`;

type Control = "Backspace" | "Delete" | "CapsLock" | "Enter" | "ShiftLeft" | "ShiftRight" | "ControlLeft" | "ControlRight" | "AltLeft" | "AltRight" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Escape";
type Misc = "Backquote" | "Minus" | "Equal" | "Space" | "Tab" | "BracketLeft" | "BracketRight" | "Backslash" | "IntlBackslash" | "Slash" | "SemiColon" | "Quote" | "Comma" | "Period";

export type KeyCode = `Key${Letter}` | `Digit${Digit}` | `Numpad${Digit}` | Control | Misc | Function;

export interface ModifierKeys {
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}

export enum KeyModifiers {
	None	= 0,
	Ctrl	= 1 << 0,
	Shift	= 1 << 1,
	Alt		= 1 << 2,
	Meta	= 1 << 3
}

export function getModifiers(evt: ModifierKeys) {
	let modif = KeyModifiers.None;
	if (evt.ctrlKey)
		modif |= KeyModifiers.Ctrl;

	if (evt.shiftKey)
		modif |= KeyModifiers.Shift;

	if (evt.altKey)
		modif |= KeyModifiers.Alt;

	if (evt.metaKey)
		modif |= KeyModifiers.Meta;

	return modif;
}

export enum KeyBindingScope {
	Window,
	Editor
}

export class KeyBinding {
	readonly #command: Command;
	readonly #scope: KeyBindingScope;
	readonly #key: KeyCode;
	readonly #modifiers: KeyModifiers;

	get command() {
		return this.#command;
	}

	get scope() {
		return this.#scope;
	}

	get key() {
		return this.#key;
	}

	get modifiers() {
		return this.#modifiers;
	}

	constructor(command: Command, scope: KeyBindingScope, key: KeyCode, modifiers?: ModifierKeys) {
		this.#command = command;
		this.#scope = scope;
		this.#key = key;
		this.#modifiers = +(modifiers != null && getModifiers(modifiers));
	}

	hasModifier(modifier: KeyModifiers | Exclude<keyof typeof KeyModifiers, "None">): boolean {
		if (typeof modifier === "string")
			modifier = KeyModifiers[modifier];

		return modifier === (modifier & this.#modifiers);
	}
}

type CommandDict = Dict<Command>;

export class KeyBindingListener {
	readonly #model: ViewerModel;
	readonly #ac: AbortController;

	constructor(model: ViewerModel, editor: HTMLElement, bindings: Iterable<KeyBinding>) {
		const ac = new AbortController();
		const windowCommands: CommandDict[] = [];
		const editorCommands: CommandDict[] = [];
		const { signal } = ac;
		window.addEventListener("keydown", evt => this.#onKeyDown(windowCommands, evt), { signal });
		editor.addEventListener("keydown", evt => this.#onKeyDown(editorCommands, evt), { signal });

		for (const binding of bindings) {
			const array = binding.scope == KeyBindingScope.Window ? windowCommands : editorCommands;
			const lookup = array[binding.modifiers] ??= Object.create(null);
			lookup[binding.key] = binding.command;
		}

		this.#model = model;
		this.#ac = ac;
	}

	dispose() {
		this.#ac.abort();
	}

	#onKeyDown(lookup: CommandDict[], evt: KeyboardEvent) {
		const modif = getModifiers(evt);
		const command = lookup[modif]?.[evt.code];
		if (!command)
			return;

		const result = command.execute(this.#model);
		if (result)
			evt.preventDefault();
	}
}