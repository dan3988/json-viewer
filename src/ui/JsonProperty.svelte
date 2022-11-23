<script lang="ts">
	import type { JsonProperty } from "./json";
    import JsonRenderer from "./JsonRenderer.svelte";

	export let property: JsonProperty;

	$: key = property?.key;
	$: val = property?.value;
</script>
{#if property}
<div class="json-prop for-{val.subtype}">
	<span class="json-key">{key}</span>
	<JsonRenderer token={val}/>
</div>
{/if}