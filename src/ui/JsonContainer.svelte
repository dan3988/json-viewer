<script lang="ts">
	import type { JsonContainer } from "./json";
    import JsonProperty from "./JsonProperty.svelte";

	export let token: JsonContainer;
</script>
<style lang="scss">
	.json-container {
		list-style: none;
		padding: 0;
	}
</style>
{#if token}
<ul class="json-container json-{token.subtype}">
	{#each [...token.properties()] as p}
	<li>
		<JsonProperty property={p}/>
	</li>
	{/each}
</ul>
{/if}