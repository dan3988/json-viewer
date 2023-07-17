<script lang="ts">
	import type { JsonProperty } from "../json.js";
	import type { ViewerCommandEvent, ViewerModel } from "../viewer-model.js";
	import { onDestroy, tick } from "svelte";
	import { renderKey, renderValue } from "../util.js";
	export let model: ViewerModel;
	export let prop: JsonProperty;
	export let indent = -1;
	export let maxIndentClass: number;

	$: ({ expanded, hidden, selected } = prop.bag.readables);
	
	let props: JsonProperty[] = [];

	function update() {
		props = [...prop.value];
		console.log(props.map(v => v.key))
	}

	if (prop.value.is("container")) {
		const container = prop.value;
		props = [...container];
		container.childrenChanged.addListener(update);
		onDestroy(() => container.childrenChanged.removeListener(update));
	}

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (command === "scrollTo" && arg0 === prop) {
			tick().then(() => keyElement.scrollIntoView({ block: "center" }));
		}
	}

	function onExpanderClicked() {
		if (prop.expanded) {
			prop.expanded = false;
			model.setSelected(prop, false, true);
		} else {
			prop.expanded = true;
		}
	}

	function onClick() {
		model.selected = prop;
	}

	function onContextMenu(evt: MouseEvent) {
		model.selected = prop;
		model.execute("context", prop, evt.clientX, evt.clientY);
	}

	let keyElement: HTMLElement;
</script>
<style lang="scss">
	@use "src/core.scss" as *;

	.json-key {
		color: var(--col-json-key-fg);
	}

	.json-key {
		grid-area: 1 / 2 / span 1 / span 1;
		cursor: pointer;
		white-space: nowrap;
		padding-right: 5px;

		&:after {
			color: var(--bs-body-color);
			content: ":";
		}
	}

	:global(.esc) {
		color: var(--col-json-num-fg);
	}

	.json-prop {
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto;

		&[hidden] {
			display: none !important;
		}

		&:not(.selected) {
			border-color: transparent !important;
		}

		&.selected {
			background-color: rgba(var(--bs-secondary-bg-rgb), 0.5);
		}

		&.for-container {
			&:before,
			&:after {
				color: rgb(var(--json-indent-bg));
			}

			&:before {
				grid-area: 1 / 3 / span 1 / span 1;
			}

			&:after {
				grid-area: 1 / 5 / span 1 / span 1;
			}

			&.expanded {
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
				color: var(--col-json-num-fg);
			}
		}

		&.expanded {
			> .expander {
				position: relative;

				&:before {
					content: "";
					position: absolute;
					inset: 0.5em 50%;
					transform: translateX(-50%);
					width: 2px;
					border-radius: 1px;
				}
			}
		}

		&:not(.expanded) {
			> .expander {
				@include bs-icon-btn("caret-right-fill", 1px, ("default": var(--bs-secondary-color), "hover": var(--bs-body-color), "active": var(--bs-emphasis-color)));
			}
		}

		>.prop-count, >.empty-container {
			padding: 0 5px;
			grid-area: 1 / 4 / span 1 / span 1;
		}

		>.prop-count {
			color: var(--col-json-num-fg);
		}

		>.empty-container {
			font-style: italic;
			color: var(--col-shadow);
		}

		>.expander {
			grid-area: 1 / 1 / -1 / span 1;
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
		position: relative;

		--indent-bg: rgb(var(--json-indent-bg), 0.2);

		&:hover {
			--indent-bg: rgb(var(--json-indent-bg));
		}

		&:before {
			background-color: var(--indent-bg);
		}
	}

	.json-value {
		white-space: break-spaces;

		&.json-string {
			color: var(--col-json-str-fg);
		}

		&.json-number {
			color: var(--col-json-num-fg);
		}

		&.json-boolean,
		&.json-null {
			color: var(--col-json-keywd-fg);
		}
	}

</style>
{#if prop}
<div
	hidden={$hidden}
	data-indent={indent % maxIndentClass}
	class="json-prop border rounded for-{prop.value.type} for-{prop.value.subtype} json-indent"
	class:expanded={$expanded}
	class:selected={$selected}>
	<span bind:this={keyElement} class="json-key" on:click={onClick} on:contextmenu|preventDefault={onContextMenu} use:renderKey={prop.key}/>
	{#if prop.value.is("container")}
		{#if prop.value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander" on:click={onExpanderClicked} title={($expanded ? "Collapse" : "Expand") + " " + JSON.stringify(prop.key)}></span>
			<span class="prop-count">{prop.value.count}</span>
			{#if $expanded}
				<ul class="json-container json-{prop.value.subtype} p-0 m-0">
					{#each props as prop}
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