<script lang="ts">
    import { JsonTokenFilterFlags, JsonProperty } from "./json";
    import JSONPath from "./json-path";
    import { PropertyBag } from "./prop";
	import type { ViewerModel } from "./viewer-model";

	export let model: ViewerModel;

	let filter = "";
	let filterMode = JsonTokenFilterFlags.Both;

	$: model.filter(filter, filterMode);

	let jpath: string;
	let jpathResults: string[] = [];

	const props = new PropertyBag({ model });

	// props.bag.model.propertyChange.addListener(onModelPropertyChange);
	// props.propertyChange.addListener(evt => {
	// 	if (evt.property === "model") {
	// 		evt.oldValue.propertyChange.removeListener(onModelPropertyChange);
	// 		evt.newValue.propertyChange.addListener(onModelPropertyChange);
	// 	}
	// })

	// function onModelPropertyChange(evt: PropertyChangeEvent) {
	// }

	function setExpanded(expanded: boolean) {
		const stack: Iterator<JsonProperty>[] = [];
		let cur: Iterator<JsonProperty> = model.root.value.properties()
		while (true) {
			let r = cur.next();
			if (r.done) {
				let last = stack.pop();
				if (last == null)
					return;

				cur = last;
			} else {
				r.value.expanded = expanded;
				const it = r.value.value.properties();
				stack.push(it);
			}
		}
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
			jpathResults = JSONPath({ json: model.root.value.proxy, path: jpath, resultType: "pointer" });
			jpathResults.forEach((v, i, a) => a[i] = "$" + v);
		} catch (e) {
			jpathResults = [];
			console.error(e);
			alert(e);
		}
	}

	$: props.bag.model = model;
</script>
<style lang="scss">
	@import "./core.scss";

	.btn-clr {
		@extend .img-btn, .hv-b4;

		&:before {
			background-color: var(--col-border);
			--mask-image: url("chrome-extension://__MSG_@@extension_id__/res/clear.svg");
		}
	}

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
		<button type="button" class="btn" on:click={() => setExpanded(true)}>Expand All</button>
		<button type="button" class="btn" on:click={() => setExpanded(false)}>Collapse All</button>
	</div>
	<div class="group">
		<span class="lbl">Filter</span>
		<input class="filter-input control" type="text" bind:value={filter}/>
		<button type="button" class="btn btn-clr" on:click={() => filter = ""}></button>
		<select class="control" bind:value={filterMode}>
			<option value={JsonTokenFilterFlags.Both}>All</option>
			<option value={JsonTokenFilterFlags.Keys}>Keys</option>
			<option value={JsonTokenFilterFlags.Values}>Values</option>
		</select>
	</div>
	<div class="group">
		<span class="lbl">Path</span>
		<input class="jpath-input control" type="text" bind:value={jpath} on:keypress={onKeyPress}/>
		<button type="button" class="btn btn-clr" on:click={() => jpath = ""}></button>
		<button type="button" class="btn" on:click={evaluateJpath}>Evaluate</button>
	</div>
	<ul class="jpath-results">
		{#each jpathResults as path}
			<li on:click={() => model.select(path, true)}>{path}</li>
		{/each}
	</ul>
</div>
{/if}