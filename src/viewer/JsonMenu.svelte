<script lang="ts">
	import type { ViewerModel } from "../viewer-model";
	import json from "../json";
	import edits from "./editor-helper";
	import { JSONPath, type JSONPathAllResult } from "jsonpath-plus";

	interface Props {
		model: ViewerModel;
	}

	const { model }: Props = $props();

	export function focusJPath() {
		jpath.focus();
	}

	let jpath: HTMLInputElement;
	let jpathResults: json.Node[] = $state([]);

	function onJpathKeyPress(evt: KeyboardEvent) {
		if (evt.key === "Enter")
			evaluateJpath();
	}

	function clearValidation(this: HTMLInputElement) {
		this.setCustomValidity("");
	}

	function unwrapValue({ parent, parentProperty }: JSONPathAllResult): json.Node {
		if (parent == null)
			return model.root;

		const container = json.unproxy(parent)!;
		return container.get(parentProperty!)!;
	}

	function evaluateJpath() {
		const path = jpath.value;
		if (!path) {
			jpathResults.length = 0;
			return;
		}

		try {
			const values = JSONPath({ json: model.root.value as any, path, resultType: "all" });
			for (let i = 0; i < values.length; i++)
				values[i] = unwrapValue(values[i]);

			jpathResults = values;
		} catch (e) {
			jpath.setCustomValidity(e.message);
			jpath.reportValidity();
			jpath.once("input", clearValidation);
			jpathResults.length = 0;
			console.error(e);
		}
	}

	function clearJpath(this: HTMLElement) {
		jpath.value = "";
		jpath.focus();
	}

	function jpathItemEvent(node: json.Node, evt: MouseEvent | KeyboardEvent) {
		if (evt.type === "click" || (evt.type === "keypress" && (evt as KeyboardEvent).code === "Space")) {
			evt.preventDefault();
			model.setSelected(node, true, true);
		}
	}

	/**
	 * Returns a list of jpath results, excluding any children of mathing containers
	 */
	function collapseResults(): Iterable<json.Node> {
		//this function assumes that matching parent containers appear before any matching children in the results array, which is the current behaviour of jsonpath-plus
		const results = new Set<json.Node>();

		function parentMapped(node: json.Node) {
			while (true) {
				if (results.has(node))
					return true;

				if (node.parent == null)
					return false;

				node = node.parent;
			}
		}

		for (const node of jpathResults)
			if (!parentMapped(node))
				results.add(node);

		return results.values();
	}

	function jpathResultsDelete() {
		model.edits.push(edits.remove(collapseResults()));
		jpathResults = [];
	}

	function jpathResultsExpand() {
		for (const result of jpathResults) {
			let node: null | json.Node = result;
			do {
				node.setExpanded(true);
				node = node.parent;
			} while (node != null);
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;

	.input-group:not(.field) > .btn,
	.input-group.field > .form-control {
		width: unset;
	}

	.root {
		display: grid;
		grid-template-rows: repeat(2, auto) 1fr;
		grid-template-columns: 4rem 2rem 1fr 2rem 6rem;
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
	<div class="input-group field">
		<span class="input-group-text">Path</span>
		<a class="btn btn-base bi bi-question-circle-fill" href="https://support.smartbear.com/alertsite/docs/monitors/api/endpoint/jsonpath.html" title="Syntax" target="_blank"></a>
		<input class="jpath-input form-control" type="text" bind:this={jpath} onkeypress={onJpathKeyPress}/>
		<button type="button" class="btn btn-base bi bi-x-lg" onclick={clearJpath}></button>
		<button type="button" class="btn btn-primary btn-eval" onclick={evaluateJpath}>Evaluate</button>
	</div>
	<div class="jpath-matches input-group">
		<span class="flex-fill0 input-group-text">{jpathResults.length} {jpathResults.length == 1 ? "Match" : "Matches"}</span>
		{#if jpathResults.length}
			<button class="flex-fill0 btn btn-base" onclick={jpathResultsExpand}>Expand Matches</button>
			<button class="flex-fill0 btn btn-base" onclick={jpathResultsDelete}>Delete Matches</button>
		{/if}
	</div>
	<ul class="jpath-results list-group list-group-flush overflow-y-scroll overflow-x-hidden border rounded">
		{#each jpathResults as item}
			<li tabindex="0" role="button" class="list-group-item list-group-item-action " onkeypress={e => jpathItemEvent(item, e)} onclick={e => jpathItemEvent(item, e)}>
				<div class="text-truncate">{item.path}</div>
			</li>
		{/each}
	</ul>
</div>
{/if}