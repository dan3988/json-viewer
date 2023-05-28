<script lang="ts" context="module">
	const sample: Dict = {
		"string": "this is what a string looks like",
		"numbers": 0,
		"boolean": true,
		"null": null
	}

	function nest(owner: Dict, i: number) {
		const copy = { ...owner }
		if (--i >= 0)
			nest(copy, i);
		
		owner.object = copy;
	}

	sample.array = [
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
		"Suspendisse in dictum sapien.",
		"Phasellus euismod est eu convallis finibus.",
		"Interdum et malesuada fames ac ante ipsum primis in faucibus.",
		"Duis dignissim sem eget ligula ultrices, ac egestas eros ultrices.",
		"In id lorem mi.",
		"Nam eu nisl id lorem finibus varius.",
		"Integer dignissim tortor a leo interdum, ut dignissim urna ullamcorper.",
		"Nam a dui a augue pharetra sagittis id vitae leo.",
		"Nulla elementum porttitor orci, at auctor nibh aliquet in. Mauris ac ligula ligula.",
		"Phasellus sagittis interdum ligula, non scelerisque mauris auctor eget. Etiam euismod eleifend luctus.",
		"Morbi sed mi lacus.",
		"Phasellus metus justo, interdum vel elit ut, tincidunt laoreet massa.",
		"Ut ut mattis arcu.",
	];

	nest(sample, 10);
</script>
<script lang="ts">
	import JsonProperty from "../shared/JsonProperty.svelte"
	import ViewerModel from "../viewer-model";
	import * as json from "../json";

	export let maxIndentClass: number;
	
	const prop = json.JsonProperty.create(sample);
	prop.expanded = true;
	const model = new ViewerModel(prop);
</script>
<JsonProperty indent={0} {maxIndentClass} {model} {prop}></JsonProperty>