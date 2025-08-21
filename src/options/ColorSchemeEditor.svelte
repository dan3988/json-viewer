<script lang="ts">
	import type { CustomScheme } from "./custom-scheme";
	import Color from "color";
	import ColorEditor from "./ColorEditor.svelte";
	import ColorSetEditor from "./ColorSetEditor.svelte";

	export let scheme: CustomScheme;
	export let remove: Action;

	$: ({ name, key, keyword, str, num, text, background, indents, primary, tertiary } = scheme);

	function addIndent(value = Color.rgb(0, 0, 0)) {
		scheme.indents.update(v => {
			v.push(value);
			return v;
		});
	}

	function setIndent(index: number, value: Color) {
		scheme.indents.update(v => {
			v[index] = value;
			return v;
		});
	}

	function removeIndent(index: number) {
		scheme.indents.update(v => {
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
	<div class="main-colors">
		<div class="input-group">
			<span class="input-group-text">Text</span>
			<ColorEditor bind:value={$text} />
		</div>
		<div class="input-group">
			<span class="input-group-text">Background</span>
			<ColorEditor bind:value={$background} />
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
	</div>
	<div class="border rounded p-1">
		<ColorSetEditor title="Primary" value={primary} previewClass="btn-primary" />
	</div>
	<div class="border rounded p-1">
		<ColorSetEditor title="Tertiary" value={tertiary} previewClass="btn-base" />
	</div>
	<div class="border rounded p-1 d-flex flex-column gap-1">
		<div class="indents-header">
			<span class="h5 text-center">Indents</span>
			<button class="btn btn-faded p-1" class:disabled={$indents.length >= 10} on:click={() => addIndent()}>
				<i class="bi-plus-lg"></i>
			</button>
		</div>
		<ul class="indents-list gap-1 m-0 p-0">
			{#each $indents as value, i}
				<li class="input-group">
					<span class="input-group-text">#{i + 1}</span>
					<ColorEditor {value} onchange={v => setIndent(i, v)} />
					<button disabled={$indents.length === 1} class="btn btn-base bi-trash-fill" on:click={() => removeIndent(i)} title="Delete" />
				</li>
			{/each}
		</ul>
	</div>
</div>
<style lang="scss">
	.main-colors,
	.indents-list {
		--color-editor-text-flex: 0 0 5rem;
	}

	.main-colors {
		display: grid;
		gap: inherit;
		grid-auto-flow: row;
		//grid-template-columns: var(--color-grid-rows);
		grid-template-columns: repeat(auto-fill, minmax(14.8rem, 1fr));
	}

	.input-group > .input-group-text {
		flex: 1 1 0;
	}

	.indents-header {
		display: grid;
		grid-template-columns: 2rem 1fr 2rem;

		&::before {
			content: "";
		}
	}

	.indents-list {
		display: grid;
		grid-template-rows: repeat(5, 1fr);
		grid-template-columns: 1fr 1fr;
		//height: calc((2.25rem * 5) + (var(--bs-border-width) * 10) + (var(--padding) * 4));
	}

	.h5 {
		margin: .25rem 0;
	}
</style>