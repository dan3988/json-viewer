import { EventHandlers } from "./evt";
import { JsonContainer, type JsonToken } from "./json";
import { PropertyChangeEvent, type PropertyChangeHandlerTypes, type PropertyChangeNotifier } from "./prop";

interface ChangeProps {
	selected: null | JsonToken
}

export interface ViewerCommands {
	expandAll: [expand: boolean];
}

export type ViewerCommandHandler<T = ViewerModel> = Fn<[evt: ViewerCommandEvent], void, T>;

export interface ViewerCommandEvent<K extends keyof ViewerCommands = keyof ViewerCommands> {
	command: K;
	args: ViewerCommands[K];
}

export class ViewerModel implements PropertyChangeNotifier<ChangeProps> {
	readonly #root: JsonToken;
	readonly #propertyChange: EventHandlers<PropertyChangeHandlerTypes<ViewerModel, ChangeProps>>;
	readonly #command: EventHandlers<ViewerCommandHandler<this>>;
	#selected: JsonToken;
	
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

	constructor(root: JsonToken) {
		this.#root = root;
		this.#propertyChange = new EventHandlers();
		this.#command = new EventHandlers();
		this.#selected = null;
	}

	execute<K extends keyof ViewerCommands>(command: K, ...args: ViewerCommands[K]) {
		const handlers = this.#command;
		if (handlers.length)
			handlers.fire(this, { command, args });
	}

	select(path: (number | string)[]) {
		let i = 0;
		let base: JsonToken;
		if (path[0] !== "$") {
			base = this.#selected;
		} else {
			i++;
			base = this.#root;
		}

		if (!(base instanceof JsonContainer))
			return false;

		while (true) {
			const key = path[i];
			const child = base.get(key);
			if (child == null)
				return false;

			if (++i === path.length) {
				this.selected = child;
				return true;
			}

			if (!(child instanceof JsonContainer))
				return false;
			
			base = child;
		}
	}

	#fireChange(prop: keyof ChangeProps, oldValue: any, newValue: any) {
		const ls = this.#propertyChange;
		if (ls.length) {
			const evt = new PropertyChangeEvent(this, "change", prop, oldValue, newValue);
			ls.fire(this, evt);
		}
	}
}