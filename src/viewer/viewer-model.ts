import { EventHandlers } from "./evt.js";
import { JsonContainer, JsonProperty, JsonToken, JsonTokenFilterFlags } from "../json.js";
import { PropertyBag } from "../prop.js";

interface ChangeProps {
	selected: null | JsonProperty;
	filterText: string;
	filterFlags: JsonTokenFilterFlags;
}

export interface ViewerCommands {
	scrollTo: [token: JsonProperty];
	context: [token: JsonProperty, x: number, y: number];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export type ViewerCommandEvent = { [P in keyof ViewerCommands]: { command: P, args: ViewerCommands[P] } }[keyof ViewerCommands];

export class ViewerModel {
	readonly #root: JsonProperty;
	readonly #bag: PropertyBag<ChangeProps>;
	readonly #command: EventHandlers<this, [evt: ViewerCommandEvent]>;

	get root() {
		return this.#root;
	}

	get selected() {
		return this.#bag.getValue("selected");
	}

	set selected(value) {
		this.setSelected(value, false, false);
	}

	get bag() {
		return this.#bag.readOnly;
	}

	get command() {
		return this.#command.event;
	}

	get filterText() {
		return this.#bag.getValue("filterText");
	}

	get filterFlags() {
		return this.#bag.getValue("filterFlags");
	}

	constructor(root: JsonProperty) {
		this.#root = root;
		this.#bag = new PropertyBag<ChangeProps>({ selected: null, filterFlags: JsonTokenFilterFlags.Both, filterText: "" });
		this.#command = new EventHandlers();
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.hasListeners)
			handlers.fire(this, <any>{ command, args });
	}

	filter(text: string, flags?: JsonTokenFilterFlags) {
		text = text.toLowerCase();
		const oldText = this.#bag.getValue("filterText");
		const oldFlags = this.#bag.getValue("filterFlags");
		const flagsChanged = flags != null && flags !== oldFlags;
		flags ??= oldFlags;

		let append = text.includes(oldText);
		let textChanged = !append || oldText.length !== text.length;
		if (!textChanged && !flagsChanged)
			return;

		if (append && flagsChanged)
			append = (oldFlags & flags) === flags;

		this.#bag.setValue("filterText", text);
		this.#bag.setValue("filterFlags", flags);
		this.#root.filter(text, flags, append);
	}

	resolve(path: string | readonly (number | string)[]): JsonProperty | undefined {
		if (typeof path === "string")
			path = path.split("/");

		let i = 0;
		let baseProp: JsonProperty;
		if (path[0] !== "$") {
			const selected = this.#bag.getValue("selected");
			if (selected == null)
				return;

			baseProp = selected;
		} else if (path.length === 1) {
			return this.#root;
		} else {
			i++;
			baseProp = this.#root;
		}
	
		for (let curr = baseProp; curr.value instanceof JsonContainer; ) {
			const key = path[i];
			const child = curr.value.getProperty(key);
			if (child == null)
				break;

			if (++i === path.length)
				return child;

			curr = child;
		}
	}

	select(path: string | readonly (number | string)[], scrollTo?: boolean) {
		const prop = this.resolve(path);
		if (prop == null)
			return false;

		scrollTo ??= false;
		this.setSelected(prop, scrollTo, scrollTo);
		return true;
	}

	#onSelected(selected: JsonProperty, expand: boolean, scrollTo: boolean) {
		if (expand)
			for (let p: null | JsonToken = selected.parent; p != null; p = p.parent)
				p.parentProperty.expanded = true;

		if (scrollTo)
			this.execute("scrollTo", selected);
	}

	setSelected(selected: null): void;
	setSelected(selected: null | JsonProperty, expand: boolean, scrollTo: boolean): void
	setSelected(selected: null | JsonProperty, expand?: boolean, scrollTo?: boolean) {
		const old = this.#bag.getValue("selected");
		if (old !== selected) {
			if (old)
				old.selected = false;

			if (selected) {
				selected.selected = true;
				this.#onSelected(selected, expand ?? false, scrollTo ?? false);
			}

			this.#bag.setValue("selected", selected);
		} else if (old) {
			this.#onSelected(old, expand ?? false, scrollTo ?? false);
		}
	}
}

export default ViewerModel;