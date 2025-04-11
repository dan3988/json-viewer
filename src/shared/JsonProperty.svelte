<script lang="ts">
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import { onDestroy } from "svelte";
	import { renderValue } from "../renderer.js";
	import JsonPropertyKey from "./JsonPropertyKey.svelte";
	import json from "../json.js";
	import edits from "../viewer/editor-helper.js";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let indent = -1;
	export let maxIndentClass: number;

	$: ({ isExpanded, isHidden, isSelected } = prop.state.props);

	let pendingIndex = -1;
	let pendingType: json.AddType;

	let props: json.JProperty[] = [];
	let keyComponent: JsonPropertyKey;

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

	function addObject(name: string) {
		const index = pendingIndex;
		const after = props[index - 1] as json.JProperty<string>;
		const parent = prop.value as json.JObject;
		edits.addToObject(model, parent, pendingType, name, after);
		pendingIndex = -1;
	}

	function cancelObject() {
		pendingIndex = -1;
	}

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

	function insert(index: number, type: keyof json.JContainerAddMap) {
		const parent = prop.value;
		if (parent.is('array')) {
			edits.addToArray(model, parent, type, index);
		} else if (parent.is('object')) {
			pendingIndex = index;
			pendingType = type;
		}
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
		padding-left: 1em;
	}

	:global(.esc) {
		color: var(--jv-num-fg);
	}

	.json-prop {
		--expander-rotate: 0deg;
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto auto;
		border-width: var(--bs-border-width);
		border-color: transparent;
		border-style: solid;

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
			grid-area: 1 / 3 / span 1 / span 1;
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

	.json-value {
		user-select: text;
		white-space: nowrap;

		&.json-string {
			color: var(--jv-str-fg);
		}

		&.json-number {
			color: var(--jv-num-fg);
		}

		&.json-boolean,
		&.json-null {
			color: var(--jv-keywd-fg);
		}
	}

	.json-container {
		--inserter-visibility: hidden;
		display: flex;
		flex-direction: column;
		gap: 1px;

		> li:hover:not(:has(.json-container > li:hover)) {
			--inserter-visibility: visible;
		}
	}

	.inserter {
		--inserter-bg: var(--jv-tertiary-bg);
		--inserter-color: var(--jv-tertiary-text);
		--inserter-border-color: var(--jv-tertiary-border);

		&:hover {
			--inserter-bg: var(--jv-tertiary-hover-bg);
			--inserter-color: var(--jv-tertiary-hover-text);
			--inserter-border-color: var(--jv-tertiary-hover-border);
		}

		position: relative;
		height: 1px;
		margin-top: -1px;
		margin-left: calc(1em + var(--bs-border-radius));
		visibility: var(--inserter-visibility);
		transition-property: color, background-color, border-color;
		transition-duration: .15s;
		transition-timing-function: ease-in-out;

		> * {
			transition: inherit;
			position: absolute;
		}

		> .inserter-line {
			inset: 0;
			width: 10rem;
			background-color: var(--inserter-border-color);
		}

		> .inserter-buttons {
			inset: -0.75rem -0.75rem 0 10rem;
			height: 1.5rem;
			width: min-content;
			display: flex;

			> .btn {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 0.25rem;
			}
		}

		.inserter-button {
			padding: 0;
			width: 2rem;
			border-radius: 50%;
			border: 1px solid var(--inserter-border-color);
			background-color: var(--inserter-bg);
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
{#if prop}
<div
	hidden={$isHidden}
	data-indent={indent % maxIndentClass}
	class="json-prop for-{prop.value.type} for-{prop.value.subtype} json-indent"
	class:expanded={$isExpanded}>
	<span class="json-key" on:contextmenu={onContextMenu}>
		<JsonPropertyKey bind:this={keyComponent} key={prop.key} selected={$isSelected} onclick={onPropertyClick} {onrename} />
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
								<JsonPropertyKey key="" editing onrename={addObject} oncancel={cancelObject} />
							</li>
						{/if}
						<li>
							<svelte:self {model} {prop} {maxIndentClass} indent={indent + 1} />
							<div class="inserter">
								<span class="inserter-line"></span>
								<div class="inserter-buttons btn-group">
									<span class="btn btn-base bi-braces" title="Insert Object" role="button" on:click={() => insert(i + 1, 'object')}></span>
									<span class="btn btn-base bi-0-circle" title="Insert Array" role="button" on:click={() => insert(i + 1, 'array')}></span>
									<span class="btn btn-base bi-hash" title="Insert Value" role="button" on:click={() => insert(i + 1, 'value')}></span>
								</div>
							</div>
						</li>
					{/each}
					{#if props.length === pendingIndex}
						<li class="json-key-placeholder">
							<JsonPropertyKey key="" editing onrename={addObject} oncancel={cancelObject} />
						</li>
					{/if}
				</ul>
			{/if}
		{/if}
	{:else if prop.value.is("value")}
		<span class="json-value json-{prop.value.subtype}" use:renderValue={prop.value.value}/>
	{/if}
</div>
{/if}
