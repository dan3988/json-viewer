<script lang="ts">
	import type { JsonToken } from "./json";
	import JsonContainer from "./JsonContainer.svelte";
	import JsonValue from "./JsonValue.svelte";

	export let root: JsonToken;
</script>
{#if root}
	{#if root.is("container")}
		<JsonContainer token={root}/>
	{:else if root.is("value")}
		<JsonValue token={root}/>
	{/if}
{/if}