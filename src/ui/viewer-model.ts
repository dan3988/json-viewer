import { JsonContainer, type JsonToken } from "./json";
import { PropertyChangeEvent, type PropertyChangeHandler, type PropertyChangeHandlerTypes, type PropertyChangeNotifier } from "./prop";

interface ChangeProps {
	selected: null | JsonToken
}

export class ViewerModel implements PropertyChangeNotifier<ChangeProps> {
	readonly #root: JsonToken;
	readonly #listeners: PropertyChangeHandler[];
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

	constructor(root: JsonToken) {
		this.#root = root;
		this.#listeners = [];
		this.#selected = null;
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

	#fireChange(prop: string, oldValue: any, newValue: any) {
		const ls = this.#listeners;
		if (ls.length) {
			const evt = new PropertyChangeEvent(this, "change", prop, oldValue, newValue);
			for (let handler of ls)
				handler.call(this, evt);
		}
	}

	removeListener(handler: PropertyChangeHandlerTypes<this, ChangeProps>): void {
		const ls = this.#listeners;
		const i = ls.indexOf(handler);
		if (i >= 0)
			ls.splice(i, 1);
	}

	addListener(handler: PropertyChangeHandlerTypes<this, ChangeProps>): void {
		this.#listeners.push(handler);
	}
}