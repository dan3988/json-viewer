<script lang="ts" context="module">
	import type json from "../json";

	function expandPath(model: ViewerModel, value: undefined | null | json.JsonProperty): readonly json.JsonProperty[] {
		if (value == null)
			return [model.root];

		const parts: json.JsonProperty[] = [];
		let prop: undefined | json.JsonProperty = value;
		do {
			parts.push(prop);
		} while ((prop = prop.parent?.owner) != null);

		return parts.reverse();
	}
</script>
<script lang="ts">
	import type ViewerModel from "../viewer-model";
	import JsonPathEditor, { type EventMap } from "./JsonPathEditor.svelte";

	export let model: ViewerModel;

	$: ({ selected } = model.bag.readables);
	$: path = expandPath(model, $selected);

	let editing = false;
	let editor: JsonPathEditor;

	function beginEditing() {
		editing = true;
		editor.focus();
	}

	function cancelEditing(evt: CustomEvent) {
		editing = false;
	}

	function endEditing(evt: CustomEvent<EventMap["finished"]>) {
		if (evt.detail == null) {
			evt.preventDefault()
		} else {
			model.setSelected(evt.detail, true, true);
			editing = false;
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		display: grid;
		grid-template-rows: 1fr;
		grid-template-columns: 1fr;

		&.editing > .list,
		&:not(.editing) > .editor {
			visibility: hidden;
		}

		> * {
			grid-area: 1 / 1 / -1 / -1;
		}
	}

	.editor {
	}

	.list {
		display: none;
		cursor: text;
		grid-area: 1 / 1 / span 1 / span 1;
		display: flex;
		flex-direction: row;
		user-select: none;

		> li {
			white-space: nowrap;
			display: flex;
			flex-direction: row;
			align-items: center;

			> span.content {
				padding: 0 $pad-med;
				display: block;
				outline: none;
				min-width: 1em;
				cursor: pointer;
				
				&:hover {
					color: var(--col-match-fg);
					background-color: var(--col-match-bg);
				}
			}
		}
	}
</style>
<div class="root" class:editing>
	<ul class="list" role="textbox" on:click={beginEditing}>
		{#each path as prop}
			<li>
				{#if prop.parent != null}
					<span>/</span>
				{/if}
				<span class="content rounded" on:click|stopPropagation={() => model.setSelected(prop, true, true)}>{prop.key}</span>
			</li>
		{/each}
	</ul>
	<div class="editor">
		<JsonPathEditor bind:this={editor} {model} on:cancelled={cancelEditing} on:finished={endEditing}/>
	</div>
</div>