<script lang="ts">
    import JsonProperty from "./JsonProperty.svelte";
    import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;
</script>
<JsonProperty model={model} key="$root" value={model.root} expanded={true}/>