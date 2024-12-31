<script lang="ts">
	import type { CustomSchemeColorSet } from "./custom-scheme";
	import ColorSlider from "./ColorSlider.svelte";
	import ColorEditor from "./ColorEditor.svelte";

	export let value: CustomSchemeColorSet;
	export let disabled = false;

	$: ({ background, border, text, lightnessMod, saturationMod } = value);
</script>
<div class="root d-flex flex-column gap-1">
	<div class="input-group">
		<span class="input-group-text">Background</span>
		<ColorEditor {disabled} bind:value={$background} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Text</span>
		<button class="btn btn-base" on:click={() => $text = null}>Clear</button>
		<ColorEditor {disabled} bind:value={$text} />
	</div>
	<div class="d-flex flex-even gap-1">
		<div class="input-group">
			<span class="input-group-text">Border</span>
			<button class="btn btn-base" on:click={() => $border = null}>Clear</button>
			<ColorEditor {disabled} bind:value={$border} />
		</div>
	</div>
	<div class="input-group">
		<span class="input-group-text">Lightness</span>
		<ColorSlider {disabled} bind:value={$lightnessMod} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Saturation</span>
		<ColorSlider {disabled} bind:value={$saturationMod} />
	</div>
</div>
<style lang="scss">
	.input-group-text {
		width: unset;
		flex: 1 1 0;
	}
</style>