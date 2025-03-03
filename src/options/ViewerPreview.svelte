<script lang="ts" context="module">
	function expand(prop: json.JProperty, level: number) {
		prop.setExpanded(true);

		if (--level >= 0)
			for (const child of prop.value)
				expand(child, level);
	}

	function expandUp(prop: json.JProperty) {
		while (prop = prop.parentProperty!) {
			prop.setExpanded(true);
		}
	}
</script>
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