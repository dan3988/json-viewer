import type { Readable, Subscriber } from "svelte/store";

type ThemeChangedListener = (dark: boolean, preference: boolean | null) => void;

export class ThemeTracker implements Readable<boolean> {
	readonly #onRuleChange = this.#update.bind(this);
	readonly #listeners: ThemeChangedListener[];
	readonly #root;
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

	constructor(root: HTMLElement, initialValue: null | boolean = null) {
		this.#listeners = [];
		this.#root = root;
		this.#rule = matchMedia("(prefers-color-scheme: dark)");
		this.#onRuleChange = this.#onRuleChange.bind(this);
		this.#rule.addEventListener("change", this.#onRuleChange);
		this.#preferDark = initialValue;
		this.#value = undefined!;
		this.#setValueCore(this.#preferDark ?? this.#rule.matches)
	}

	#setValueCore(value: boolean) {
		this.#value = value;
		this.#root.setAttribute("data-bs-theme", value ? "dark" : "light");
	}

	#update() {
		const preferDark = this.#preferDark;
		const value = preferDark ?? this.#rule.matches;
		if (this.#value !== value) {
			this.#setValueCore(value);
			this.#listeners.forEach(v => v(value, preferDark));
		}
	}

	#unsubscribe(listener: any) {
		const i = this.#listeners.indexOf(listener);
		if (i >= 0)
			this.#listeners.splice(i, 1);
	}

	destroy() {
		this.#rule.removeEventListener("change", this.#onRuleChange);
	}

	addListener(listener: ThemeChangedListener) {
		this.#listeners.push(listener);
	}

	subscribe(listener: Subscriber<boolean>) {
		listener(this.#value);
		this.#listeners.push(listener);
		return this.#unsubscribe.bind(this, listener);
	}
}

export default ThemeTracker;