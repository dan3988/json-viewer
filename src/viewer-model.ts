import { EventHandlers } from "./evt.js";
import json from "./json.js"
import { PropertyBag } from "./prop.js";

export interface SelectedPropertyList extends Iterable<json.JProperty> {
	readonly size: number;
	readonly last: null | json.JProperty;
	has(value: json.JProperty): boolean;
	reset(...values: json.JProperty[]): void;
	add(...value: json.JProperty[]): number;
	remove(...value: json.JProperty[]): number;
	toggle(value: json.JProperty, selected?: boolean): boolean;
	clear(): void;
	forEach(callback: (v: json.JProperty) => void): void;
}

interface ChangeProps {
	selected: readonly json.JProperty[];
	filterText: string;
	filterFlags: json.JTokenFilterFlags;
}

export interface ViewerCommands {
	scrollTo: [token: json.JProperty];
	context: [token: json.JProperty, x: number, y: number];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export type ViewerCommandEvent = { [P in keyof ViewerCommands]: { command: P, args: ViewerCommands[P] } }[keyof ViewerCommands];

export class ViewerModel {
	static readonly #SelectedList = class implements SelectedPropertyList {
		#owner: ViewerModel;

		get size() {
			return this.#owner.#selected.size;
		}

		get last() {
			return this.#owner.#lastSelected;
		}

		constructor(owner: ViewerModel) {
			this.#owner = owner;
		}

		reset(...values: json.JProperty[]): void {
			this.#owner.#selectedReset(values);
		}

		has(value: json.JProperty): boolean {
			return this.#owner.#selected.has(value);
		}
	
		add(...values: json.JProperty[]): number {
			return this.#owner.#selectedAdd(values);
		}
	
		remove(...values: json.JProperty[]): number {
			return this.#owner.#selectedRemove(values);
		}
	
		toggle(value: json.JProperty, selected?: boolean): boolean {
			return this.#owner.#selectedToggle(value, selected);
		}
	
		clear(): void {
			this.#owner.#selectedClear();
		}

		forEach(callback: (v: json.JProperty) => void) {
			this.#owner.#selected.forEach(v => callback.call(this, v));
		}

		[Symbol.iterator]() {
			return this.#owner.#selected[Symbol.iterator]();
		}
	}

	readonly #root: json.JProperty;
	readonly #bag: PropertyBag<ChangeProps>;
	readonly #command: EventHandlers<this, [evt: ViewerCommandEvent]>;
	#selected: Set<json.JProperty>;
	#lastSelected: null | json.JProperty;
	readonly #selectedList: SelectedPropertyList;

	get root() {
		return this.#root;
	}

	get selected() {
		return this.#selectedList;
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

	constructor(root: json.JProperty) {
		this.#root = root;
		this.#bag = new PropertyBag<ChangeProps>({ selected: [], filterFlags: json.JTokenFilterFlags.Both, filterText: "" });
		this.#command = new EventHandlers();
		this.#selected = new Set();
		this.#lastSelected = null;
		this.#selectedList = new ViewerModel.#SelectedList(this);
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.hasListeners)
			handlers.fire(this, <any>{ command, args });
	}

	filter(text: string, flags?: json.JTokenFilterFlags) {
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

	resolve(path: string | readonly (number | string)[]): json.JProperty | undefined {
		if (typeof path === "string")
			path = json.parsePath(path);

		let i = 0;
		let baseProp: json.JProperty;
		if (path[0] !== "$") {
			const selected = this.#bag.getValue("selected").at(-1);
			if (selected == null)
				return;

			baseProp = selected;
		} else if (path.length === 1) {
			return this.#root;
		} else {
			i++;
			baseProp = this.#root;
		}
	
		for (let curr = baseProp; curr.value.is("container"); ) {
			const key = path[i];
			const child = curr.value.getProperty(key);
			if (child == null)
				break;

			if (++i === path.length)
				return child;

			curr = child;
		}
	}

	select(path: string | readonly (number | string)[]) {
		const prop = this.resolve(path);
		if (prop == null)
			return false;

		return this.#selectedAdd([prop]);
	}

	#onSelected(selected: json.JProperty, expand: boolean, scrollTo: boolean) {
		if (expand)
			for (let p: null | json.JToken = selected.parent; p != null; p = p.parent)
				p.owner.isExpanded = true;

		if (scrollTo)
			this.execute("scrollTo", selected);
	}

	setSelected(selected: json.JProperty, expand: boolean, scrollTo: boolean) {
		this.#selectedReset([selected]);
		this.#onSelected(selected, expand ?? false, scrollTo ?? false);
	}

	#selectedReset(values: json.JProperty[]) {
		const set = new Set(values);
		if (this.#selected.size !== 0)
			for (const prop of this.#selected)
				if (!set.has(prop))
					prop.isSelected = false;

		let last: null | json.JProperty = null;

		for (const p of set)
			(last = p).isSelected = true;

		this.#selected = set;
		this.#lastSelected = last;
		this.#bag.setValue("selected", [...set]);
	}

	#selectedClear() {
		if (this.#selected.size === 0)
			return false;

		for (const selected of this.#selected)
			selected.isSelected = false;

		this.#selected.clear();
		this.#lastSelected = null;
		this.#bag.setValue("selected", []);
		return true;
	}

	#selectedAdd(props: json.JProperty[]) {
		let changed = 0;

		const arr = [...this.#bag.getValue("selected")];
		for (const prop of props) {
			if (prop.isSelected)
				continue;

			this.#selected.add(prop);
			this.#lastSelected = prop;
			arr.push(prop);
			prop.isSelected = true;
			changed++;
		}

		if (changed)
			this.#bag.setValue("selected", arr);

		return changed;
	}

	#selectedRemove(props: json.JProperty[]) {
		let changed = 0;

		for (const prop of props) {
			if (!prop.isSelected)
				continue;

			this.#selected.delete(prop);
			prop.isSelected = false;
			changed++;
		}

		if (changed) {
			const arr = [...this.#selected];
			this.#lastSelected = arr.at(-1) ?? null;
			this.#bag.setValue("selected", arr);
		}

		return changed;
	}

	#selectedToggle(prop: json.JProperty, selected?: boolean) {
		selected ??= !prop.isSelected;

		if (selected == null || selected != prop.isSelected) {
			selected ??= !prop.isSelected;

			if (selected) {
				this.#selectedAdd([prop]);
			} else {
				this.#selectedRemove([prop]);
			}

			prop.isSelected = selected;
		}

		return selected;
	}
}

export default ViewerModel;