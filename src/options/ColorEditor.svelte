<script lang="ts">
	import Color from "color";

	export let value: null | Color = null;
	export let onchange: undefined | ((value: Color) => void) = undefined;
	export let readonly = false;
	export let disabled = false;

	$: hex = value && value.hex();

	function onColorInput(this: HTMLInputElement) {
		value = Color(this.value);
		hex = value.hex();
		onchange?.(value);
	}

	function onTextFocusOut(this: HTMLInputElement) {
		try {
			value = Color(this.value);
		} catch (e) {
			return;
		}

		onchange?.(value);
	}
</script>
<input type="color" class="form-control" class:empty={!value} class:readonly {disabled} value={hex} on:input={onColorInput} />
<input type="text" class="form-control" value={hex ?? ''} {readonly} {disabled} on:focusout={onTextFocusOut} />
<style lang="scss">
	input {
		height: calc(2.25rem + (var(--bs-border-width) * 2));
	}

	input[type="color"] {
		flex: 0 0 3rem !important;

		&.empty::-webkit-color-swatch {
			display: none;
		}

		&.readonly {
			pointer-events: none;
		}
	}

	input[type="text"] {
		flex: 0 0 6rem !important;
	}
</style>