import type ViewerModel from "./viewer-model.js";
import type json from "./json.js";
import { KeyBinding, KeyBindingScope, type KeyCode, type ModifierKeys } from "./keyboard.js";
import edits from "./viewer/editor-helper.js";
import Linq from "@daniel.pickett/linq-js";

type KeyBindingInit = [scope: KeyBindingScope, key: KeyCode, modif?: ModifierKeys];

type ICommand = Command;

const CommandImpl = class Command<TKey extends string> implements ICommand {
	readonly #key: TKey;
	readonly #description: string;
	readonly #defaultBindings: KeyBinding[];

	get key() {
		return this.#key;
	}

	get description() {
		return this.#description;
	}

	get defaultBindings() {
		return this.#defaultBindings;
	}

	constructor(key: TKey, description: string, ...defaultBindings: KeyBindingInit[]) {
		this.#key = key;
		this.#description = description;
		this.#defaultBindings = defaultBindings.map(([scope, key, modif]) => new KeyBinding(this, scope, key, modif));
	}

	execute(model: ViewerModel) {
		return commandHandlers[this.#key](model);
	}
}

type CommandInvoker = (model: ViewerModel) => void | boolean | Promise<void>;
type CommandHandlers = { [P in CommandId]: CommandInvoker };

const commandHandlers: Record<string, CommandInvoker> = {
	selectionClear(model) {
		model.selected.clear();
		return true;
	},
	selectionToggleExpanded(model) {
		model.selected.forEach(v => v.toggleExpanded());
		return true;
	},
	selectionDelete(model) {
		if (model.selected.size === 1) {
			edits.deleteProp(model, model.selected.last!, true);
		} else {
			edits.deleteProps(model, model.selected);
			model.selected.clear();
		}
	},
	async selectionCopy(model) {
		const selection = window.getSelection();
		if (selection != null && selection.type === "Range")
			return;

		let text: string;

		const values = model.selected;
		if (values.size === 0) {
			return;
		} else if (values.size > 1) {
			text = model.formatValues(values);
		} else {
			text = model.formatValue(values.last!.value);
		}

		await navigator.clipboard.writeText(text);
	},
	selectionNext(model) {
		const selected = model.selected.last;
		if (selected) {
			let v = selected.next;
			if (v != null || (v = selected.parent?.first ?? null) != null)
				model.setSelected(v, false, true);
		} else {
			model.setSelected(model.root, false, true);
		}

		return true;
	},
	selectionPrev(model) {
		const selected = model.selected.last;
		if (selected != null) {
			let v = selected.previous;
			if (v != null || (v = selected.parent?.last ?? null) != null)
				model.setSelected(v, false, true);
		} else {
			model.setSelected(model.root, false, true);
		}

		return true;
	},
	selectionDown(model) {
		const selected = model.selected.last;
		if (selected && selected.value.is("container") && selected.value.first != null) {
			selected.isExpanded = true;
			model.setSelected(selected.value.first, false, true);
			return true;
		}
	},
	selectionUp(model) {
		const selected = model.selected.last;
		if (selected && selected.parent)
			model.setSelected(selected.parent.owner, true, true);

		return true;
	},
	selectionRename(model) {
		const selected = model.selected.last;
		const parent = selected?.parent?.is('object');
		if (parent)
			model.execute('rename', selected as json.JProperty<string>);

		return true;
	},
	search(model) {
		model.execute("focusSearch");
		return true;
	},
	editUndo(model) {
		model.edits.undo()
		return true;
	},
	editRedo(model) {
		model.edits.redo()
		return true;
	},
	fileSave(model) {
		model.execute('saveAs');
		return true;
	}
} satisfies CommandHandlers;

export interface Command {
	readonly key: string;
	readonly description: string;
	readonly defaultBindings: readonly KeyBinding[];

	execute(model: ViewerModel): ReturnType<CommandInvoker>;
}

const _commands = Object.freeze([
	new CommandImpl("selectionClear", "Clear selected property", [KeyBindingScope.Editor, "Escape"]),
	new CommandImpl("selectionToggleExpanded", "Expand/collapse selected property", [KeyBindingScope.Editor, "Space"]),
	new CommandImpl("selectionDelete", "Delete selected property", [KeyBindingScope.Editor, "Delete"]),
	new CommandImpl("search", "Search", [KeyBindingScope.Editor, "KeyF", { ctrlKey: true }]),
	new CommandImpl("selectionCopy", "Copy selected property", [KeyBindingScope.Editor, "KeyC", { ctrlKey: true }]),
	new CommandImpl("selectionNext", "Go to next sibling property", [KeyBindingScope.Editor, "ArrowDown"]),
	new CommandImpl("selectionPrev", "Go to previous sibling property", [KeyBindingScope.Editor, "ArrowUp"]),
	new CommandImpl("selectionDown", "Go to child container", [KeyBindingScope.Editor, "ArrowRight"]),
	new CommandImpl("selectionUp", "Go to parent container", [KeyBindingScope.Editor, "ArrowLeft"]),
	new CommandImpl("selectionRename", "Rename current property", [KeyBindingScope.Editor, "KeyR"]),
	new CommandImpl("editUndo", "Undo last change", [KeyBindingScope.Window, "KeyZ", { ctrlKey: true }]),
	new CommandImpl("editRedo", "Redo last change", [KeyBindingScope.Window, "KeyY", { ctrlKey: true }], [KeyBindingScope.Window, "KeyZ", { ctrlKey: true, shiftKey: true }]),
	new CommandImpl("fileSave", "Save file", [KeyBindingScope.Window, "KeyS", { ctrlKey: true }]),
]);

export type CommandId = (typeof _commands)[number]["key"];
export const commands: readonly Command[] = _commands;
export const commandLookup: { [P in CommandId]: Command } = Linq(_commands).toObject(v => v.key);
