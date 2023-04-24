type ThemeChangedListener = (dark: boolean, overriden: boolean) => void;

export class ThemeTracker {
	readonly #listeners: ThemeChangedListener[];
	readonly #root;
	readonly #rule;
	#value: null | boolean;

	get isOverridden() {
		return this.#value != null;
	}

	get preferDark() {
		return this.#value ?? this.#rule.matches;
	}

	set preferDark(value: null | boolean) {
		if (this.#value !== value) {
			this.#value = value;
			this.#fireChange();
		}
	}

	constructor(root: HTMLElement, initialValue: null | boolean = null) {
		this.#listeners = [];
		this.#root = root;
		this.#rule = matchMedia("(prefers-color-scheme: dark)");
		this.#onRuleChange = this.#onRuleChange.bind(this);
		this.#rule.addEventListener("change", this.#onRuleChange);
		this.#value = initialValue;
		this.#fireChange();
	}

	destroy() {
		this.#rule.removeEventListener("change", this.#onRuleChange);
	}

	addListener(listener: ThemeChangedListener) {
		this.#listeners.push(listener);
	}

	#fireChange() {
		const [value, overridden] = this.#value == null ? [this.#rule.matches, false] : [this.#value, true];
		this.#root.setAttribute("data-bs-theme", value ? "dark" : "light");
		this.#listeners.forEach(v => v(value, overridden));
	}

	#onRuleChange = function(this: ThemeTracker) {
		if (this.#value === null)
			this.#fireChange();
	}
}

export default ThemeTracker;