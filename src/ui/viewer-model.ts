import { EventHandlers } from "./evt";
import { JsonContainer, JsonProperty, JsonToken } from "./json";
import { PropertyChangeEvent, type PropertyChangeHandlerTypes, type PropertyChangeNotifier } from "./prop";

interface ChangeProps {
	selected: null | JsonProperty
}

export interface ViewerCommands {
	expandAll: [expand: boolean];
	expand: [tokens: ReadonlySet<JsonProperty>];
	scrollTo: [token: JsonProperty];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export type ViewerCommandEvent = { [P in keyof ViewerCommands]: { command: P, args: ViewerCommands[P] } }[keyof ViewerCommands];

export class ViewerModel implements PropertyChangeNotifier<ChangeProps> {
	readonly #root: JsonProperty;
	readonly #propertyChange: EventHandlers<PropertyChangeHandlerTypes<ViewerModel, ChangeProps>>;
	readonly #command: EventHandlers<ViewerCommandHandler<this>>;
	#selected: null | JsonProperty;
	
	get root() {
		return this.#root;
	}

	get selected() {
		return this.#selected;
	}

	set selected(value) {
		const old = this.#selected;
		if (old !== value) {
			this.#selected = value;
			this.#fireChange('selected', old, value);
		}
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
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.hasListeners)
			handlers.fire(this, <any>{ command, args });
	}

	select(path: string | (number | string)[], scroll?: boolean) {
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
			this.selected = root;

			if (scroll)
				this.execute("scrollTo", root);

			return true;
		} else {
			i++;
			baseProp = this.#root;
		}


		let base = baseProp.value;
		if (!(base instanceof JsonContainer))
			return false;

		while (true) {
			const key = path[i];
			const child = base.get(key);
			if (child == null)
				return false;

			if (++i === path.length) {
				this.selected = child;

				if (scroll) {
					const tree = new Set<JsonProperty>();
					for (let t = child; t != null; t = t.parent)
						tree.add(t);

					this.execute("expand", tree);
					this.execute("scrollTo", child);
				}

				return true;
			}

			if (!(child instanceof JsonContainer))
				return false;
			
			base = child;
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