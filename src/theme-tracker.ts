import type { Subscriber, Unsubscriber } from "svelte/store";
import Store, { StoreListeners } from "./store";

export class ThemeTracker extends Store<boolean> {
	readonly #listeners;
	readonly #onRuleChange;
	readonly #rule;
	#preferDark: null | boolean;
	#value: boolean;

	get isOverridden() {
		return this.#value != null;
	}

	get value() {
		return this.#value ?? this.#rule.matches;
	}

	get preferDark() {
		return this.#preferDark;
	}

	set preferDark(value: null | boolean) {
		if (this.#preferDark !== value) {
			this.#preferDark = value;
			this.#update();
		}
	}

	constructor(initialValue: null | boolean = null) {
		super();
		this.#listeners = new StoreListeners<boolean>();
		this.#onRuleChange = this.#update.bind(this);
		this.#rule = matchMedia("(prefers-color-scheme: dark)");
		this.#rule.addEventListener("change", this.#onRuleChange);
		this.#preferDark = initialValue;
		this.#value = initialValue ?? this.#rule.matches;
	}

	listen(listener: Subscriber<boolean>, invalidate?: Action): Unsubscriber {
		return this.#listeners.listen(listener, invalidate);
	}

	#update() {
		const preferDark = this.#preferDark;
		const value = preferDark ?? this.#rule.matches;
		if (this.#value !== value) {
			this.#value = value;
			this.#listeners.fire(value);
		}
	}

	dispose() {
		this.#rule.removeEventListener("change", this.#onRuleChange);
	}
}

export default ThemeTracker;