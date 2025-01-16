<script lang="ts">
	import JsonProperty from "../shared/JsonProperty.svelte"
	import ViewerModel from "../viewer-model.js";
	import json from "../json.js";
	import sample from "./sample.json";

	export let maxIndentClass: number;
	
	const prop = json(sample);
	prop.setExpanded(true, true);
	const model = new ViewerModel(prop);
</script>
<JsonProperty indent={0} {maxIndentClass} {model} {prop}></JsonProperty>