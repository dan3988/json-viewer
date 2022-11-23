<script lang="ts">
	import type { JsonToken } from "./json";
    import JsonRenderer from "./JsonRenderer.svelte";

	export let root: JsonToken;
</script>
<JsonRenderer token={root}/>