<script lang="ts">
    import { PropertyBag, type PropertyChangeEventType } from "./prop";
	import type { JsonProperty } from "./json";
	import type { ViewerCommandEvent, ViewerModel } from "./viewer-model";
	import JsonValue from "./JsonValue.svelte";
    import { tick } from "svelte";

	export let model: ViewerModel;
	export let prop: JsonProperty;
	export let indent = -1;

	const maxIndentClass = 8;
	const props = new PropertyBag({
		isHidden: prop.hidden,
		isExpanded: prop.expanded,
		isSelected: prop.selected,
		model,
		prop
	});

	props.bag.prop.propertyChange.addListener(onValuePropertyChange);
	props.bag.model.propertyChange.addListener(onModelPropertyChange);
	props.bag.model.command.addListener(onModelCommand);
	props.propertyChange.addListener(({ property, oldValue, newValue }) => {
		switch (property) {
			case "prop":
				oldValue.propertyChange.removeListener(onValuePropertyChange);
				newValue.propertyChange.addListener(onValuePropertyChange);
				break;
			case "model":
				if (oldValue) {
					oldValue.propertyChange.removeListener(onModelPropertyChange);
					oldValue.command.removeListener(onModelCommand);
				}

				if (newValue) {
					newValue.propertyChange.addListener(onModelPropertyChange);
					newValue.command.addListener(onModelCommand);
				}

				break;
		}
	})

	function onValuePropertyChange({ property, newValue }: PropertyChangeEventType<JsonProperty>) {
		switch (property) {
			case "hidden":
				props.bag.isHidden = newValue;
				break;
			case "expanded":
				props.bag.isExpanded = newValue;
				break;
			case "selected":
				props.bag.isSelected = newValue;
				break;
		}
	}

	function onModelCommand({ command, args: [arg0] }: ViewerCommandEvent) {
		if (command === "scrollTo" && arg0 === prop) {
			tick().then(() => keyElement.scrollIntoView({ block: "center" }));
		}
	}

	function onModelPropertyChange(evt: PropertyChangeEventType<ViewerModel>) {
	}

	let keyElement: HTMLElement;
</script>
<style lang="scss">
	@import "./core.scss";

	.json-key {
		color: var(--col-json-key-fg);
		grid-area: 1 / 2 / span 1 / span 1;
		cursor: pointer;
		padding-right: 5px;

		&:after {
			content: ":";
		}
	}

	.json-prop {
		display: grid;
		grid-template-columns: 1em auto auto auto 1fr;
		grid-template-rows: auto auto auto;
		border: 1px transparent solid;
		border-radius: 5px;

		--col-indent: var(--col-shadow);

		&[hidden] {
			display: none !important;
		}

		&.selected {
			border-color: var(--col-border);
			background-color: var(--col-bg-dk);
		}

		&.for-container {
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

			&.indent-0 {
				--col-indent: var(--col-indent-1);
			}

			&.indent-1 {
				--col-indent: var(--col-indent-2);
			}

			&.indent-2 {
				--col-indent: var(--col-indent-3);
			}

			&.indent-3 {
				--col-indent: var(--col-indent-4);
			}

			&.indent-4 {
				--col-indent: var(--col-indent-5);
			}

			&.indent-5 {
				--col-indent: var(--col-indent-6);
			}

			&.indent-6 {
				--col-indent: var(--col-indent-7);
			}

			&.indent-7 {
				--col-indent: var(--col-indent-8);
			}
		}

		&.collapsed {
			> .expander {
				@extend .img-btn;

				&:before {
					inset: 20%;
				}
			}

			> .expander::before {
				rotate: -90deg;
				--mask-image: url("chrome-extension://__MSG_@@extension_id__/res/arrow.svg");
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
		@extend .hv-b4;
		cursor: pointer;
		position: relative;

		&:before {
			background-color: var(--col-indent);
		}
	}
</style>
{#if prop}
<div hidden={props.bag.isHidden} class="json-prop for-{prop.value.type} for-{prop.value.subtype} {props.bag.isExpanded ? 'expanded' : 'collapsed'}{props.bag.isSelected ? " selected" : ""}{indent < 0 ? '' : ' indent-' + (indent % maxIndentClass)}">
	<span bind:this={keyElement} class="json-key" on:click={() => model.selected = prop}>{prop.key}</span>
	{#if prop.value.is("container")}
		{#if prop.value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander" on:click={() => prop.toggleExpanded()}></span>
			<span class="prop-count">{prop.value.count}</span>
			<ul class="json-container json-{prop.value.subtype}">
				{#each [...prop.value.properties()] as p}
				<li>
					<svelte:self model={model} prop={p} indent={indent + 1} />
				</li>
				{/each}
			</ul>
		{/if}
	{:else if prop.value.is("value")}
	<JsonValue token={prop.value}/>
	{/if}
</div>
{/if}