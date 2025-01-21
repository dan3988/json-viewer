<script lang="ts" context="module">
	export type NamedRadioItem<T> = [value: T, text: string];

	const radioMenuAlign: NamedRadioItem<"l" | "r">[] = [["l", "Left"], ["r", "Right"]];
	const radioTheme: NamedRadioItem<boolean | null>[] = [[null, "Auto"], [false, "Light"], [true, "Dark"]];
</script>
<script lang="ts">
	import { CustomScheme } from "./custom-scheme";
	import type preferences from "../preferences-lite";
	import type EditorModel from "./editor";
	import type ThemeTracker from "../theme-tracker";
	import schemes from "../schemes";
	import Radio from "../shared/Radio.svelte";
	import ViewerPreview from "./ViewerPreview.svelte";
	import ColorSchemeEditor from "./ColorSchemeEditor.svelte";

	export let model: EditorModel<preferences.lite.Bag>;
	export let tracker: ThemeTracker;
	export let maxIndentClass: number;
	export let schemeEditor: CustomScheme;

	$: ({ changed, props: { darkMode, scheme, menuAlign, background, customSchemes } } = model);

	$: customSchemeList = Object.entries($customSchemes);

	function copyScheme() {
		const copy = structuredClone(schemeEditor.scheme.value);
		const id = crypto.randomUUID().replaceAll('-', '');
		copy.name = copy.name + " (Copy)";
		customSchemes.set({ ...customSchemes.value, [id]: copy as any });
		schemeEditor = new CustomScheme(copy);
		scheme.set(id);
	}

	function removeScheme() {
		const copy = { ...$customSchemes };
		delete copy[$scheme];
		let nextScheme = 'default';
		if (customSchemeList.length > 1) {
			const index =  customSchemeList.findIndex(([key]) => key === scheme.value);
			const keys = Object.keys(copy);
			nextScheme = keys[Math.max(0, index - 1)];
		}

		scheme.set(nextScheme);
		customSchemes.set(copy as any);
	}
</script>
<div class="root overflow-hidden">
	<div class="options">
		<div class="input-group hoverable-radio grp-menu-align" role="group" class:dirty={$changed.includes('menuAlign')}>
			<span class="input-group-text">Menu Alignment</span>
			<Radio converter={v => v[0]} items={radioMenuAlign} bind:value={$menuAlign}>
				<label slot="label" let:id let:item={[_, text]} for={id} class="flex-fill btn btn-base">{text}</label>
			</Radio>
		</div>
		<div class="input-group hoverable-radio grp-theme" role="group" class:dirty={$changed.includes('darkMode')}>
			<span class="input-group-text">Theme</span>
			<Radio converter={v => v[0]} items={radioTheme} bind:value={$darkMode}>
				<label slot="label" let:id let:item={[_, text]} for={id} class="flex-fill btn btn-base">{text}</label>
			</Radio>
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
				{#if customSchemeList.length}
					<optgroup label="Custom">
						{#each customSchemeList as [ id, scheme ]}
							<option value={id}>{scheme.name}</option>
						{/each}
					</optgroup>
				{/if}
			</select>
			<button class="btn btn-base" on:click={copyScheme}>Copy</button>
		</div>
		<div class="scheme-editor flex-fill border rounded p-1 overflow-y-scroll" class:blur={!($scheme in $customSchemes)}>
			<ColorSchemeEditor darkMode={$tracker} scheme={schemeEditor} remove={removeScheme} />
		</div>
	</div>
	<div class="preview-wrapper border rounded">
		<div class="editor-bg"></div>
		<div class="preview overflow-auto p-1">
			<ViewerPreview {maxIndentClass} />
		</div>
	</div>
</div>
<style lang="scss">
	$breakpoint: 960px;

	@media only screen and (max-width: $breakpoint) {
		.root {
			--start-flex: 0 0 auto;
			flex-direction: column;
		}
	}

	@media only screen and (min-width: $breakpoint) {
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

	.scheme-editor.blur {
		opacity: 0.75;
		pointer-events: none;
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

	.preview {
		z-index: 1;
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