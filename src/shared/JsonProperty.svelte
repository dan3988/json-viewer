<script lang="ts">
	import type json from "../json.js";
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import JsonPropertyKey from "./JsonPropertyKey.svelte";
	import { onDestroy } from "svelte";
	import { renderValue } from "../renderer.js";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let indent = -1;
	export let maxIndentClass: number;

	$: ({ isExpanded, isHidden } = prop.state.props);

	let props: json.JProperty[] = [];
	let key: JsonPropertyKey;

	function update() {
		props = [...prop.value];
	}

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
			key.scrollTo();
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
		key.scrollTo('smooth');
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
		padding-right: 5px;
		grid-area: 1 / 2 / span 1 / span 1;

		&:after {
			color: var(--bs-body-color);
			content: ":";
		}
	}

	:global(.esc) {
		color: var(--jv-num-fg);
	}

	.json-prop {
		--expander-rotate: 0deg;
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto;
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
</style>
{#if prop}
<div
	hidden={$isHidden}
	data-indent={indent % maxIndentClass}
	class="json-prop for-{prop.value.type} for-{prop.value.subtype} json-indent"
	class:expanded={$isExpanded}>
	<span class="json-key" on:contextmenu={onContextMenu}>
		<JsonPropertyKey bind:this={key} {model} {prop} />
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
					{#each props as prop (prop)}
						<li>
							<svelte:self {model} {prop} {maxIndentClass} indent={indent + 1} />
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{:else if prop.value.is("value")}
		<span class="json-value json-{prop.value.subtype}" use:renderValue={prop.value.value}/>
	{/if}
</div>
{/if}