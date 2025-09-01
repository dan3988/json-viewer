<script lang="ts">
	import type { CustomSchemeColorSet } from "./custom-scheme";
	import ColorEditor from "./ColorEditor.svelte";

	export let title: string;
	export let value: CustomSchemeColorSet;
	export let previewClass: string;

	$: ({ background, border, text } = value);
	$: ({ def: bgDef, hov: bgHov, act: bgAct  } = background);
	$: ({ def: txtDef, hov: txtHov, act: txtAct, active: txtEnabled } = text);
	$: ({ def: bdDef, hov: bdHov, act: bdAct, active: bdEnabled } = border);
</script>
<div class="root gap-1">
	<span class="title">{title}</span>
	<span class="preview-button btn {previewClass}">Normal</span>
	<span class="preview-button btn {previewClass} force-hover">Hover</span>
	<span class="preview-button btn {previewClass} force-active">Active</span>
	<span class="subtitle">Background</span>
	<div class="input-group">
		<ColorEditor bind:value={$bgDef} />
	</div>
	<div class="input-group">
		<ColorEditor bind:value={$bgHov} />
	</div>
	<div class="input-group">
		<ColorEditor bind:value={$bgAct} />
	</div>
	<label class="subtitle">
		<span>Text</span>
		<input type="checkbox" class="form-check-input" bind:checked={$txtEnabled}/>
	</label>
	<div class="input-group">
		<ColorEditor disabled={!$txtEnabled} bind:value={$txtDef} />
	</div>
	<div class="input-group">
		<ColorEditor disabled={!$txtEnabled} bind:value={$txtHov} />
	</div>
	<div class="input-group">
		<ColorEditor disabled={!$txtEnabled} bind:value={$txtAct} />
	</div>
	<label class="subtitle">
		<span>Border</span>
		<input type="checkbox" class="form-check-input" bind:checked={$bdEnabled}/>
	</label>
	<div class="input-group">
		<ColorEditor disabled={!$bdEnabled} bind:value={$bdDef} />
	</div>
	<div class="input-group">
		<ColorEditor disabled={!$bdEnabled} bind:value={$bdHov} />
	</div>
	<div class="input-group">
		<ColorEditor disabled={!$bdEnabled} bind:value={$bdAct} />
	</div>
</div>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		display: grid;
		grid-template-columns: 6rem repeat(3, 1fr);
		grid-template-rows: rpeat(4, auto);
	}

	.title, .subtitle {
		margin: $pad-med;
		display: flex;
		align-items: center;
	}

	.title {
		font-size: 1.25rem;
		font-weight: 500;
		display: flex;
		justify-content: center;
	}

	.subtitle {
		display: flex;
		justify-content: stretch;

		@at-root label#{&} {
			cursor: pointer;

			> input[type="checkbox"] {
				cursor: pointer;
			}
		}

		> span {
			flex: 1 1 0;
		}
	}

	.input-group-text {
		flex: 1 1 0;
	}

	.color-input {
		display: flex;
	}

	.preview-button {
		pointer-events: none;
	}
</style>