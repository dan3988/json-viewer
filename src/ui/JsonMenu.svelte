<script lang="ts">
    import { PropertyBag, PropertyChangeEvent } from "./prop";
	import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;

	const props = new PropertyBag({
		model: undefined as ViewerModel
	});

	props.propertyChange.addListener(evt => {
		if (evt.property === "model") {
			evt.oldValue?.propertyChange.removeListener(onModelPropertyChange);
			evt.newValue?.propertyChange.addListener(onModelPropertyChange);
		}
	})

	function onModelPropertyChange(evt: PropertyChangeEvent) {
	}

	function expandAll() {
		model.execute("expandAll", true);
	}

	function collapseAll() {
		model.execute("expandAll", false);
	}

	$: props.bag.model = model;
</script>
{#if model}
<div class="root">
	<div class="group">
		<button type="button" on:click={expandAll}>Expand All</button>
		<button type="button" on:click={collapseAll}>Collapse All</button>
	</div>
</div>
{/if}