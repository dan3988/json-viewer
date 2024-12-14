<script lang="ts" context="module">
	import type { NamedRadioItem } from "./Radio.svelte";

	const radioMenuAlign: NamedRadioItem<"l" | "r">[] = [["l", "Left"], ["r", "Right"]];
	const radioTheme: NamedRadioItem<boolean | null>[] = [[null, "Auto"], [false, "Light"], [true, "Dark"]];
</script>
<script lang="ts">
	import type preferences from "../preferences-lite";
	import type EditorModel from "./editor";
	import type ThemeTracker from "../theme-tracker";
	import schemes from "../schemes";
	import Radio from "./Radio.svelte";
	import ViewerPreview from "./ViewerPreview.svelte";

	export let model: EditorModel<preferences.lite.Bag>;
	export let maxIndentClass: number;

	$: ({ changed, props: { darkMode, scheme, menuAlign, background } } = model);
</script>
<div class="root">
	<div class="options">
		<div class="input-group hoverable-radio grp-menu-align" role="group" class:dirty={$changed.includes('menuAlign')}>
			<span class="input-group-text">Menu Alignment</span>
			<Radio class="flex-fill btn btn-base" items={radioMenuAlign} bind:value={$menuAlign}></Radio>
		</div>
		<div class="input-group hoverable-radio grp-theme" role="group" class:dirty={$changed.includes('darkMode')}>
			<span class="input-group-text">Theme</span>
			<Radio class="flex-fill btn btn-base" items={radioTheme} bind:value={$darkMode}/>
		</div>
		<div class="input-group grp-json-bg">
			<span class="input-group-text">Background</span>
			<select class="form-select flex-fill" class:dirty={$changed.includes('background')} bind:value={$background}>
				<option value="">None</option>
				<option value="bricks">Bricks</option>
				<option value="cubes">Cubes</option>
				<option value="cross">Cross</option>
				<option value="hive">Honeycomb</option>
				<option value="plaid">Plaid</option>
				<option value="tiles">Tiles</option>
				<option value="triangles">Triangles</option>
				<option value="web">Web</option>
			</select>
		</div>
		<div class="input-group grp-json-style">
			<span class="input-group-text">Colour Scheme</span>
			<select class="form-select flex-fill" class:dirty={$changed.includes('scheme')} bind:value={$scheme}>
				{#each schemes.groupedPresets as [ label, values ]}
					{#if values.length}
						<optgroup {label}>
							{#each values as [ value, name ]}
								<option {value}>{name}</option>
							{/each}
						</optgroup>
					{/if}
				{/each}
			</select>
		</div>
	</div>
	<div class="preview-wrapper border rounded">
		<div class="editor-bg"></div>
		<div class="overflow-auto p-1">
			<ViewerPreview {maxIndentClass} />
		</div>
	</div>
</div>
<style lang="scss">
	$breakpoint-lg: 960px;

	@media only screen and (max-width: $breakpoint-lg) {
		.root {
			--start-flex: 0 0 auto;
			flex-direction: column;
		}
	}

	@media only screen and (min-width: $breakpoint-lg) {
		.root {
			--start-flex: 0 0 500px;
			flex-direction: row;
		}
	}
	
	.root {
		flex: 1 1 auto;
		padding: var(--padding);
		display: flex;
		gap: var(--padding);
	}

	.options {
		flex: 1 1 0;
		display: flex;
		gap: var(--padding);
		flex: var(--start-flex);
		flex-direction: column;
	}

	.preview-wrapper {
		overflow: hidden;
		flex: 1 1 0px;
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.editor-bg {
		position: absolute;
		pointer-events: none;
		inset: 0;
	}

	.input-group-text {
		flex: 0 0 9.5rem;
	}
</style>