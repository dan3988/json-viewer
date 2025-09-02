<script lang="ts">
	import type Indent from "../indent.js";
	import type ViewerModel from "../viewer-model.js";
	import { onDestroy } from "svelte";
	import Border from "./Border.svelte";
	import JsonActions from "./JsonActions.svelte";
	import JsonPropertyKey from "./JsonPropertyKey.svelte";
	import JsonValueEditor from "./JsonValueEditor.svelte";
	import JsonValue from "./JsonValue.svelte";
	import JsonInsert, { type InserterManager } from "./JsonInsert.svelte";
	import json from "../json.js";
	import edits from "../viewer/editor-helper.js";

	type InsertSiblingMode = 'before' | 'after';

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let inserterManager: InserterManager;
	export let indent: Indent;
	export let readonly = false;
	export let remove: (() => void) | undefined = undefined;

	$: ({ selected } = model.state.props)
	$: ({ isExpanded, isHidden } = prop.state.props);

	$: isActive = $selected.length == 1 && $selected[0] == prop;
	$: canEdit = !readonly && !(editingName || editingValue);

	let editingValue = false;
	let editingName = false;

	function startEditing() {
		model.selected.reset(prop);
		editingValue = true;
	}

	function insertSibling(index: number, type: json.AddType, mode: InsertSiblingMode) {
		model.selected.clear();
		const container = prop.value;
		const targetIndex = index + +(mode === 'after');
		if (container.is('array')) {
			edits.addToArray(model, container, type, targetIndex);
		} else if (container.is('object')) {
			const sibling = props[index] as json.JProperty<string>;
			const commit: CommitObject = addObject.bind(undefined, container, sibling, mode === 'before', type);
			props.splice(targetIndex, 0, commit);
			props = props;
		}
	}

	function addObject(parent: json.JObject, sibling: null | json.JProperty<string>, insertBefore: boolean, type: json.AddType, name: string) {
		edits.addToObject(model, parent, type, name, sibling ?? undefined, insertBefore);
	}

	function removePendingEdit(index: number) {
		props.splice(index, 1);
		props = props;
	}

	type CommitObject = (name: string) => void;

	let props: (json.JProperty | CommitObject)[] = [];

	function update() {
		props = [...prop.value];
	}

	if (prop.value.is("container")) {
		const container = prop.value;
		update();
		container.changed.addListener(update);
		onDestroy(() => container.changed.removeListener(update));
	}

	function onExpanderClicked() {
		if (prop.isExpanded) {
			prop.isExpanded = false;
			model.selected.reset(prop);
		} else {
			prop.isExpanded = true;
		}
	}

	function onGutterClicked() {
		model.setSelected(prop, false, true);
	}
</script>
<style lang="scss">
	@use "src/core.scss" as *;

	.json-key {
		grid-area: 1 / 2 / span 1 / span 1;
		padding-right: 5px;

		&:after {
			color: var(--bs-body-color);
			content: ":";
		}
	}

	.json-key-container {
		position: relative;
	}

	.json-key-placeholder {
		padding-left: 1em;
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
		--expander-rotate: 0deg;
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto auto;

		&[hidden] {
			display: none !important;
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

			> .json-container > :global(li > .json-prop > .json-key) {
				color: var(--jv-num-fg);
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
		font-size: x-small;
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
		margin-top: calc(var(--bs-border-width) * -1);

		> .json-prop-entry,
		> .json-key-placeholder {
			margin: calc(var(--bs-border-width) * -1);
		}

		> .container-empty {
			padding-left: 1rem;
		}

		.container-gap {
			position: relative;
			height: 1px;
		}
	}
</style>
{#if prop}
{@const { key, value } = prop}
<div
	hidden={$isHidden}
	data-indent={indent.indent}
	class="json-prop for-{value.type} for-{value.subtype} json-indent"
	class:expanded={$isExpanded}>
	<span class="json-key">
		<span class="json-key-container">
			<JsonPropertyKey {model} {prop} {readonly} bind:editing={editingName}>
				{#if canEdit && isActive}
					<JsonActions
						{model}
						{prop}
						edit={value.is('value') && startEditing}
						rename={typeof key === 'string' && (() => editingName = true)}
						{remove}
						sort={value.is('object') && ((desc) => edits.sortObject(model, value, desc))}
					/>
				{/if}
			</JsonPropertyKey>
		</span>
	</span>
	{#if value.is("container")}
		<span class="expander bi bi-caret-right-fill" on:click={onExpanderClicked} title={($isExpanded ? "Collapse" : "Expand") + " " + JSON.stringify(prop.key)}></span>
		{#if props.length}
			<span class="container-summary container-count">{props.length}</span>
		{:else}
			<span class="container-summary container-empty">empty</span>
		{/if}
		{#if $isExpanded}
			<span class="gutter" on:click={onGutterClicked}></span>
			<ul class="json-container json-{value.subtype} p-0">
				<li class="container-gap">
					{#if canEdit}
						<JsonInsert manager={inserterManager} insert={(type) => insertSibling(0, type, 'before')} />
					{/if}
				</li>
				{#if props.length === 0}
					<li class="container-empty">empty</li>
				{:else}
					{#each props as prop, i (prop)}
						{#if typeof prop === 'function'}
							<li class="json-key-placeholder">
								<Border editing>
									<JsonValueEditor value="" parse={String} editing onfinish={prop} oncancel={() => removePendingEdit(i)} />
								</Border>
							</li>
						{:else}
							<li class="json-prop-entry">
								<svelte:self {model} {prop} {readonly} {inserterManager}
									remove={() => edits.deleteProp(model, prop)}
									indent={indent.next}
								/>
							</li>
						{/if}
						<li class="container-gap">
							{#if canEdit}
								<JsonInsert manager={inserterManager} insert={(type) => insertSibling(i, type, 'after')} />
							{/if}
						</li>
					{/each}
				{/if}
			</ul>
		{/if}
	{:else if value.is("value")}
		<span class="json-value">
			<JsonValue {model} {prop} {readonly} onediting={startEditing} bind:editing={editingValue} />
		</span>
	{/if}
</div>
{/if}
