<script lang="ts">
	import { InserterManager } from "../shared/JsonInsert.svelte";
	import JsonProperty from "../shared/JsonProperty.svelte"
	import ViewerModel from "../viewer-model.js";
	import json from "../json.js";
	import Indent from "../indent";

	export let maxIndentClass: number;

	$: indent = new Indent(maxIndentClass);
	
	const inserterManager = new InserterManager();
	const manifest = chrome.runtime.getManifest();
	const prop = json(manifest);
	const model = new ViewerModel(prop);
	prop.setExpanded(true, true);
</script>
<div class="editor-bg"></div>
<div class="root overflow-auto">
	<div class="panel">
		<JsonProperty {indent} {inserterManager} {model} {prop} readonly />
	</div>
</div>
<style lang="scss">
	@use 'src/core.scss' as *;

	.root {
		z-index: 1;
	}

	.panel {
		position: relative;
		padding: $pad-small;
	}

	.editor-bg {
		position: absolute;
		pointer-events: none;
		inset: 0;
	}
</style>