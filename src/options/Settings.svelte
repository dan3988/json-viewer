<script lang="ts" context="module">
	import type { ListValidator } from "./ListEditor.svelte";

	class SettingListValidator implements ListValidator {
		readonly #validation: [] | [RegExp, string];

		constructor()
		constructor(regex: RegExp, message: string)
		constructor(...args: [] | [RegExp, string]) {
			this.#validation = args;
		}

		validate(items: readonly string[], index: number, item: string): string | undefined {
			const existing = items.indexOf(item);
			if (existing >= 0 && existing != index)
				return "Duplicate";

			if (this.#validation.length) {
				const [regex, msg] = this.#validation;
				regex.lastIndex = 0;
				if (!regex.test(item))
					return msg;
			}
		}
	}

	const mimeValidator = new SettingListValidator();
	const hostValidator = new SettingListValidator(/^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])(:\d{1,5})?$/gi, "Invalid hostname");
</script>
<script lang="ts">
	import type { IndentStyles } from "../types.d.ts";
	import type { EditorModel } from "./editor";
	import type ThemeTracker from "../theme-tracker";
	import settings from "../settings";
	import Linq from "@daniel.pickett/linq-js";
	import { onDestroy, onMount } from "svelte";
	import themes from "../json-themes.js";
	import ListEditor from "./ListEditor.svelte";
	import ViewerPreview from "./ViewerPreview.svelte";
	import NumberEditor from "../shared/NumberEditor.svelte";

	export let indentStyles: IndentStyles;
	export let model: EditorModel<settings.SettingsBag>;
	export let tracker: ThemeTracker;

	$: currentStyle = indentStyles[indentStyle.value] ?? Object.prototype;

	let showPreview = false;
	let unsub: Action;
	let schemeUnsub: Action;

	onMount(() => {
		unsub = model.props.darkMode.subscribe(v => tracker.preferDark = v.value);
		model.addListener(onModelChange);
	});

	onDestroy(() => {
		unsub();
		schemeUnsub?.();
		model.removeListener(onModelChange);
	});

	$: ({ darkMode, enabled, mimes, whitelist, blacklist, indentChar, indentCount, indentStyle, jsonStyle, useHistory } = model.props);
	$: {
		schemeUnsub?.();
		schemeUnsub = jsonStyle.subscribe(v => document.documentElement.dataset["scheme"] = v.value);
	}

	function onModelChange(this: EditorModel) {
		canSave = this.changed.size > 0;
	}

	const indents = [
		["Tab", "\t"],
		["Space", " "]
	]

	async function save() {
		const bag: settings.SaveType = {};

		for (const key of model.changed)
			bag[key] = <any>model.props[key].value;

		await settings.setValues(bag);

		model.commit();
		canSave = false;
	}

	let canSave = false;	
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	@media only screen and (max-width: 500px) {
		.base {
			width: 100%;
		}
	}

	.grp-indent > select {
		flex: 0 0 6rem;
	}

	.base {
		justify-content: stretch;
		width: 500px;
		margin: auto;
	}

	.input-group-text {
		flex: 0 0 9rem;
	}

	.grp-theme > .btn {
		flex: 1 1 0px;

		&.active {
			z-index: 3;
		}
	}

	.grp-preview {
		overflow: hidden;

		> .preview-head {
			flex: 0 0 0px;
			margin: -1px;
			display: flex;
			padding: $pad-med;
		}

		&.expanded {
			height: 20rem;

			> .preview-head {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
			}
		}
	}

	.indent-preview {
		height: 2.5rem;
		border-top-left-radius: 0 !important;
		border-bottom-left-radius: 0 !important;

		> li {
			background-color: var(--json-indent-bg);
		}
	}

	@media only screen and (max-width: 500px) {
		.base {
			width: 100%;
		}
	}
</style>
<svelte:head>
	<link rel="stylesheet" href="/lib/indent-styles.{$indentStyle.value}.css" />
</svelte:head>
<div class="base cr d-flex flex-column p-1 gap-1">
	<div class="input-group" class:dirty={$enabled.changed}>
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$enabled.value}/>
			Enabled
		</label>
	</div>
	<div class="input-group" class:dirty={$useHistory.changed}>
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$useHistory.value}/>
			Use History
		</label>
	</div>
	<div class="input-group grp-theme" class:dirty={$darkMode.changed}>
		<span class="input-group-text">Theme</span>
		<span role="button" class="btn btn-cust-light" class:active={$darkMode.value == null} on:click={() => $darkMode.value = null}>Auto</span>
		<span role="button" class="btn btn-cust-light" class:active={$darkMode.value === false} on:click={() => $darkMode.value = false}>Light</span>
		<span role="button" class="btn btn-cust-light" class:active={$darkMode.value === true} on:click={() => $darkMode.value = true}>Dark</span>
	</div>
	<div class="input-group grp-mimes list" class:dirty={$mimes.changed}>
		<ListEditor title="MIME Types" help="A list of mime types that the extension will try to parse as JSON." validator={mimeValidator} bind:items={$mimes.value}/>
	</div>
	<div class="input-group grp-whitelist list" class:dirty={$whitelist.changed}>
		<ListEditor title="Whitelist" help="A list of hosts to automatically load the extension for." validator={hostValidator} bind:items={$whitelist.value}/>
	</div>
	<div class="input-group grp-whitelist list" class:dirty={$blacklist.changed}>
		<ListEditor title="Blacklist" help="A list of hosts to not load the extension for." validator={hostValidator} bind:items={$blacklist.value}/>
	</div>
	<div class="input-group grp-indent">
		<span class="input-group-text">Indent</span>
		<NumberEditor class="form-control {$indentCount.changed ? "dirty" : ""}" bind:value={$indentCount.value} type="integer" min={1} max={10}/>
		<select class="form-select" class:dirty={$indentChar.changed} bind:value={$indentChar.value}>
			{#each indents as [key, value]}
				<option value={value}>{key}</option>
			{/each}
		</select>
	</div>
	<div class="input-group grp-indent-style">
		<span class="input-group-text">Indent Style</span>
		<select class="form-select flex-fill" class:dirty={$indentStyle.changed} bind:value={$indentStyle.value}>
			{#each Object.entries(indentStyles) as [key, theme]}
				<option value={key}>{theme.name}</option>
			{/each}
		</select>
		<ul class="indent-preview m-0 p-0 flex-fill d-flex border rounded overflow-hidden">
			{#each Linq.range(0, currentStyle.indents).toArray() as i}
				<li data-indent={i} class="flex-fill json-indent"></li>
			{/each}
		</ul>
	</div>
	<div class="input-group grp-json-style">
		<span class="input-group-text">Colour Scheme</span>
		<select class="form-select flex-fill" class:dirty={$jsonStyle.changed} bind:value={$jsonStyle.value}>
			{#each Object.entries(themes) as [id, name]}
				<option value={id}>{name}</option>
			{/each}
		</select>
	</div>
	<div class="grp-preview bg-tetiary border rounded d-flex flex-column overflow-hidden expandable" class:expanded={showPreview}>
		<div class="preview-head bg-body-tertiary border">
			<span class="flex-fill">Preview</span>
			<span class="expander btn btn-cust-light border-0" on:click={() => showPreview = !showPreview} />
		</div>
		<div class="preview-wrapper expandable-content overflow-auto p-1">
			<ViewerPreview maxIndentClass={currentStyle.indents} />
		</div>
	</div>
	<button class="btn btn-primary" disabled={!canSave} on:click={save}>Save</button>
</div>