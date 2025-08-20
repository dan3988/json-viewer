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
	import Indent from "../indent";

	export let maxIndentClass: number;

	$: indent = new Indent(maxIndentClass);

	const manifest = chrome.runtime.getManifest();
	const prop = json(manifest);
	const model = new ViewerModel(prop);
	prop.setExpanded(true, true);
</script>
<JsonProperty {indent} {model} {prop}></JsonProperty>