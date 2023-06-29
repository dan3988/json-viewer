<script lang="ts">
	import { JsonTokenFilterFlags } from "../json";
	import JSONPath from "./json-path";
	import type { ViewerModel } from "../viewer-model";

	export let model: ViewerModel;

	export function focusSearch() {
		filterInput.focus();
	}

	export function focusJPath() {
		jpath.focus();
	}

	let filterInput: HTMLInputElement;
	let filter = "";
	let filterMode = JsonTokenFilterFlags.Both;

	$: model.filter(filter, filterMode);

	let jpath: HTMLInputElement;
	let jpathResults: string[] = [];

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

	function evaluateJpath() {
		const path = jpath.value;
		if (!path) {
			jpathResults = [];
			return;
		}

		try {
			jpathResults = JSONPath({ json: model.root.value.proxy, path, resultType: "pointer" });
			jpathResults.forEach((v, i, a) => a[i] = "$" + v);
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

	function jpathItemEvent(path: string, evt: MouseEvent | KeyboardEvent) {
		if (evt.type === "click" || (evt.type === "keypress" && (evt as KeyboardEvent).code === "Space")) {
			evt.preventDefault();
			model.select(path, true);
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
		overflow: auto;
		grid-template-rows: auto auto auto 1fr;
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
		<button type="button" class="flex-fill btn btn-cust-light" on:click={() => setExpanded(true)}>Expand All</button>
		<button type="button" class="flex-fill btn btn-cust-light" on:click={() => setExpanded(false)}>Collapse All</button>
	</div>
	<div class="input-group field">
		<span class="input-group-text">Filter</span>
		<input class="filter-input form-control" type="text" bind:value={filter} bind:this={filterInput}/>
		<button type="button" class="btn btn-cust-light btn-clr" on:click={clearFilter}></button>
		<select class="filter-type form-select" bind:value={filterMode}>
			<option value={JsonTokenFilterFlags.Both}>All</option>
			<option value={JsonTokenFilterFlags.Keys}>Keys</option>
			<option value={JsonTokenFilterFlags.Values}>Values</option>
		</select>
	</div>
	<div class="input-group field">
		<span class="input-group-text">Path</span>
		<input class="jpath-input form-control" type="text" bind:this={jpath} on:keypress={onJpathKeyPress}/>
		<button type="button" class="btn btn-cust-light btn-clr" on:click={clearJpath}></button>
		<button type="button" class="btn btn-primary btn-eval" on:click={evaluateJpath}>Evaluate</button>
	</div>
	<ul class="jpath-results list-group list-group-flush overflow-y-scroll overflow-x-hidden border rounded">
		{#each jpathResults as path}
			<li tabindex="0" role="button" class="list-group-item list-group-item-action " on:keypress={e => jpathItemEvent(path, e)} on:click={e => jpathItemEvent(path, e)}>
				<div class="text-truncate">{path}</div>
			</li>
		{/each}
	</ul>
</div>
{/if}