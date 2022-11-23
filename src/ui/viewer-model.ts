import type { JsonToken } from "./json";
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

	select(path: string[]) {
		const v = this.#root.resolve(path);
		if (v != null)
			this.selected = v;
	}

	#fireChange(prop: string, oldValue: any, newValue: any) {
		const ls = this.#listeners;
		if (ls.length) {
			const evt = new PropertyChangeEvent(this, prop, oldValue, newValue);
			for (let handler of ls)
				handler.call(this, evt);
		}
	}

	removeListener(handler: PropertyChangeHandler<any, this>) {
		const ls = this.#listeners;
		const i = ls.indexOf(handler);
		if (i >= 0)
			ls.splice(i, 1);
	}

	addListener(handler: PropertyChangeHandler<any, this>) {
		this.#listeners.push(handler);
	}
}