<script lang="ts">
	import JsonProperty from "../shared/JsonProperty.svelte"
	import ViewerModel from "../viewer-model.js";
	import json from "../json.js";
	import Indent from "../indent";

	export let maxIndentClass: number;

	$: indent = new Indent(maxIndentClass);

	const manifest = chrome.runtime.getManifest();
	const prop = json(manifest);
	const model = new ViewerModel(prop);
	prop.setExpanded(true, true);
</script>
<JsonProperty {indent} {model} {prop} readonly />