<script lang="ts" context="module">
	type NamedRadioItem<T> = [value: T, text: string];

	const radioMenuAlign: NamedRadioItem<"l" | "r">[] = [["l", "Left"], ["r", "Right"]];
	const radioTheme: NamedRadioItem<boolean | null>[] = [[null, "Auto"], [false, "Light"], [true, "Dark"]];
</script>
<script lang="ts">
	import type preferences from "../preferences-lite";
	import type EditorModel from "./editor";
	import type ThemeTracker from "../theme-tracker";
	import { CustomScheme } from "./custom-scheme";
	import schemes from "../schemes";
	import Radio from "../shared/Radio.svelte";
	import ViewerPreview from "./ViewerPreview.svelte";
	import ColorSchemeEditor from "./ColorSchemeEditor.svelte";

	export let model: EditorModel<preferences.lite.Bag>;
	export let tracker: ThemeTracker;
	export let maxIndentClass: number;
	export let schemeEditor: CustomScheme;

	$: ({ changed, props: { darkMode, schemeDark, schemeLight, menuAlign, background, customSchemes } } = model);
	$: [presets, scheme] = $tracker ? [schemes.entries.dark, schemeDark] : [schemes.entries.light, schemeLight];
	$: customSchemeList = schemes.getCustomEntries($customSchemes, $tracker);
	$: isCustomScheme = $scheme in $customSchemes;

	function copyScheme() {
		const suffix = isCustomScheme ? 'Copy' : 'Custom';
		const copy = structuredClone(schemeEditor.scheme.value);
		const id = crypto.randomUUID().replaceAll('-', '');
		copy.name = `${copy.name} (${suffix})`;
		customSchemes.set({ ...customSchemes.value, [id]: copy as any });
		schemeEditor = new CustomScheme(copy);
		scheme.set(id);
	}

	function removeScheme() {
		const copy = { ...$customSchemes };
		delete copy[$scheme];
		let nextScheme = $tracker ? 'default_dark' : 'default_light';
		if (customSchemeList.length > 1) {
			const index =  customSchemeList.findIndex(({ id }) => id === scheme.value);
			nextScheme = customSchemeList[index == 0 ? 1 : index - 1].id;
		}

		scheme.set(nextScheme);
		customSchemes.set(copy as any);
	}
</script>
<div class="root">
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
			<select class="form-select flex-fill" bind:value={$scheme}>
				<optgroup label="Presets">
					{#each presets as { id, name }}
						<option value={id}>{name}</option>
					{/each}
				</optgroup>
				{#if customSchemeList.length}
					<optgroup label="Custom">
						{#each customSchemeList as { id, name }}
							<option value={id}>{name}</option>
						{/each}
					</optgroup>
				{/if}
			</select>
			<button class="btn btn-base copy-button" on:click={copyScheme}>
				{#if isCustomScheme}
					Copy
				{:else}
					Customize
				{/if}
			</button>
		</div>
		<div class="scheme-editor-wrapper">
			<div class="scheme-editor" class:blur={!isCustomScheme}>
				<ColorSchemeEditor scheme={schemeEditor} remove={removeScheme} />
			</div>
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
			--preview-flex: 0 0 30rem;
			flex-direction: column;
			overflow-y: scroll;
		}
	}

	@media only screen and (min-width: $breakpoint) {
		.root {
			--start-flex: 0 0 500px;
			--preview-flex: 1 1 0px;
			flex-direction: row;
			overflow-y: hidden;
		}
	}

	.root {
		flex: 1 1 auto;
		padding: var(--padding);
		display: flex;
		gap: var(--padding);
		overflow-x: hidden;
	}

	.scheme-editor-wrapper {
		overflow-y: auto;
	}

	.scheme-editor.blur {
		opacity: 0.5;
		pointer-events: none;
		user-select: none;
	}

	.options {
		flex: 1 1 0;
		display: flex;
		gap: var(--padding);
		flex: var(--start-flex);
		flex-direction: column;
	}

	.preview-wrapper {
		font-family: monospace;
		font-size: 12px;
		overflow: hidden;
		flex: var(--preview-flex);
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

	.copy-button {
		width: 7.5rem;
	}
</style>