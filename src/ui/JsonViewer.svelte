<script lang="ts">
	import type { JsonToken } from "./json";
    import JsonProperty from "./JsonProperty.svelte";

	export let root: JsonToken;
</script>
<JsonProperty key="$root" value={root} expanded={true}/>