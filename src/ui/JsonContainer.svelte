<script lang="ts">
    import type { ViewerModel } from "./viewer-model";
	import type { JsonContainer } from "./json";
    import JsonProperty from "./JsonProperty.svelte";

	export let model: ViewerModel;
	export let token: JsonContainer;
</script>
{#if token}
<ul class="json-container json-{token.subtype}">
	{#each [...token.properties()] as { key, value }}
	<li>
		<JsonProperty model={model} key={key} value={value}/>
	</li>
	{/each}
</ul>
{/if}