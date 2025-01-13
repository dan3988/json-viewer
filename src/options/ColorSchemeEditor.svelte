<script lang="ts">
	import type { CustomScheme } from "./custom-scheme";
	import Color from "color";
	import ColorEditor from "./ColorEditor.svelte";
	import ColorSetEditor from "./ColorSetEditor.svelte";

	export let darkMode: boolean;
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
<div class="d-flex flex-column gap-1 align-items-strech">
	<div class="input-group">
		<span class="input-group-text">Name</span>
		<input type="text" class="form-control" bind:value={$name} />
		<button class="btn btn-base bi-trash-fill" title="Delete" on:click={remove}></button>
	</div>
	<div class="input-group">
		<span class="input-group-text">Key</span>
		<ColorEditor bind:value={$key} />
	</div>
	<div class="input-group">
		<span class="input-group-text">String</span>
		<ColorEditor bind:value={$str} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Number</span>
		<ColorEditor bind:value={$num} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Keyword</span>
		<ColorEditor bind:value={$keyword} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Text</span>
		<ColorEditor bind:value={$text} />
	</div>
	<div class="input-group">
		<span class="input-group-text">Background</span>
		<ColorEditor bind:value={$background} />
	</div>
	<span class="h5 text-center">Primary</span>
	<ColorSetEditor value={primary} previewClass="btn-primary" />
	<span class="h5 text-center">Tertiary</span>
	<ColorSetEditor value={tertiary} previewClass="btn-base" />
	<span class="h5 text-center">Indents</span>
	<ul class="d-flex flex-column gap-1 m-0 p-0">
		{#each $indents as value, i}
			<li class="input-group">
				<span class="input-group-text">#{i + 1}</span>
				<ColorEditor {value} onchange={v => setIndent(i, v)} />
				<button disabled={$indents.length === 1} class="btn btn-base bi-trash-fill" on:click={() => removeIndent(i)} title="Delete" />
			</li>
		{/each}
	</ul>
	<button class="btn btn-primary" on:click={() => addIndent()}>Add<i class="bi-plus"></i></button>
</div>
<style lang="scss">
	.input-group > .input-group-text {
		flex: 1 1 0;
	}

	.h5 {
		margin: .25rem 0;
	}
</style>