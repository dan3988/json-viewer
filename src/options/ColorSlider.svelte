<script lang="ts">
	interface Props {
		min?: number;
		max?: number;
		value: number;
		readonly?: false;
		disabled?: false;
		onchange?: Consumer<number>;
	}

	let {
		min = 0,
		max = 100,
		value = $bindable(),
		readonly = false,
		disabled = false,
		onchange
	}: Props = $props();

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
<input type="range" class="form-control" class:readonly {disabled} {min} {max} {value} oninput={onRangeInput} />
<input type="number" class="form-control" class:readonly {disabled} {min} {max} value={Math.round(value)} onchange={onNumberInput} />
<style lang="scss">
	input[type="range"].readonly {
		pointer-events: none;
	}
</style>