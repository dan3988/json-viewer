<script lang="ts">
	import type { CustomScheme } from "./custom-scheme";
	import Color from "color";
	import ColorEditor from "./ColorEditor.svelte";
	import ColorSetEditor from "./ColorSetEditor.svelte";

	export let scheme: CustomScheme;
	export let remove: Action;

	$: ({ name, key, keyword, str, num, text, background, indents, primary, tertiary } = scheme);

	function addIndent() {
		scheme.indents.update(v => {
			v.push(scheme.indents.value.at(-1) ?? Color.rgb(0, 0, 0));
			return v;
		});
	}

	function setIndent(index: number, value: Color) {
		scheme.indents.update(v => {
			v[index] = value;
			return v;
		});
	}

	function removeIndent() {
		scheme.indents.update(v => {
			v.pop();
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
	<div class="input-group indents-title">
		<span class="input-group-text">Indents</span>
		<button class="btn btn-base bi-dash-lg" class:disabled={$indents.length <= 1} title="Remove Indent" on:click={() => removeIndent()}></button>
		<input class="form-control" readonly value={$indents.length} />
		<button class="btn btn-base bi-plus-lg" class:disabled={$indents.length >= 10} title="Add Indent" on:click={() => addIndent()}></button>
		</div>
	<ul class="indents-list btn-group">
		{#each $indents as value, i}
			<li class="indent-color btn btn-base" style:background={value.toString()}>
				<input type="color" value={value.hex()} on:input={(e) => setIndent(i, Color(e.currentTarget.value))} />
			</li>
		{/each}
	</ul>
</div>
<style lang="scss">
	@use '../core.scss' as *;

	.main-colors {
		--color-editor-text-flex: 0 0 5rem;
		display: grid;
		gap: inherit;
		grid-auto-flow: row;
		//grid-template-columns: var(--color-grid-rows);
		grid-template-columns: repeat(auto-fill, minmax(14.8rem, 1fr));
	}

	.input-group > .input-group-text {
		flex: 1 1 0;
	}

	.indents-title > input {
		flex: 0 0 3rem;
		text-align: center;
	}

	.indents-list {
		display: flex;
		height: 6rem;
		flex-direction: row;
	}

	.indent-color {
		--btn-visibility: hidden;
		--btn-visibility: visible;
		flex: 1 1 0;
		position: relative;

		&:hover {
			--btn-visibility: visible;
		}

		> input {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			opacity: 0;
		}
	}
</style>
