<script lang="ts">
	import type { JsonToken } from "./json";
    import JsonContainer from "./JsonContainer.svelte";
    import JsonValue from "./JsonValue.svelte";

	export let token: JsonToken;
</script>
{#if token}
	{#if token.is("container")}
	<JsonContainer token={token}/>
	{:else if token.is("value")}
	<JsonValue token={token}/>
	{/if}
{/if}