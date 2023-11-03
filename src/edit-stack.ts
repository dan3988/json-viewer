import { StateController } from "./prop.js";

export interface EditStackProps {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly count: number;
}

export interface EditAction {
	commit(): void;
	undo(): void;
}

export class EditStack implements EditStackProps {
	readonly #state: StateController<EditStackProps>;
	readonly #actions: EditAction[][];
	#count: number;

	get count() {
		return this.#count;
	}

	get state() {
		return this.#state.state;
	}

	get canUndo() {
		return this.#state.getValue("canUndo");
	}

	get canRedo() {
		return this.#state.getValue("canRedo");
	}

	constructor() {
		this.#actions = [];
		this.#count = 0;
		this.#state = new StateController<EditStackProps>({ canRedo: false, canUndo: false, count: 0 });
	}

	undo(): boolean {
		let count = this.#count;
		if (count === 0)
			return false;

		this.#count = --count;
		this.#actions[count].forEach(v => v.undo());
		this.#state.setValues({ count, canUndo: !!count, canRedo: true });
		return true;
	}

	redo(): boolean {
		let count = this.#count;
		if (count >= this.#actions.length)
			return false;

		this.#actions[count++].forEach(v => v.commit());
		this.#count = count;
		this.#state.setValues({ count, canUndo: true, canRedo: count < this.#actions.length });
		return true;
	}

	push(...actions: EditAction[]): number {
		let count = this.#count;
		this.#actions.splice(count, Infinity, actions);
		this.#count = ++count;
		this.#state.setValues({ count, canUndo: true, canRedo: false });
		actions.forEach(v => v.commit());
		return count;
	}
}
