<script lang="ts">
    import { PropertyBag, type PropertyChangeEventType } from "./prop";
	import type { JsonToken } from "./json";
	import type { ViewerCommandEvent, ViewerModel } from "./viewer-model";
	import JsonContainer from "./JsonContainer.svelte";
	import JsonValue from "./JsonValue.svelte";

	const props = new PropertyBag({
		isSelected: false,
		model: undefined as ViewerModel,
		value: undefined as JsonToken
	});

	props.propertyChange.addListener((evt) => {
		switch (evt.property) {
			case "model":
				if (evt.oldValue) {
					evt.oldValue.propertyChange.removeListener(onModelPropertyChange);
					evt.oldValue.command.removeListener(onModelCommand);
				}

				if (evt.newValue) {
					evt.newValue.propertyChange.addListener(onModelPropertyChange);
					evt.newValue.command.addListener(onModelCommand);
				}

				break;
			case "isSelected":
				selected = evt.newValue;
				break;
		}
	})

	function onModelCommand(evt: ViewerCommandEvent) {
		if (evt.command === "expandAll")
			expanded = evt.args[0];
	}

	function onModelPropertyChange(evt: PropertyChangeEventType<ViewerModel>) {
		if (evt.property === "selected")
			props.bag.isSelected = evt.newValue === value;
	}

	export let model: ViewerModel;
	export let key: undefined | string | number;
	export let value: JsonToken;
	export let expanded = false;

	$: selected = props.bag.isSelected;
	$: props.bag.model = model;
	$: props.bag.value = value;
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
			background-color: var(--col-shadow);
		}
	}
</style>
{#if value}
<div class="json-prop for-{value.type} for-{value.subtype} {expanded ? 'expanded' : 'collapsed'}{selected ? " selected" : ""}">
	{#if key != null}
	<span class="json-key" on:click={() => model.selected = value}>{key}</span>
	{/if}
	{#if value.is("container")}
		{#if value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander" on:click={() => expanded = !expanded}></span>
			<span class="prop-count">{value.count}</span>
			<JsonContainer model={model} token={value}/>
		{/if}
	{:else if value.is("value")}
	<JsonValue token={value}/>
	{/if}
</div>
{/if}