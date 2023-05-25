<script lang="ts" context="module">
	interface InputMode {
		preventInput(char: string, text: string, start: number, end: number): boolean;
		validate(value: string): undefined | string | number;
	}

	const decimal: InputMode = {
		preventInput(char, text) {
			if (char === ".") {
				return text.includes(".");
			} else {
				return char < '0' || char > '9';
			}
		},
		validate(value) {
			const v = Number(value);
			return isNaN(v) ? "Value is not a number" : v;
		}
	}

	const integer: InputMode = {
		preventInput(char) {
			return char < '0' || char > '9';
		},
		validate(value) {
			const v = Number(value);
			return isNaN(v) ? "Value is not a number" : Math.trunc(v);
		}
	}

	const inputModesRaw = { decimal, integer };
	const inputModes: Record<string, InputMode> = inputModesRaw;

	export type InputType = keyof typeof inputModesRaw;
</script>
<script lang="ts">
	export let type: InputType;
	export let value: number;
	export let min: number | undefined = undefined;
	export let max: number | undefined = undefined;
	export { klass as class };

	$: mode = inputModes[type];

	let klass: string;

	function onKeyDown(this: HTMLInputElement, evt: KeyboardEvent) {
		if (evt.code === "Escape") {
			evt.preventDefault();
			this.valueAsNumber = value;
			this.setCustomValidity("");
			this.blur();
		}
	}

	function onKeyPress(this: HTMLInputElement, evt: KeyboardEvent) {
		const { location, key } = evt;
		if (location !== 0)
			return;

		if (key !== "-" && mode.preventInput(key, this.value, this.selectionStart!, this.selectionEnd!))
			evt.preventDefault();
	}

	function onInput(this: HTMLInputElement) {
		const valid = mode.validate(this.value);
		if (typeof valid === "number")
			value = valid;

		this.setCustomValidity("");
	}

	function onFocusOut(this: HTMLInputElement, evt: UIEvent) {
		const valid = mode.validate(this.value);
		if (typeof valid === "number" && this.validity.valid) {
			value = valid;
			this.valueAsNumber = valid;
			this.setCustomValidity("");
		} else {
			this.setCustomValidity(typeof valid === "string" ? valid : "");
			this.reportValidity();
			evt.preventDefault();
		}
	}
</script>
<style lang="scss">

</style>
<input class={klass} {min} {max} type="number" inputmode="numeric" {value} on:keyup={onKeyDown} on:keypress={onKeyPress} on:input={onInput} on:focusout={onFocusOut} />