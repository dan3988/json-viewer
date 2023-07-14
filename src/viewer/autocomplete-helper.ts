import type { ComponentProps } from "svelte";
import type { JsonToken } from "../json";
import SuggestionList from "./SuggestionList.svelte";
import Linq from "@daniel.pickett/linq-js";

export default class AutocompleteHelper {
	readonly #target: HTMLElement;
	readonly #setter: (value?: string) => void;
	#list: SuggestionList;
	#prop: null | JsonToken;

	get target() {
		return this.#target;
	}

	constructor(target: HTMLElement, setter: (value?: string) => void) {
		this.#target = target;
		this.#setter = setter;
		this.#list = new SuggestionList({ target });
		this.#list.$on("click", this.#onClick.bind(this));
		this.#prop = null;
	}

	handleKeyPress(evt: KeyboardEvent): boolean {
		switch (evt.key) {
			case "ArrowDown":
				this.next();
				return true;
			case "ArrowUp":
				this.prev();
				return true;
			case "Tab":
			case "Enter":
				this.complete();
				return true;
			case "Escape":
				this.cancel();
				return true;
		}

		return false;
	}

	update(prop: JsonToken, filter: string, changeProp?: boolean) {
		const props: Partial<ComponentProps<SuggestionList>> = { filter };
		if (this.#prop !== prop) {
			if (!changeProp)
				return false;

			this.#prop = prop;
			props.source = Linq(prop.properties()).select("key").select(String).toArray();
		}

		this.#list.$set(props);
		return true;
	}

	cancel() {
		this.#complete(undefined);
	}

	complete() {
		const selected = this.#list.getSelected();
		this.#complete(selected);
	}

	#complete(selected: undefined | string) {
		this.destroy();
		this.#setter.call(undefined, selected);
	}

	#onClick(arg: CustomEvent) {
		this.#complete(arg.detail.suggestion);
	}

	next() {
		this.#list.next();
	}

	prev() {
		this.#list.prev();
	}

	destroy() {
		this.#prop = null;
		this.#list.$destroy();
	}
}
