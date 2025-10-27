<script lang="ts">
	import type Indent from "../indent.js";
	import type json from "../json.js";
	import type { ViewerModel, SelectedNodeList } from "../viewer-model.js";
	import { onDestroy, onMount } from "svelte";
	import JsonActions from "./JsonActions.svelte";
	import JsonPropertyKey from "./JsonPropertyKey.svelte";
	import JsonValueEditor from "./JsonValueEditor.svelte";
	import JsonValue from "./JsonValue.svelte";
	import JsonInsert, { InserterManager } from "./JsonInsert.svelte";
	import JsonSearch from "../search.js";
	import edits from "../viewer/editor-helper.js";

	export let model: ViewerModel;
	export let search: JsonSearch;
	export let node: json.Node;
	export let indent: Indent;
	export let readonly = false;
	export let remove: (() => void) | undefined = undefined;

	const inserterManager = InserterManager.current;

	$: selectedNodes = model.selected;
	$: selected = $selectedNodes.has(node);

	function focusCheck(list: SelectedNodeList) {
		if (list.last === node) {
			menuFocus.focus();
		}
	}

	let unsub: VoidFunction;

	onDestroy(() => {
		unsub?.();
	})

	onMount(() => {
		unsub = selectedNodes.subscribe(focusCheck);
	});

	$: ({ isExpandedStore } = node);
	$: expanded = $isExpandedStore;
	$: canEdit = !readonly && !(editingName || editingValue || menuOpen);
	
	let editingValue = false;
	let editingName = false;

	let locked = false;

	$: setLocked(!canEdit);

	function setLocked(value: boolean) {
		if (locked !== value) {
			locked = value;
			inserterManager[value ? 'lock' : 'unlock']();
		}
	}

	function onMouseDown(evt: MouseEvent) {
		// prevent text selection
		evt.shiftKey && evt.preventDefault();
	}

	function onClick(evt: MouseEvent) {
		evt.preventDefault();
		evt.stopPropagation();
		if (evt.shiftKey) {
			//evt.preventDefault();
			model.selected[evt.ctrlKey ? "add" : "reset"](node, true);
		} else {
			model.selected[evt.ctrlKey ? "toggle" : "reset"](node);
		}
	}

	function startEditing() {
		model.selected.reset(node);
		editingValue = true;
	}

	function insert(index: number, value: any) {
		model.selected.clear();
		if (node.isArray()) {
			model.edits.push(edits.arrayAdd(node, value, index));
		} else if (node.isObject()) {
			const sibling = children[index] as json.Node;
			const commit: CommitObject = addObject.bind(undefined, node, sibling, value);
			children.splice(index, 0, commit);
			children = children;
		}
	}

	function addObject(parent: json.Object, sibling: null | json.Node, value: any, name: string) {
		model.edits.push(edits.objectAdd(parent, name, value, sibling));
	}

	function removePendingEdit(index: number) {
		children.splice(index, 1);
		children = children;
	}

	type CommitObject = (name: string) => void;

	let children: (json.Node | CommitObject)[] = [];

	function update() {
		children = [...node];
	}

	if (node.isContainer()) {
		update();
		node.onChanged.addListener(update);
		onDestroy(() => node.onChanged.removeListener(update));
	}

	function onExpanderClicked() {
		node.toggleExpanded();
	}

	function onGutterClicked() {
		model.setSelected(node, false, true);
	}

	let menuFocus: HTMLElement;
	let menuOpen = false;

	function onMenuFocusLost(evt: FocusEvent) {
		if (!menuFocus.contains(evt.relatedTarget as Node | null)) {
			menuOpen = false;
		}
	}

	function openMenu(evt: MouseEvent) {
		if (!(evt.shiftKey || readonly)) {
			evt.preventDefault();

			if (!menuOpen) {
				model.selected.reset(node);
				menuOpen = true;
				menuFocus.focus();
			}
		}
	}
</script>
<style lang="scss">
	@use "src/core.scss" as *;

	.json-key {
		grid-area: 1 / 2 / span 1 / span 1;
		padding-right: 5px;
		display: flex;
		align-items: center;

		&:after {
			color: var(--bs-body-color);
			content: ":";
		}
	}

	.json-selected::before {
		content: "";
		background-color: var(--jv-tertiary-bg);
		z-index: -1;
		pointer-events: none;
		position: absolute;
		left: 0;
		right: 0;
		height: 1.5em;
		display: flex;
		flex-direction: column;
	}

	.json-key-container {
		position: relative;
		outline: none;
	}

	.json-key-placeholder {
		padding-left: 1em;
	}

	.json-actions-root {
		z-index: 5;
	}

	:global(.quote) {
		&::before, &::after {
			content: "\"";
		}
	}

	:global(mark) {
		padding: $pad-small;
		margin: $pad-small * -1;
	}

	:global(.esc) {
		color: var(--jv-num-fg);
	}

	.container-count {
		color: var(--jv-num-fg);
	}

	.container-empty {
		font-style: italic;
		color: var(--col-shadow);
	}

	.json-prop {
		--selection-visibility: hidden;
		--expander-rotate: 0deg;
		flex: 1 1 0px;
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto auto;

		&.selected {
			--selection-visibility: visible;
		}

		&.for-container {
			&:before,
			&:after {
				color: rgb(var(--jv-indent));
			}

			&:before {
				grid-area: 1 / 3 / span 1 / span 1;
			}

			&:after {
				grid-area: 1 / 5 / span 1 / span 1;
			}

			&.expanded {
				--expander-rotate: 90deg;

				>.container-summary {
					display: none;
				}

				&:after {
					grid-area: 3 / 2 / span 1 / span 1;
				}
			}
		}

		&.for-object {
			&:before {
				content: "{";
			}

			&:after {
				content: "}"
			}
		}

		&.for-array {
			&:before {
				content: "[";
			}

			&:after {
				content: "]"
			}
		}

		> .container-summary {
			padding: 0 5px;
			grid-area: 1 / 4 / span 1 / span 1;
		}

		> .expander {
			grid-area: 1 / 1 / span 1 / span 1;
		}

		> .gutter {
			grid-area: 2 / 1 / span 1 / span 1;
		}

		> .json-value {
			grid-area: 1 / 3 / span 1 / -1;
		}

		> .json-container {
			grid-area: 2 / 2 / span 1 / -1;
		}
	}

	.expander {
		cursor: pointer;
		color: rgba(var(--jv-body-text-rgb), 0.5);
		font-size: 0.75em;
		rotate: var(--expander-rotate);
		transition: rotate .15s ease-in-out;
		z-index: 5;

		&:hover {
			color: rgb(var(--jv-body-text-rgb));
		}

		&:active {
			color: var(--bs-emphasis-color);
		}
	}

	.gutter {
		cursor: pointer;
		position: relative;

		--indent-bg: rgb(var(--jv-indent), 0.33);

		&:hover {
			--indent-bg: rgb(var(--jv-indent));
		}

		&:before {
			content: "";
			background-color: var(--indent-bg);
			position: absolute;
			inset: 0 50%;
			transform: translateX(-50%);
			width: 2px;
			border-radius: 1px;
		}
	}

	.json-container {
		display: flex;
		flex-direction: column;
		margin: 0;

		> .container-empty {
			padding-left: 1em;
		}

		.json-container-gap {
			position: relative;
			height: 0;
		}
	}

	.selection-bg {
		visibility: var(--selection-visibility);
		background-color: var(--jv-tertiary-bg);
		z-index: -1;
		pointer-events: none;
		position: absolute;
		left: 0;
		right: 0;
		height: 1.5em;
		display: flex;
		flex-direction: column;
	}
</style>
<div
	data-indent={indent.indent}
	class="json-prop for-{node.type} for-{node.subtype} json-indent"
	class:expanded
	on:click={onClick}
	on:mousedown={onMouseDown}>
	<span class="json-key" class:json-selected={selected} on:contextmenu={openMenu}>
		<span class="json-key-container" tabindex="0" bind:this={menuFocus} on:focusout={onMenuFocusLost}>
			<JsonPropertyKey {model} {search} {node} {readonly} {selected} bind:editing={editingName}>
				<div class="json-actions-root">
					{#if menuOpen}
						<JsonActions
							close={() => menuOpen = false}
							{model}
							{node}
							edit={node.isValue() && startEditing}
							rename={node.parent?.isObject() && (() => editingName = true)}
							{remove}
							clear={node.isContainer() && (() => model.edits.push(edits.clear(node)))}
							sort={node.isObject() && ((desc) => model.edits.push(edits.sort(node, desc)))}
						/>
					{/if}
				</div>
			</JsonPropertyKey>
		</span>
	</span>
	{#if node.isContainer()}
		<span class="expander bi bi-caret-right-fill" on:click={onExpanderClicked} title={(expanded ? "Collapse" : "Expand")}></span>
		{#if children.length}
			<span class="container-summary container-count">{children.length}</span>
		{:else}
			<span class="container-summary container-empty">empty</span>
		{/if}
		{#if expanded}
			<span class="gutter" on:click|stopPropagation={onGutterClicked}></span>
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<ul class="json-container json-{node.subtype} p-0" on:click|stopPropagation>
				<li class="json-container-gap">
					<JsonInsert insert={(type) => insert(0, type)} />
				</li>
				{#if children.length === 0}
					<li class="container-empty">empty</li>
				{:else}
					{#each children as node, i (node)}
						{#if typeof node === 'function'}
							<li class="json-key-placeholder json-selected">
								<JsonValueEditor value="" parse={String} editing onfinish={node} oncancel={() => removePendingEdit(i)} />
							</li>
						{:else}
							<li class="json-container-item">
								<svelte:self {model} {node} {readonly} {search}
									remove={() => model.edits.push(edits.remove(node))}
									indent={indent.next}
								/>
							</li>
						{/if}
						<li class="json-container-gap">
							<JsonInsert insert={(type) => insert(i + 1, type)} />
						</li>
					{/each}
				{/if}
			</ul>
		{/if}
	{:else if node.isValue()}
		<span class="json-value">
			<JsonValue {model} {node} {readonly} {search} onediting={startEditing} bind:editing={editingValue} />
		</span>
	{/if}
</div>
