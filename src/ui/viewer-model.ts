import { JsonContainer, type JsonToken } from "./json";
import { PropertyChangeEvent, type PropertyChangeHandler } from "./prop";



export class ViewerModel {
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

	removeListener(handler: PropertyChangeHandler<any, any, this>) {
		const ls = this.#listeners;
		const i = ls.indexOf(handler);
		if (i >= 0)
			ls.splice(i, 1);
	}

	addListener(handler: PropertyChangeHandler<any, any, this>) {
		this.#listeners.push(handler);
	}
}