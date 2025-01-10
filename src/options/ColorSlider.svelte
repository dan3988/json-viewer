<script lang="ts">
	export let min = 0;
	export let max = 100;
	export let value: number;
	export let readonly = false;
	export let disabled = false;
	export let onchange: undefined | ((value: number) => void) = undefined;

	function onRangeInput(this: HTMLInputElement) {
		value = this.valueAsNumber;
		onchange?.(value);
	}

	function onNumberInput(this: HTMLInputElement) {
		const v = this.valueAsNumber;
		if (v <= min) {
			value = min;
		} else if (v >= max) {
			value = max;
		} else {
			value = v;
		}

		onchange?.(value);
	}
</script>
<input type="range" class="form-control" class:readonly {disabled} {min} {max} {value} on:input={onRangeInput} />
<input type="number" class="form-control" class:readonly {disabled} {min} {max} value={Math.round(value)} on:change={onNumberInput} />
<style lang="scss">
	input[type="range"].readonly {
		pointer-events: none;
	}
</style>