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
	import ListEditor from "./ListEditor.svelte";
	import { onDestroy, onMount } from "svelte";

	export let indentStyles: IndentStyles;
	export let model: EditorModel<settings.SettingsBag>;
	export let tracker: ThemeTracker;

	let destroy: Action;

	onMount(() => {
		const unsub = model.props.darkMode.subscribe(v => tracker.preferDark = v.value);
		model.addListener(onModelChange);
		destroy = () => {
			unsub();
			model.removeListener(onModelChange);
		}
	})

	onDestroy(() => destroy())

	$: ({ darkMode, enabled, mimes, whitelist, blacklist, indentChar, indentCount, indentStyle } = model.props);

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

	.grp-indent > select {
		flex: 0 0 6rem;
	}

	.base {
		justify-content: stretch;
		width: 500px;
		margin: auto;
	}

	@media only screen and (max-width: 500px) {
		.base {
			width: 100%;
		}
	}

	.grp-theme > * {
		flex: 1 1 0px;

		&.active {
			z-index: 3;
		}
	}
</style>
<div class="base cr d-flex flex-column p-1 gap-1">
	<div class="input-group" class:dirty={$enabled.changed}>
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$enabled.value}/>
			Enabled
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
		<input class="form-control" class:dirty={$indentCount.changed} type="number" inputmode="numeric" bind:value={$indentCount.value}/>
		<select class="form-select" class:dirty={$indentChar.changed} bind:value={$indentChar.value}>
			{#each indents as [key, value]}
				<option value={value}>{key}</option>
			{/each}
		</select>
	</div>
	<div class="input-group grp-indent-style">
		<span class="input-group-text">Intent Style</span>
		<select class="form-select" class:dirty={$indentStyle.changed} bind:value={$indentStyle.value}>
			{#each Object.entries(indentStyles) as [key, theme]}
				<option value={key}>{theme.name}</option>
			{/each}
		</select>
	</div>
	<button class="btn btn-primary" disabled={!canSave} on:click={save}>Save</button>
</div>