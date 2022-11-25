import { EventHandlers } from "./evt";
import { JsonContainer, type JsonToken } from "./json";
import { PropertyChangeEvent, type PropertyChangeHandlerTypes, type PropertyChangeNotifier } from "./prop";

interface ChangeProps {
	selected: null | JsonToken
}

export class ViewerModel implements PropertyChangeNotifier<ChangeProps> {
	readonly #root: JsonToken;
	readonly #propertyChange: EventHandlers<PropertyChangeHandlerTypes<ViewerModel, ChangeProps>>;
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

	constructor(root: JsonToken) {
		this.#root = root;
		this.#propertyChange = new EventHandlers();
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

	#fireChange(prop: keyof ChangeProps, oldValue: any, newValue: any) {
		const ls = this.#propertyChange;
		if (ls.length) {
			const evt = new PropertyChangeEvent(this, "change", prop, oldValue, newValue);
			ls.fire(this, [evt]);
		}
	}
}