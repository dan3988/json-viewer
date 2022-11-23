<script lang="ts">
	import type { JsonToken } from "./json";
    import JsonContainer from "./JsonContainer.svelte";
    import JsonValue from "./JsonValue.svelte";

	export let key: undefined | string;
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

		&.for-value > .expander {
			display: none;
		}

		&.collapsed {
			> .expander::before {
				rotate: -90deg;
			}

			> :global(.json-container) {
				display: none;
			}
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
	<span class="expander" on:click={() => expanded = !expanded}></span>
	<span class="json-key">{key}</span>
	{/if}
	{#if value.is("container")}
	<JsonContainer token={value}/>
	{:else if value.is("value")}
	<JsonValue token={value}/>
	{/if}
</div>
{/if}