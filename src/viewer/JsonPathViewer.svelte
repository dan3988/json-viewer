<script lang="ts" module>
	import type json from "../json";

	function expandPath(model: ViewerModel, value: undefined | null | json.Node): readonly json.Node[] {
		if (value == null)
			return [model.root];

		const parts: json.Node[] = [];
		let node: null | json.Node = value;
		do {
			parts.push(node);
		} while ((node = node.parent) != null);

		return parts.reverse();
	}
</script>
<script lang="ts">
	import type ViewerModel from "../viewer-model";
	import { toPointer } from "../util";
	import JsonPathEditor from "./JsonPathEditor.svelte";

	interface Props {
		model: ViewerModel;
	}

	const { model }: Props = $props();

	const set = $derived(model.selected);
	const path = $derived(expandPath(model, $set.last));

	let editing = false;
	let editor: JsonPathEditor;

	function beginEditing() {
		editing = true;
		editor.focus();
	}

	function cancelEditing() {
		editing = false;
	}

	function endEditing(node: json.Node | null) {
		if (node == null) {
			return true;
		} else {
			model.setSelected(node, true, true);
			editing = false;
		}
	}

	function onNodeClicked(evt: Event, node: json.Node) {
		evt.preventDefault();
		model.setSelected(node, true, true);
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		--list-overflow: auto;
		--list-visibility: visible;
		--editor-visibility: hidden;
		position: relative;
		display: grid;
		grid-template-rows: 1fr;
		grid-template-columns: 1fr;

		&:not(.editing) {
			--bs-border-color: transparent;
		}

		&.editing {
			--list-overflow: hidden;
			--list-visibility: hidden;
			--editor-visibility: visible;
		}

		> * {
			grid-area: 1 / 1 / -1 / -1;
		}
	}

	.editor {
		position: absolute;
		inset: 0;
		visibility: var(--editor-visibility);
		// overflow-y: visible;
		// overflow-x: hidden;
	}

	.list {
		visibility: var(--list-visibility);
		overflow-x: var(--list-overflow);
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
<div class="root border rounded p-1" class:editing>
	<ul class="list" role="textbox" onclick={beginEditing}>
		{#each path as node}
		{@const key = node.key ? toPointer(node.key) : '$'}
			<li>
				{#if node.parent != null}
					<span>/</span>
				{/if}
				<span class="content rounded" onclick={e => onNodeClicked(e, node)}>{key}</span>
			</li>
		{/each}
	</ul>
	<div class="editor">
		<JsonPathEditor bind:this={editor} {model} oncancel={cancelEditing} onfinished={endEditing}/>
	</div>
</div>