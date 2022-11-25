<script lang="ts">
    import JSONPath from "./json-path";
    import { PropertyBag, PropertyChangeEvent } from "./prop";
	import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;

	let jpath: string;
	let jpathResults: string[] = [];

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

	function onKeyPress(evt: KeyboardEvent) {
		if (evt.key === "Enter")
			evaluateJpath();
	}

	function evaluateJpath() {
		if (!jpath) {
			jpathResults = [];
			return;
		}

		try {
			jpathResults = JSONPath({ json: model.root.proxy, path: jpath, resultType: "pointer" });
			jpathResults.forEach((v, i, a) => a[i] = "$" + v);
		} catch (e) {
			jpathResults = [];
			alert(e);
		}
	}

	$: props.bag.model = model;
</script>
<style lang="scss">
	@import "./core.scss";

	.root {
		position: absolute;
		inset: 0;
		padding: $pad-med;
		display: flex;
		flex-direction: column;
		gap: $pad-med;

		> * {
			flex: 0px 1 1;
		}

		> .group {
			flex: auto 0 0;
		}
	}

	.jpath-results {
		@extend .border-rnd;
		overflow-y: scroll;
		padding: $pad-med;

		> li {
			@extend .border-rnd, .hv;
			cursor: pointer;
			padding: $pad-small;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;

			&:not(:hover) {
				border-color: transparent;
			}
		}
	}
</style>
{#if model}
<div class="root">
	<div class="group">
		<button type="button" on:click={expandAll}>Expand All</button>
		<button type="button" on:click={collapseAll}>Collapse All</button>
	</div>
	<div class="group">
		<input class="jpath-input" type="text" bind:value={jpath} on:keypress={onKeyPress}/>
		<button type="button" on:click={evaluateJpath}>Evaluate</button>
	</div>
	<ul class="jpath-results">
		{#each jpathResults as path}
			<li on:click={() => model.select(path, true)}>{path}</li>
		{/each}
	</ul>
</div>
{/if}