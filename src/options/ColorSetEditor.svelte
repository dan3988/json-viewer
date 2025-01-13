<script lang="ts">
	import type { CustomSchemeColorSet, SetColors } from "./custom-scheme";
	import type { WritableStore } from "../store";
	import ColorEditor from "./ColorEditor.svelte";

	export let value: CustomSchemeColorSet;
	export let previewClass: string;

	let tab: 0 | 1 | 2 = 0;

	$: ({ background, border, text } = value);
	$: ({ active, def, hov, act } = [background, text, border][tab] as (SetColors & { active?: WritableStore<boolean> }));
</script>
<div class="root d-flex flex-column gap-1">
	<div class="btn-group flex-even">
		<button class="btn btn-base" class:active={tab === 0} on:click={() => tab = 0}>Background</button>
		<button class="btn btn-base" class:active={tab === 1} on:click={() => tab = 1}>Text</button>
		<button class="btn btn-base" class:active={tab === 2} on:click={() => tab = 2}>Border</button>
	</div>
	{#if active}
		<div class="input-group">
			<label class="input-group-text flex-fill align-items-start gap-1">
				<input class="form-check-input" type="checkbox" bind:checked={$active}/>
				Active
			</label>
		</div>
	{/if}
	<div class="input-group">
		<span class="input-group-text">Normal</span>
		<ColorEditor disabled={active && !$active} bind:value={$def} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Hover</span>
		<ColorEditor disabled={active && !$active} bind:value={$hov} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Active</span>
		<ColorEditor disabled={active && !$active} bind:value={$act} />
	</div>
	<div class="color-preview d-flex flex-even gap-1">
		<span class="btn {previewClass}">Normal</span>
		<span class="btn {previewClass} force-hover">Hover</span>
		<span class="btn {previewClass} force-active">Active</span>
	</div>
</div>
<style lang="scss">
	.input-group-text {
		flex: 1 1 0;
	}

	.color-preview {
		pointer-events: none;
	}
</style>