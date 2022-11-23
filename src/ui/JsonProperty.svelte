<script lang="ts">
	import type { JsonToken } from "./json";
    import JsonContainer from "./JsonContainer.svelte";
    import JsonValue from "./JsonValue.svelte";

	export let key: undefined | string | number;
	export let value: JsonToken;
	export let expanded = false;
</script>
<style lang="scss">
	@import "./core.scss";

	.json-key {
		color: var(--col-json-key-fg);
		grid-area: 1 / 2 / span 1 / span 1;
		cursor: pointer;

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

		&.for-container {
			&:before {
				padding: 0 5px;
				grid-area: 1 / 3 / span 1 / span 1;
			}

			&:after {
				padding: 0 5px;
				grid-area: 1 / 5 / span 1 / span 1;
			}

			&.expanded {
				>.prop-count {
					display: none;
				}

				&:after {
					grid-area: 3 / 1 / span 1 / span 1;
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

		&.collapsed {
			> .expander::before {
				rotate: -90deg;
			}

			> :global(.json-container) {
				display: none;
			}
		}

		>.prop-count, >.empty-container {
			grid-area: 1 / 4 / span 1 / span 1;
		}

		>.prop-count {
			color: var(--col-json-num-fg);
		}

		>.empty-container {
			font-style: italic;
			color: var(--col-shadow);
		}

		> :global(.json-value) {
			grid-area: 1 / 3 / span 1 / span 1;
			margin: 0 5px;
		}

		> :global(.json-container) {
			grid-area: 2 / 2 / span 1 / -1;
		}
	}

	.expander {
		@extend .img-btn;
		--mask-image: url("chrome-extension://__MSG_@@extension_id__/res/arrow.svg");

		&:before {
			inset: 20%;
			background-color: #999;
		}
	}
</style>
{#if value}
<div class="json-prop for-{value.type} for-{value.subtype} {expanded ? 'expanded' : 'collapsed'}">
	{#if key}
	<span class="json-key">{key}</span>
	{/if}
	{#if value.is("container")}
		{#if value.count === 0}
			<span class="empty-container">empty</span>
		{:else}
			<span class="expander" on:click={() => expanded = !expanded}></span>
			<span class="prop-count">{value.count}</span>
			<JsonContainer token={value}/>
		{/if}
	{:else if value.is("value")}
	<JsonValue token={value}/>
	{/if}
</div>
{/if}