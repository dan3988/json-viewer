import type { DocumentRequestInfo } from "./types.js";
import { EditStack } from "./edit-stack.js";
import { EventHandlers } from "./evt.js";
import { StateController } from "./state.js";
import json from "./json.js";
import Linq from "@daniel.pickett/linq-js";

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
	lastSelected: null | json.JProperty;
	filterText: string;
	filterFlags: json.JTokenFilterFlags;
	requestInfo: undefined | null | DocumentRequestInfo
	useWebRequest: boolean;
	formatIndent: string;
}

export interface ViewerCommands {
	focusSearch: [];
	saveAs: [];
	scrollTo: [token: json.JProperty];
	context: [token: json.JProperty, x: number, y: number];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export type ViewerCommandEvent = { [P in keyof ViewerCommands]: { command: P, args: ViewerCommands[P] } }[keyof ViewerCommands];

function serializeForCopy(token: json.JToken, indent: undefined | string, escapeValues?: boolean) {
	if (!escapeValues && token.is("value")) {
		return String(token.value);
	} else {
		return JSON.stringify(token, undefined, indent);
	}
}

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
	readonly #state: StateController<ChangeProps>;
	readonly #command: EventHandlers<this, [evt: ViewerCommandEvent]>;
	#selected: Set<json.JProperty>;
	#lastSelected: null | json.JProperty;
	readonly #selectedList: SelectedPropertyList;
	readonly #edits: EditStack;

	get root() {
		return this.#root;
	}

	get selected() {
		return this.#selectedList;
	}

	get state() {
		return this.#state.state;
	}

	get requestInfo() {
		return this.#state.getValue("requestInfo");
	}

	set requestInfo(v) {
		this.#state.setValue("requestInfo", v);
	}

	get formatIndent() {
		return this.#state.getValue("formatIndent");
	}

	set formatIndent(v) {
		this.#state.setValue("formatIndent", v);
	}

	get useWebRequest() {
		return this.#state.getValue("useWebRequest");
	}

	set useWebRequest(v) {
		this.#state.setValue("useWebRequest", v);
	}

	get command() {
		return this.#command.event;
	}

	get filterText() {
		return this.#state.getValue("filterText");
	}

	get filterFlags() {
		return this.#state.getValue("filterFlags");
	}

	get edits() {
		return this.#edits;
	}

	constructor(root: json.JProperty) {
		this.#root = root;
		this.#state = new StateController<ChangeProps>({
			selected: [],
			lastSelected: null,
			filterFlags: json.JTokenFilterFlags.Both,
			filterText: "",
			requestInfo: undefined,
			useWebRequest: false,
			formatIndent: ""
		});

		this.#command = new EventHandlers();
		this.#selected = new Set();
		this.#lastSelected = null;
		this.#selectedList = new ViewerModel.#SelectedList(this);
		this.#edits = new EditStack();
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.hasListeners)
			handlers.fire(this, <any>{ command, args });
	}

	formatValue(token: json.JToken, minify?: boolean, escapeValues?: boolean) {
		const indent = minify ? undefined : this.formatIndent;
		return serializeForCopy(token, indent, escapeValues);
	}
	
	formatValues(values: Iterable<json.JProperty>, minify?: boolean) {
		const indent = minify ? undefined : this.formatIndent;
		return Linq(values)
			.select(p => serializeForCopy(p.value, indent, true))
			.joinText(minify ? "," : ",\r\n");
	}
	

	filter(text: string, flags?: json.JTokenFilterFlags) {
		text = text.toLowerCase();
		const oldText = this.#state.getValue("filterText");
		const oldFlags = this.#state.getValue("filterFlags");
		const flagsChanged = flags != null && flags !== oldFlags;
		flags ??= oldFlags;

		let append = text.includes(oldText);
		let textChanged = !append || oldText.length !== text.length;
		if (!textChanged && !flagsChanged)
			return;

		if (append && flagsChanged)
			append = (oldFlags & flags) === flags;

		this.#state.setValue("filterText", text);
		this.#state.setValue("filterFlags", flags);
		this.#root.filter(text, flags, append);
	}

	resolve(path: string | readonly (number | string)[]): json.JProperty | undefined {
		if (typeof path === "string")
			path = json.parsePath(path);

		let i = 0;
		let baseProp: json.JProperty;
		if (path[0] !== "$") {
			const selected = this.#state.getValue("selected").at(-1);
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

		let lastSelected: null | json.JProperty = null;

		for (const p of set)
			(lastSelected = p).isSelected = true;

		this.#selected = set;
		this.#lastSelected = lastSelected;
		this.#state.setValues({ selected: [...set], lastSelected });
	}

	#selectedClear() {
		if (this.#selected.size === 0)
			return false;

		for (const selected of this.#selected)
			selected.isSelected = false;

		this.#selected.clear();
		this.#lastSelected = null;
		this.#state.setValues({ selected: [], lastSelected: null });
		return true;
	}

	#selectedAdd(props: json.JProperty[]) {
		let changed = 0;

		const selected = [...this.#state.getValue("selected")];
		let lastSelected = this.#lastSelected;
		for (const prop of props) {
			if (prop.isSelected)
				continue;

			this.#selected.add(prop);
			selected.push(prop);
			prop.isSelected = true;
			changed++;
			lastSelected = prop;
		}

		if (changed) {
			this.#lastSelected = lastSelected;
			this.#state.setValues({ selected, lastSelected });
		}

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
			const selected = [...this.#selected];
			const lastSelected = selected.at(-1) ?? null
			this.#lastSelected = lastSelected;
			this.#state.setValues({ selected, lastSelected });
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