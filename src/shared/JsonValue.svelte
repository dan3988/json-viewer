<script lang="ts" context="module">
	import JSON5 from "json5";

	function shouldQuote(value: string) {
		try {
			JSON5.parse(value);
			return true;
		} catch (e) {
			return false;
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
	import type { EditAction } from "../edit-stack.js";
	import { renderValue } from "../renderer.js";
	import json from "../json.js";
	import edits from "../viewer/editor-helper.js";
	import JsonValueEditor from "./JsonValueEditor.svelte";

	export let model: ViewerModel;
	export let prop: json.JProperty;
	export let readonly = false;
	export let editing = false;
	export let onediting: VoidFunction | Falsy = undefined;

	let token: json.JValue;
	let value: any;
	let subtype: "string" | "number" | "boolean" | "null";

	$: setValue(prop.value as any);

	let lastId = 0;

	function setValue(v: json.JValue) {
		token?.changed.removeListener(onChanged);
		token = v;
		token.changed.addListener(onChanged);
		onChanged();
	}

	function onChanged() {
		({ value, subtype } = token);
	}

	function update(newValue: any, group: boolean) {
		let edit: EditAction;

		if (typeof newValue === 'object') {
			edit = edits.replace(prop, json(newValue));
		} else {
			edit = edits.setValue(token, newValue);
		}

		if (group && lastId == model.edits.counter) {
			model.edits.undo();
		}

		lastId = model.edits.push(edit)
	}
</script>
<div class="root json-{subtype}" class:editing>
	<JsonValueEditor {value} {serialize} {parse} renderer={renderValue} {onediting} autoSelect {readonly} bind:editing onfinish={update} />
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
		}
	}
</style>