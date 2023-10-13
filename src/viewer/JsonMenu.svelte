<script lang="ts">
	import type { JSONPathAllResult } from "jsonpath-plus";
	import json from "../json";
	import JSONPath from "../json-path";
	import type { ViewerModel } from "../viewer-model";

	export let model: ViewerModel;

	export function focusSearch() {
		filterInput.focus();
	}

	export function focusJPath() {
		jpath.focus();
	}

	const { canUndo, canRedo } = model.edits.bag.readables;

	let filterInput: HTMLInputElement;
	let filter = "";
	let filterMode = json.JTokenFilterFlags.Both;

	$: model.filter(filter, filterMode);

	let jpath: HTMLInputElement;
	let jpathResults: json.JProperty[] = [];

	function setExpanded(expanded: boolean) {
		model.root.setExpanded(expanded, true);
	}

	function onJpathKeyPress(evt: KeyboardEvent) {
		if (evt.key === "Enter")
			evaluateJpath();
	}

	function clearValidation(this: HTMLInputElement) {
		this.setCustomValidity("");
	}

	function unwrapValue({ parent, parentProperty }: JSONPathAllResult): json.JProperty {
		if (parent == null)
			return model.root;

		const container = json.unwrapProxy(parent)!;
		return container.getProperty(parentProperty!)!;
	}

	function evaluateJpath() {
		const path = jpath.value;
		if (!path) {
			jpathResults = [];
			return;
		}

		try {
			const values: any[] = JSONPath({ json: model.root.value.proxy, path, resultType: "all" });
			for (let i = 0; i < values.length; i++)
				values[i] = unwrapValue(values[i]);

			jpathResults = values;
		} catch (e) {
			jpath.setCustomValidity(e.message);
			jpath.reportValidity();
			jpath.once("input", clearValidation);
			jpathResults = [];
			console.error(e);
		}
	}

	function clearFilter(this: HTMLElement) {
		filter = "";
		(this.previousElementSibling as HTMLElement).focus();
	}

	function clearJpath(this: HTMLElement) {
		jpath.value = "";
		jpath.focus();
	}

	function jpathItemEvent(token: json.JProperty, evt: MouseEvent | KeyboardEvent) {
		if (evt.type === "click" || (evt.type === "keypress" && (evt as KeyboardEvent).code === "Space")) {
			evt.preventDefault();
			model.setSelected(token, true, true);
		}
	}

	/**
	 * Returns a list of jpath results, excluding any children of mathing containers
	 */
	function collapseResults(): Iterable<json.JProperty> {
		//this function assumes that matching parent containers appear before any matching children in the results array, which is the current behaviour of jsonpath-plus
		const results = new Set<json.JProperty>();

		function parentMapped(prop: json.JProperty) {
			while (true) {
				if (results.has(prop))
					return true;

				if (prop.parent == null)
					return false;

				prop = prop.parent.owner;
			}
		}

		for (const token of jpathResults)
			if (!parentMapped(token))
				results.add(token);

		return results.values();
	}

	function jpathResultsDelete() {
		for (const result of collapseResults())
			result.remove();

		jpathResults = [];
	}

	function jpathResultsExpand() {
		for (const result of jpathResults) {
			let prop: null | json.JProperty = result;
			do {
				prop.setExpanded(true);
				prop = prop.parentProperty
			} while (prop != null);
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.btn-clr {
		@include bs-icon-btn("x-lg", 20%);
	}

	.input-group:not(.field) > .btn,
	.input-group.field > .form-control,
	.input-group.field > .form-select {
		width: unset;
	}

	.root {
		display: grid;
		grid-template-rows: repeat(4, auto) 1fr;
		grid-template-columns: 6rem 1fr 2rem 6rem;
		grid-row-gap: $pad-med;
		align-items: stretch;

		> .field {
			display: contents;
		}
		
		> * {
			grid-column: 1 / -1;
		}
	}

	.jpath-results {
		font-family: monospace;
	}
</style>
{#if model}
<div class="root">
	<div class="btn-group">
		<button type="button" class="flex-fill0 btn btn-cust-light" on:click={() => setExpanded(true)}>Expand All</button>
		<button type="button" class="flex-fill0 btn btn-cust-light" on:click={() => setExpanded(false)}>Collapse All</button>
		<button type="button" class="flex-fill0 btn btn-cust-light" disabled={!$canUndo} on:click={() => model.edits.undo()}>Undo</button>
		<button type="button" class="flex-fill0 btn btn-cust-light" disabled={!$canRedo} on:click={() => model.edits.redo()}>Redo</button>
	</div>
	<div class="input-group field">
		<span class="input-group-text">Filter</span>
		<input class="filter-input form-control" type="text" bind:value={filter} bind:this={filterInput}/>
		<button type="button" class="btn btn-cust-light btn-clr" on:click={clearFilter}></button>
		<select class="filter-type form-select" bind:value={filterMode}>
			<option value={json.JTokenFilterFlags.Both}>All</option>
			<option value={json.JTokenFilterFlags.Keys}>Keys</option>
			<option value={json.JTokenFilterFlags.Values}>Values</option>
		</select>
	</div>
	<div class="input-group field">
		<span class="input-group-text">Path</span>
		<input class="jpath-input form-control" type="text" bind:this={jpath} on:keypress={onJpathKeyPress}/>
		<button type="button" class="btn btn-cust-light btn-clr" on:click={clearJpath}></button>
		<button type="button" class="btn btn-primary btn-eval" on:click={evaluateJpath}>Evaluate</button>
	</div>
	<div class="jpath-matches input-group">
		<span class="flex-fill0 input-group-text">{jpathResults.length} {jpathResults.length == 1 ? "Match" : "Matches"}</span>
		{#if jpathResults.length}
			<button class="flex-fill0 btn btn-cust-light" on:click={jpathResultsExpand}>Expand Matches</button>
			<button class="flex-fill0 btn btn-cust-light" on:click={jpathResultsDelete}>Delete Matches</button>
		{/if}
	</div>
	<ul class="jpath-results list-group list-group-flush overflow-y-scroll overflow-x-hidden border rounded">
		{#each jpathResults as item}
			<li tabindex="0" role="button" class="list-group-item list-group-item-action " on:keypress={e => jpathItemEvent(item, e)} on:click={e => jpathItemEvent(item, e)}>
				<div class="text-truncate">{item.pathText}</div>
			</li>
		{/each}
	</ul>
</div>
{/if}