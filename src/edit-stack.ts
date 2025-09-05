import { StateController } from "./state.js";

export interface EditStackProps {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly count: number;
}

export class EditAction {
	static group(actions: Iterable<EditAction>) {
		return new EditActionGroup([...actions]);
	}

	constructor(readonly commit: VoidFunction, readonly revert: VoidFunction) {
	}
}

class EditActionGroup implements EditAction {
	readonly #actions: EditAction[];

	constructor(actions: Iterable<EditAction>) {
		this.#actions = Array.from(actions);
	}

	commit() {
		for (const action of this.#actions) {
			action.commit();
		}
	}

	revert() {
		for (const action of this.#actions) {
			action.revert();
		}
	}
}

export class EditStack implements EditStackProps {
	readonly #state: StateController<EditStackProps>;
	readonly #actions: EditAction[];
	#count = 0;
	#counter = 0;

	/** Increments when an action is pushed or undone. */
	get counter() {
		return this.#counter;
	}

	/** Number of actions that can be undone. */
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
		this.#state = new StateController<EditStackProps>({ canRedo: false, canUndo: false, count: 0 });
	}

	undo(): boolean {
		let count = this.#count;
		if (count === 0)
			return false;

		this.#actions[--count].revert();
		this.#counter++;
		this.#count = count;
		this.#state.setValues({ count, canUndo: !!count, canRedo: true });
		return true;
	}

	redo(): boolean {
		let count = this.#count;
		if (count >= this.#actions.length)
			return false;

		this.#actions[count].commit();
		this.#count = ++count;
		this.#state.setValues({ count, canUndo: true, canRedo: count < this.#actions.length });
		return true;
	}

	/**
	 * Push an action on the stack, clearing any undone actions
	 * @param actions 
	 * @returns The value of `counter`
	 */
	push(action: EditAction): number {
		let count = this.#count;
		action.commit();
		this.#actions.splice(count, Infinity, action);
		const id = ++this.#counter;
		this.#count = ++count;
		this.#state.setValues({ count, canUndo: true, canRedo: false });
		return id;
	}
}
