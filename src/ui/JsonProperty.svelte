<script lang="ts">
	import type { JsonProperty } from "./json";
	import JsonContainer from "./JsonContainer.svelte";
	import JsonValue from "./JsonValue.svelte";

	export let property: JsonProperty;

	$: key = property?.key;
	$: val = property?.value;
</script>
{#if property}
<div class="json-container json-{val.type}">
	<span class="json-key">{key}</span>
	{#if val.is("container")}
		<JsonContainer token={val}/>
	{:else if val.is("value")}
		<JsonValue token={val}/>
	{/if}
</div>
{/if}