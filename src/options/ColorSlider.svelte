<script lang="ts">
	export let min = -100;
	export let max = 100;
	export let value: number;
	export let readonly = false;
	export let disabled = false;
</script>
<input type="range" class="form-control" class:readonly {disabled} {min} {max} bind:value />
<input type="number" class="form-control" class:readonly {disabled} {min} {max} bind:value />
<style lang="scss">
	input[type="range"].readonly {
		pointer-events: none;
	}
</style>