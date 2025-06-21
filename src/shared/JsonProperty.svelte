<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import { onDestroy } from "svelte";
	import JsonContainerInsert from "./JsonContainerInsert.svelte";
	import JsonPropertyIndex from "./JsonPropertyIndex.svelte";
	import JsonPropertyName from "./JsonPropertyName.svelte";
	import JsonValue from "./JsonValue.svelte";
	import json from "../json.js";
	import edits from "../viewer/editor-helper.js";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let indent = -1;
	export let maxIndentClass: number;

	$: ({ isExpanded, isHidden, isSelected } = prop.state.props);

	let pendingIndex = -1;
	let pendingType: json.AddType;

	function insert(index: number, type: keyof json.JContainerAddMap) {
		const parent = prop.value;
		if (parent.is('array')) {
			edits.addToArray(model, parent, type, index);
		} else if (parent.is('object')) {
			pendingIndex = index;
			pendingType = type;
		}
	}

	function addObject(name: string) {
		const index = pendingIndex;
		const after = props[index - 1] as json.JProperty<string>;
		const parent = prop.value as json.JObject;
		edits.addToObject(model, parent, pendingType, name, after);
	}

	function cancelObject() {
		pendingIndex = -1;
	}

	let props: json.JProperty[] = [];
	let keyComponent: JsonPropertyIndex | JsonPropertyName;

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

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (command === "scrollTo" && arg0 === prop) {
			keyComponent.scrollTo();
		}
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
		model.selected.reset(prop);
		keyComponent.scrollTo('smooth');
	}

	function onPropertyClick(evt: MouseEvent) {
		evt.preventDefault();
		if (evt.shiftKey) {
			//evt.preventDefault();
			model.selected[evt.ctrlKey ? "add" : "reset"](prop, true);
		} else {
			model.selected[evt.ctrlKey ? "toggle" : "reset"](prop);
		}

		window.getSelection()?.removeAllRanges();
	}


	function onContextMenu(evt: MouseEvent) {
		if (evt.shiftKey)
			return;

		evt.preventDefault();
		model.selected.reset(prop);
		model.execute("context", prop, evt.clientX, evt.clientY);
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

	.json-key-placeholder {
		margin-top: 1px;
		padding-left: 1em;
		border: solid transparent var(--bs-border-width);
	}

	:global(.esc) {
		color: var(--jv-num-fg);
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

				>.prop-count {
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

		> .prop-count, >.empty-container {
			padding: 0 5px;
			grid-area: 1 / 4 / span 1 / span 1;
		}

		> .prop-count {
			color: var(--jv-num-fg);
		}

		> .empty-container {
			font-style: italic;
			color: var(--col-shadow);
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
	}
</style>
{#if prop}
{@const { key } = prop}
<div
	hidden={$isHidden}
	data-indent={indent % maxIndentClass}
	class="json-prop for-{prop.value.type} for-{prop.value.subtype} json-indent"
	class:expanded={$isExpanded}>
	<span class="json-key" on:contextmenu={onContextMenu}>
		{#if typeof key === 'number'}
			<JsonPropertyIndex bind:this={keyComponent} index={key} selected={$isSelected} onclick={onPropertyClick} />
		{:else}
			<JsonPropertyName bind:this={keyComponent} name={key} selected={$isSelected} onclick={onPropertyClick} {onrename} />
		{/if}
	</span>
	{#if prop.value.is("container")}
		{#if prop.value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander bi bi-caret-right-fill" on:click={onExpanderClicked} title={($isExpanded ? "Collapse" : "Expand") + " " + JSON.stringify(prop.key)}></span>
			<span class="prop-count">{prop.value.count}</span>
			{#if $isExpanded}
				<span class="gutter" on:click={onGutterClicked}></span>
				<ul class="json-container json-{prop.value.subtype} p-0 m-0">
					{#each props as prop, i (prop)}
						{#if i === pendingIndex}
							<li class="json-key-placeholder">
								<JsonPropertyName editing onrename={addObject} cleanup={cancelObject} />
							</li>
						{/if}
						<li>
							<JsonContainerInsert insert={insert.bind(undefined, i)} />
						</li>
						<li>
							<svelte:self {model} {prop} {maxIndentClass} indent={indent + 1} />
						</li>
					{/each}
					{#if props.length === pendingIndex}
						<li class="json-key-placeholder">
							<JsonPropertyName editing onrename={addObject} cleanup={cancelObject} />
						</li>
					{/if}
				</ul>
			{/if}
		{/if}
	{:else if prop.value.is("value")}
		<span class="json-value">
			<JsonValue {model} {prop} />
		</span>
	{/if}
</div>
{/if}
