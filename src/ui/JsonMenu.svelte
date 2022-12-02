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

	function clearFilter(this: HTMLElement) {
		filter = "";
		(this.previousElementSibling as HTMLElement).focus();
	}

	function clearJpath(this: HTMLElement) {
		jpath = "";
		(this.previousElementSibling as HTMLElement).focus();
	}

	function jpathItemEvent(path: string, evt: MouseEvent | KeyboardEvent) {
		if (evt.type === "click" || (evt.type === "keypress" && (evt as KeyboardEvent).code === "Space")) {
			evt.preventDefault();
			model.select(path, true);
		}
	}

	$: props.bag.model = model;
</script>
<style lang="scss">
	@use "./core.scss" as *;

	.btn-clr {
		@include img-btn;
		@include hv-b4;

		&:before {
			background-color: var(--col-border);
			--mask-image: url("chrome-extension://__MSG_@@extension_id__/res/clear.svg");
		}
	}

	.root {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-rows: auto auto auto 1fr;
		grid-template-columns: 6rem auto 2rem 6rem;
		grid-row-gap: $pad-med;
		flex-direction: column;
		
		> * {
			grid-column: 1 / -1;
		}

		> .group.field {
			display: contents;

			> :last-child {
				grid-column-end: -1;
			}
		}
	}

	.jpath-results {
		@include border-rnd;
		@include font-elem;

		--font-family: monospace;
		overflow-y: scroll;
		padding: $pad-med;

		> li {
			@include border-rnd;
			@include hv;

			cursor: pointer;
			padding: $pad-small;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;

			&:hover {
				background-color: var(--col-bg-lt);
			}

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
	<div class="group field">
		<span class="lbl">Filter</span>
		<input class="filter-input control" type="text" bind:value={filter}/>
		<button type="button" class="btn btn-clr" on:click={clearFilter}></button>
		<select class="filter-type control" bind:value={filterMode}>
			<option value={JsonTokenFilterFlags.Both}>All</option>
			<option value={JsonTokenFilterFlags.Keys}>Keys</option>
			<option value={JsonTokenFilterFlags.Values}>Values</option>
		</select>
	</div>
	<div class="group field">
		<span class="lbl">Path</span>
		<input class="jpath-input control" type="text" bind:value={jpath} on:keypress={onKeyPress}/>
		<button type="button" class="btn btn-clr" on:click={clearJpath}></button>
		<button type="button" class="btn btn-eval" on:click={evaluateJpath}>Evaluate</button>
	</div>
	<ul class="jpath-results">
		{#each jpathResults as path}
			<li tabindex="0" on:keypress={e => jpathItemEvent(path, e)} on:click={e => jpathItemEvent(path, e)}>{path}</li>
		{/each}
	</ul>	
</div>
{/if}