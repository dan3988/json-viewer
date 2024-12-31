<script lang="ts" context="module">
	const transparent: Color = Color('#00000000');
</script>
<script lang="ts">
	import type { CustomScheme } from "./custom-scheme";
	import Color from "color";
	import ColorEditor from "./ColorEditor.svelte";
	import ColorSetEditor from "./ColorSetEditor.svelte";

	export let darkMode: boolean;
	export let disabled = false;
	export let scheme: CustomScheme;
	export let remove: Action;

	$: values = scheme.getValues(darkMode);
	$: name = scheme.name;
	$: ({ key, keyword, str, num, text, background, indents, primary, tertiary } = values);

	function addIndent(value = Color.rgb(0, 0, 0)) {
		values.indents.update(v => {
			v.push(value);
			return v;
		});
	}

	function setIndent(index: number, value: Color) {
		values.indents.update(v => {
			v[index] = value;
			return v;
		});
	}

	function removeIndent(index: number) {
		values.indents.update(v => {
			v.splice(index, 1);
			return v;
		});
	}
</script>
<div class="root d-flex flex-column gap-1 align-items-strech">
	<div class="input-group">
		<span class="input-group-text">Name</span>
		<input type="text" class="form-control" bind:value={$name} />
		<button class="btn btn-base bi-trash-fill" title="Delete" on:click={remove}></button>
	</div>
	<div class="input-group">
		<span class="input-group-text">Key</span>
		<ColorEditor {disabled} bind:value={$key} />
	</div>
	<div class="input-group">
		<span class="input-group-text">String</span>
		<ColorEditor {disabled} bind:value={$str} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Number</span>
		<ColorEditor {disabled} bind:value={$num} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Keyword</span>
		<ColorEditor {disabled} bind:value={$keyword} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Text</span>
		<ColorEditor {disabled} bind:value={$text} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Background</span>
		<ColorEditor {disabled} bind:value={$background} />
	</div>
	<span class="h5 text-center">Primary</span>
	<ColorSetEditor {disabled} value={primary} />
	<span class="h5 text-center">Tertiary</span>
	<ColorSetEditor {disabled} value={tertiary} />
	<span class="h5 text-center">Indents</span>
	<ul class="d-flex flex-column gap-1 m-0 p-0">
		{#each $indents as value, i}
			<li class="input-group">
				<span class="input-group-text">#{i + 1}</span>
				<ColorEditor {disabled} {value} onchange={v => setIndent(i, v)} />
				<button disabled={disabled || $indents.length === 1} class="btn btn-base bi-trash-fill" on:click={() => removeIndent(i)} title="Delete" />
			</li>
		{/each}
	</ul>
	<button class="btn btn-primary" on:click={() => addIndent()}>Add<i class="bi-plus"></i></button>
</div>
<style lang="scss">
	.root {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
		grid-auto-columns: min-content;
		grid-auto-flow: row;
	}

	.input-group > .input-group-text {
		flex: 1 1 0;
	}

	.h5 {
		margin: .25rem 0;
	}
</style>