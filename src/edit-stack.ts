import { PropertyBag } from "./prop.js";

export interface EditStackProps {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	readonly count: number;
}

export interface EditAction {
	push(): void;
	pop(): void;
}

export class EditStack implements EditStackProps {
	readonly #bag: PropertyBag<EditStackProps>;
	readonly #actions: EditAction[];
	#count: number;

	get count() {
		return this.#count;
	}

	get bag() {
		return this.#bag.readOnly;
	}

	get canUndo() {
		return this.#bag.getValue("canUndo");
	}

	get canRedo() {
		return this.#bag.getValue("canRedo");
	}

	constructor() {
		this.#actions = [];
		this.#count = 0;
		this.#bag = new PropertyBag<EditStackProps>({ canRedo: false, canUndo: false, count: 0 });
	}

	undo(): boolean {
		let count = this.#count;
		if (count === 0)
			return false;

		this.#count = --count;
		this.#actions[count].pop();
		this.#bag.setValues({ count, canUndo: !!count, canRedo: true });
		return true;
	}

	redo(): boolean {
		let count = this.#count;
		if (count >= this.#actions.length)
			return false;

		this.#actions[count++].push();
		this.#count = count;
		this.#bag.setValues({ count, canUndo: true, canRedo: count < this.#actions.length });
		return true;
	}

	push(action: EditAction): number {
		let count = this.#count;
		this.#actions.splice(count, Infinity, action);
		this.#count = ++count;
		this.#bag.setValues({ count, canUndo: true, canRedo: false });
		action.push();
		return count;
	}
}
