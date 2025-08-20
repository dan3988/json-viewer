<script lang="ts">
	import JsonProperty from "../shared/JsonProperty.svelte"
	import ViewerModel from "../viewer-model.js";
	import json from "../json.js";

	export let maxIndentClass: number;
	
	const manifest = chrome.runtime.getManifest();
	const prop = json(manifest);
	const model = new ViewerModel(prop);
	prop.setExpanded(true, true);
</script>
<JsonProperty indent={0} {maxIndentClass} {model} {prop}></JsonProperty>