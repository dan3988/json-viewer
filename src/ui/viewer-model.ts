import { EventHandlers } from "./evt";
import { JsonArray, JsonContainer, JsonObject, JsonProperty, JsonToken, JsonTokenFilterFlags, JsonValue } from "./json";
import { PropertyChangeEvent, type PropertyChangeHandlerTypes, type PropertyChangeNotifier } from "./prop";

interface ChangeProps {
	selected: null | JsonProperty
}

export interface ViewerCommands {
	scrollTo: [token: JsonProperty];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export type ViewerCommandEvent = { [P in keyof ViewerCommands]: { command: P, args: ViewerCommands[P] } }[keyof ViewerCommands];

export class ViewerModel implements PropertyChangeNotifier<ChangeProps> {
	readonly #root: JsonProperty;
	readonly #propertyChange: EventHandlers<PropertyChangeHandlerTypes<ViewerModel, ChangeProps>>;
	readonly #command: EventHandlers<ViewerCommandHandler<this>>;
	#selected: null | JsonProperty;
	#filter: string;
	#filterFlags: JsonTokenFilterFlags;

	get root() {
		return this.#root;
	}

	get selected() {
		return this.#selected;
	}

	set selected(value) {
		this.setSelected(value, false, false);
	}

	get propertyChange() {
		return this.#propertyChange.event;
	}

	get command() {
		return this.#command.event;
	}

	constructor(root: JsonProperty) {
		this.#root = root;
		this.#propertyChange = new EventHandlers();
		this.#command = new EventHandlers();
		this.#selected = null;
		this.#filter = "";
		this.#filterFlags = JsonTokenFilterFlags.Both;
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.hasListeners)
			handlers.fire(this, <any>{ command, args });
	}

	filter(text: string, flags?: JsonTokenFilterFlags) {
		text = text.toLowerCase();
		const oldText = this.#filter;
		const oldFlags = this.#filterFlags;
		const flagsChanged = flags != null && flags !== oldFlags;
		flags ??= oldFlags;

		let append = text.includes(oldText);
		if (append && oldText.length === text.length && !flagsChanged)
			return;

		if (append && flagsChanged)
			append = (oldFlags & flags) === flags;

		this.#filter = text;
		this.#filterFlags = flags;
		this.#root.filter(text, flags, append);
	}

	select(path: string | (number | string)[], scrollTo?: boolean) {
		scrollTo ??= false;

		if (typeof path === "string")
			path = path.split("/");

		let i = 0;
		let baseProp: JsonProperty;
		if (path[0] !== "$") {
			if (this.#selected == null)
				return false;

			baseProp = this.#selected;
		} else if (path.length === 1) {
			const root = this.#root;
			this.setSelected(root, scrollTo, scrollTo);
			return true;
		} else {
			i++;
			baseProp = this.#root;
		}


		let base: JsonToken = baseProp.value;
		if (!(base instanceof JsonContainer))
			return false;

		while (true) {
			const key = path[i];
			const child = base.getProperty(key);
			if (child == null)
				return false;

			if (++i === path.length) {
				this.setSelected(child, scrollTo, scrollTo);
				return true;
			}

			if (!(child.value instanceof JsonContainer))
				return false;
			
			base = child.value;
		}
	}

	#onSelected(selected: JsonProperty, expand: boolean, scrollTo: boolean) {
		if (expand)
			for (let p: null | JsonToken = selected.value; p != null; p = p.parent)
				p.parentProperty.expanded = true;

		if (scrollTo)
			this.execute("scrollTo", selected);
	}
	
	setSelected(selected: null | JsonProperty, expand: boolean, scrollTo: boolean) {
		const old = this.#selected;
		if (old !== selected) {
			if (old)
				old.selected = false;

			if (selected) {
				selected.selected = true;
				this.#onSelected(selected, expand, scrollTo);
			}

			this.#selected = selected;
			this.#fireChange('selected', old, selected);
		} else if (old) {
			this.#onSelected(old, expand, scrollTo);
		}
	}

	#fireChange(prop: keyof ChangeProps, oldValue: any, newValue: any) {
		const ls = this.#propertyChange;
		if (ls.hasListeners) {
			const evt = new PropertyChangeEvent(this, "change", prop, oldValue, newValue);
			ls.fire(this, evt);
		}
	}
}