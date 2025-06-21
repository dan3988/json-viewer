<script lang="ts" context="module">
	import JSON5 from "json5";

	function shouldQuote(value: string) {
		try {
			JSON5.parse(value);
			return true;
		} catch (e) {
			return false;""
		}
	}

	function serialize(value: any): string {
		if (typeof value === 'string' && !shouldQuote(value))
			return value;

		return JSON.stringify(value);
	}
	
	function parse(text: string): any {
		try {
			return JSON5.parse(text);
		} catch (e) {
			return String(text);
		}
	}
</script>
<script lang="ts">
	import type { ViewerModel } from "../viewer-model.js";
	import { renderValue } from "../renderer.js";
	import json from "../json.js";
	import edits from "../viewer/editor-helper.js";
	import JsonValueEditor from "./JsonValueEditor.svelte";

	export let model: ViewerModel;
	export let prop: json.JProperty;

	let editing = false;

	$: value = prop.value as json.JValue;

	function update(value: any) {
		edits.replace(model, prop, json(value));
	}
</script>
<div class="root json-{value.subtype}" class:editing>
	<JsonValueEditor value={value.value} {serialize} {parse} renderer={renderValue} autoSelect checkEqual bind:editing onfinish={update} />
</div>
<style lang="scss">
	@use "../core.scss" as *;

	.root {
		display: flex;
		user-select: text;
		white-space: nowrap;
		cursor: text;

		&.json-string {
			color: var(--jv-str-fg);
		}

		&.json-number {
			color: var(--jv-num-fg);
		}

		&.json-boolean,
		&.json-null {
			color: var(--jv-keywd-fg);
		}

		&.editing {
			padding: 0 $pad-med;
			z-index: 1;
			background-color: var(--jv-tertiary-active-bg);
			color: var(--jv-tertiary-active-text);
			border-radius: var(--bs-border-radius);
			border: 1px solid var(--jv-tertiary-active-border);
			margin: -1px;
		}
	}
</style>