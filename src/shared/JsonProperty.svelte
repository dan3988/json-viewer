<script lang="ts">
	import type ViewerModel from "../viewer-model.js";
	import { onDestroy } from "svelte";
	import Border from "./Border.svelte";
	import JsonActions, { type InsertChildMode, type InsertSiblingMode } from "./JsonActions.svelte";
	import JsonPropertyKey from "./JsonPropertyKey.svelte";
	import JsonValueEditor from "./JsonValueEditor.svelte";
	import JsonValue from "./JsonValue.svelte";
	import json from "../json.js";
	import edits from "../viewer/editor-helper.js";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let indent = -1;
	export let maxIndentClass: number;
	export let remove: (() => void) | undefined = undefined;
	export let insertSibling: ((type: json.AddType, mode: InsertSiblingMode) => void) | undefined = undefined;

	$: ({ selected } = model.state.props)
	$: ({ isExpanded, isHidden } = prop.state.props);

	$: isActive = $selected.length == 1 && $selected[0] == prop;

	let editingValue = false;
	let editingName = false;

	let pendingIndex = -1;
	let pendingType: json.AddType;

	function _insertChild(type: json.AddType, mode: InsertChildMode) {
		model.selected.clear();
		prop.isExpanded = true;
		const parent = prop.value;
		if (parent.is('array')) {
			const index = mode == 'last' ? parent.count : 0;
			edits.addToArray(model, parent, 'value', index);
		} else if (parent.is('object')) {
			pendingIndex = +(mode === 'last' && parent.count);
			pendingType = type;
		}
	}

	function _insertSibling(index: number, type: json.AddType, mode: InsertSiblingMode) {
		model.selected.clear();
		const container = prop.value;
		index += mode === 'after' ? 1 : 0;
		if (container.is('array')) {
			edits.addToArray(model, container, type, index);
		} else if (container.is('object')) {
			pendingIndex = index;
			pendingType = type;
		}
	}

	function addObject(name: string) {
		const index = pendingIndex;
		const parent = prop.value as json.JObject;
		if (index) {
			const after = props[index - 1] as json.JProperty<string>;
			edits.addToObject(model, parent, pendingType, name, after);
		} else {
			const before = props[0] as json.JProperty<string>;
			edits.addToObject(model, parent, pendingType, name, before, true);
		}
	}

	function cancelObject() {
		pendingIndex = -1;
	}

	let props: json.JProperty[] = [];

	function update() {
		props = [...prop.value];
	}

	$: onrename = ((prop) => {
		const { parent } = prop;
		if (parent?.is('object')) {
			return (name: string) => {
				edits.renameProperty(model, parent, prop.key as string, name);
				model.execute('scrollTo', prop);
			}
		}
	})(prop);

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

	.json-actions {
		z-index: 5;
		position: absolute;
		top: 100%;
		left: 100%;
		translate: -50%;
	}

	.json-key-placeholder {
		padding-left: 1em;
		border: solid transparent var(--bs-border-width);
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
		border: solid transparent var(--bs-border-width);

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

		> .container-empty {
			padding-left: 1rem;
		}
	}
</style>
{#if prop}
{@const { key, value } = prop}
<div
	hidden={$isHidden}
	data-indent={indent % maxIndentClass}
	class="json-prop for-{value.type} for-{value.subtype} json-indent"
	class:expanded={$isExpanded}>
	<span class="json-key">
		<span class="json-key-container">
			{#if isActive && !(editingName || editingValue)}
				<div class="json-actions">
					<JsonActions
						{model}
						{prop}
						edit={value.is('value') && (() => editingValue = true)}
						rename={onrename && (() => editingName = true)}
						{remove}
						sort={value.is('object') && ((desc) => edits.sortObject(model, value, desc))}
						insertChild={value.is('container') && _insertChild}
						{insertSibling}
					/>
				</div>
			{/if}
			<JsonPropertyKey {prop} {model} {onrename} bind:editing={editingName} />
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
			<ul class="json-container json-{value.subtype} p-0 m-0">
				{#if props.length}
					{#each props as prop, i (prop)}
						{#if i === pendingIndex}
							<li class="json-key-placeholder">
								<Border editing>
									<JsonValueEditor value="" parse={String} editing onfinish={addObject} cleanup={cancelObject} />
								</Border>
							</li>
						{/if}
						<li>
							<svelte:self {model} {prop} {maxIndentClass}
								remove={() => edits.deleteProp(model, prop)}
								indent={indent + 1}
								insertSibling={_insertSibling.bind(undefined, i)}
							/>
						</li>
					{/each}
				{:else if pendingIndex < 0}
					<li class="container-empty">empty</li>
				{/if}
				{#if props.length === pendingIndex}
					<li class="json-key-placeholder">
						<Border editing>
							<JsonValueEditor value="" parse={String} editing onfinish={addObject} cleanup={cancelObject} />
						</Border>
					</li>
				{/if}
			</ul>
		{/if}
	{:else if value.is("value")}
		<span class="json-value">
			<JsonValue {model} {prop} bind:editing={editingValue} />
		</span>
	{/if}
</div>
{/if}
