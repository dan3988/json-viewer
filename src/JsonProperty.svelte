<script lang="ts">
	import type { JsonProperty } from "./json";
	import type { ViewerCommandEvent, ViewerModel } from "./viewer-model";
	import { onDestroy, tick } from "svelte";
	import { renderKey, renderValue } from "./util";

	export let model: ViewerModel;
	export let prop: JsonProperty;
	export let indent = -1;
	export let maxIndentClass: number;

	const { expanded, hidden, selected } = prop.bag.readables;

	model.command.addListener(onModelCommand);

	onDestroy(() => model.command.removeListener(onModelCommand));

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (command === "scrollTo" && arg0 === prop) {
			tick().then(() => keyElement.scrollIntoView({ block: "center" }));
		}
	}

	function onClick(evt: MouseEvent) {
		if (evt.button === 0 || evt.button === 2)
			model.selected = prop;
	}

	let keyElement: HTMLElement;
</script>
<style lang="scss">
	@use "./core.scss" as *;

	.json-key {
		color: var(--col-json-key-fg);
		grid-area: 1 / 2 / span 1 / span 1;
		cursor: pointer;
		white-space: nowrap;
		padding-right: 5px;

		&:after {
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
			background-color: var(--bs-secondary-bg);
		}

		&.for-container {
			&:before, &:after {
				color: var(--col-json-container);
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
		}

		&.expanded {
			> .expander {
				position: relative;

				&:hover::before {
					width: 4px;
					border-radius: 2px;
				}

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
				@include img-btn-url("arrow.svg", 20%, ("default": var(--bs-secondary-color), "hover": var(--bs-body-color), "active": var(--bs-emphasis-color)));
			}

			> .expander::before {
				rotate: -90deg;
			}

			> :global(.json-container) {
				display: none;
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
		
		> :global(.json-value) {
			grid-area: 1 / 3 / span 1 / span 1;
		}

		> :global(.json-container) {
			grid-area: 2 / 2 / span 1 / -1;
		}
	}

	.expander {
		cursor: pointer;
		position: relative;

		&:before {
			background-color: var(--json-indent-bg);
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

		&.json-boolean {
			color: var(--col-json-bln-fg);
		}

		&.json-null {
			color: var(--col-json-null-fg);
		}
	}

</style>
{#if prop}
<div
	hidden={$hidden}
	class="json-prop border rounded for-{prop.value.type} for-{prop.value.subtype}{indent < 0 ? '' : ' json-indent-col-' + (indent % maxIndentClass)}"
	class:expanded={$expanded}
	class:selected={$selected}>
	<span bind:this={keyElement} class="json-key" on:click={onClick} on:auxclick={onClick} use:renderKey={prop.key}/>
	{#if prop.value.is("container")}
		{#if prop.value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander" on:click={() => prop.toggleExpanded()}></span>
			<span class="prop-count">{prop.value.count}</span>
			<ul class="json-container json-{prop.value.subtype} p-0 m-0">
				{#each [...prop.value.properties()] as p}
				<li>
					<svelte:self model={model} prop={p} indent={indent + 1} {maxIndentClass} />
				</li>
				{/each}
			</ul>
		{/if}
	{:else if prop.value.is("value")}
	<span class="json-value json-{prop.value.subtype}" use:renderValue={prop.value.value}/>
	{/if}
</div>
{/if}