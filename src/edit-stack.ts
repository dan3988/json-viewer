import { StateController } from "./state.js";
import { EventHandlers } from "./evt.js";
import json from "./json.js";

export interface EditStackProps {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly count: number;
}

export interface EditActionInit {
	commitTarget?: null | json.Node,
	revertTarget?: null | json.Node
}

export class EditAction {
	static group(actions: Iterable<EditAction>) {
		return new EditActionGroup([...actions]);
	}

	readonly commitTarget: null | json.Node;
	readonly revertTarget: null | json.Node;

	constructor(readonly commit: VoidFunction, readonly revert: VoidFunction, target?: null | json.Node | EditActionInit) {
		if (target) {
			if (target instanceof json.Node) {
				this.commitTarget = target;
				this.revertTarget = target;
			} else {
				this.commitTarget = target.commitTarget ?? null;
				this.revertTarget = target.revertTarget ?? null;
			}
		} else {
			this.commitTarget = null;
			this.revertTarget = null;
		}
	}
}

class EditActionGroup implements EditAction {
	get commitTarget() {
		return null;
	}

	get revertTarget() {
		return null;
	}

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
	readonly #onCommit = new EventHandlers<this, [action: EditAction]>();
	readonly #onRevert = new EventHandlers<this, [action: EditAction]>();
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

	get onCommit() {
		return this.#onCommit.event;
	}

	get onRevert() {
		return this.#onRevert.event;
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

		const action = this.#actions[--count];
		action.revert();
		this.#counter++;
		this.#count = count;
		this.#state.setValues({ count, canUndo: !!count, canRedo: true });
		this.#onRevert.fire(this, action);
		return true;
	}

	redo(): boolean {
		let count = this.#count;
		if (count >= this.#actions.length)
			return false;

		const action = this.#actions[count];
		action.commit();
		this.#count = ++count;
		this.#state.setValues({ count, canUndo: true, canRedo: count < this.#actions.length });
		this.#onCommit.fire(this, action);
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
		this.#onCommit.fire(this, action);
		return id;
	}
}
