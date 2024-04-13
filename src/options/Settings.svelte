<script lang="ts" context="module">
	import type { ListValidator } from "./ListEditor.svelte";
	import type { NamedRadioItem } from "./Radio.svelte";
	import Linq from "@daniel.pickett/linq-js";
	import schemes from "../schemes.json";
	import schemeModes, { getValueByMode, type Scheme } from "../scheme-modes";

	class SettingListValidator implements ListValidator {
		readonly #validation: [] | [RegExp, string];

		constructor()
		constructor(regex: RegExp, message: string)
		constructor(...args: [] | [RegExp, string]) {
			this.#validation = args;
		}

		validate(items: ImmutableArray<string>, index: number, item: string): string | undefined {
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

	const groupedSchemes = Linq.fromObject(schemes)
		.select(([id, { mode, name }]) => ({ id, mode, name }))
		.orderBy(v => v.name)
		.groupBy(v => v.mode)
		.orderBy(v => v.key)
		.select(v => [schemeModes[v.key][1], Linq(v).select(({ id, name }) => [id, name] as const).toArray()] as const)
		.toArray();

	const mimeValidator = new SettingListValidator();
	const hostValidator = new SettingListValidator(/^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])(:\d{1,5})?$/gi, "Invalid hostname");

	const radioMenuAlign: NamedRadioItem<"l" | "r">[] = [["l", "Left"], ["r", "Right"]];
	const radioTheme: NamedRadioItem<boolean | null>[] = [[null, "Auto"], [false, "Light"], [true, "Dark"]];
</script>
<script lang="ts">
	import type { EditorModel } from "./editor";
	import type ThemeTracker from "../theme-tracker";
	import { onDestroy, onMount } from "svelte";
	import ListEditor from "./ListEditor.svelte";
	import ViewerPreview from "./ViewerPreview.svelte";
	import NumberEditor from "../shared/NumberEditor.svelte";
	import Radio from "./Radio.svelte";
	import preferences from "../preferences-lite";
    import type ImmutableArray from "../immutable-array";

	export let model: EditorModel<preferences.lite.Bag>;
	export let tracker: ThemeTracker;

	let showPreview = false;

	const webRequestPerm: chrome.permissions.Permissions = { permissions: ["webRequest"] };

	function updateTheme(scheme: Scheme, userPref: null | boolean) {
		tracker.preferDark = getValueByMode(scheme.mode, userPref);
	}

	onMount(() => {
		model.addListener(onModelChange);
	});

	onDestroy(() => {
		model.removeListener(onModelChange);
	});

	$: ({ darkMode, enabled, mimes, whitelist, blacklist, indentChar, indentCount, scheme, useHistory, menuAlign, background, useWebRequest } = model.props);
	$: currentScheme = schemes[$scheme.value];
	$: {
		updateTheme(currentScheme, $darkMode.value);
		document.documentElement.dataset["scheme"] = $scheme.value;
	}

	function onModelChange(this: EditorModel) {
		canSave = this.changed.size > 0;
	}

	const indents = [
		["Tab", "\t"],
		["Space", " "]
	]

	async function save() {
		const bag: Dict = {};
		const { useWebRequest } = model.props;
		if (useWebRequest.changed) {
			const result = await chrome.permissions[useWebRequest.value ? "request" : "remove"](webRequestPerm);
			if (!result)
				useWebRequest.reset();
		}

		for (const key of model.changed)
			bag[key] = model.props[key].value;

		await preferences.lite.manager.set(bag);

		model.commit();
		canSave = false;
	}

	let canSave = false;

	function onUnload(evt: BeforeUnloadEvent) {
		evt.returnValue = canSave || "";
	}
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
		flex: 0 0 9.5rem;
	}

	.grp-theme > .btn {
		flex: 1 1 0px;
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
		margin: 0;
		height: 2.5rem;
		border-top-left-radius: 0 !important;
		border-bottom-left-radius: 0 !important;

		> li {
			background-color: var(--json-indent-bg);
		}
	}

	.preview-wrapper {
		overflow: hidden;
		flex: 1 1 0px;
		position: relative;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		grid-template-areas: "main";

		> * {
			grid-area: main;
		}
	}

	.editor-bg {
		position: absolute;
		pointer-events: none;
		inset: 0;
		z-index: -1;
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<div class="base cr d-flex flex-column p-1 gap-1" data-editor-bg={$background.value}>
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
	<div class="input-group" class:dirty={$useWebRequest.changed}>
		<label class="input-group-text flex-fill align-items-start gap-1">
			<input class="form-check-input" type="checkbox" bind:checked={$useWebRequest.value}/>
			Show Request Headers
		</label>
	</div>
	<div class="input-group hoverable-radio grp-menu-align" role="group" class:dirty={$menuAlign.changed}>
		<span class="input-group-text">Menu Alignment</span>
		<Radio class="flex-fill btn btn-cust-light" items={radioMenuAlign} bind:value={$menuAlign.value}></Radio>
	</div>
	<div class="input-group hoverable-radio grp-theme" role="group" class:dirty={$darkMode.changed}>
		<span class="input-group-text">Theme</span>
		<Radio class="flex-fill btn btn-cust-light" items={radioTheme} bind:value={$darkMode.value}/>
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
	<div class="input-group grp-json-bg">
		<span class="input-group-text">Background</span>
		<select class="form-select flex-fill" class:dirty={$background.changed} bind:value={$background.value}>
			<option value="">None</option>
			<option value="bricks">Bricks</option>
			<option value="cubes">Cubes</option>
			<option value="cross">Cross</option>
			<option value="hive">Honeycomb</option>
			<option value="plaid">Plaid</option>
			<option value="tiles">Tiles</option>
			<option value="triangles">Triangles</option>
			<option value="web">Web</option>
		</select>
	</div>
	<div class="input-group grp-json-style">
		<span class="input-group-text">Colour Scheme</span>
		<select class="form-select flex-fill" class:dirty={$scheme.changed} bind:value={$scheme.value}>
			{#each groupedSchemes as [ label, themes ]}
				<optgroup {label}>
					{#each themes as [ id, name ]}
						<option value={id}>{name}</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
	<div class="grp-preview bg-tetiary border rounded d-flex flex-column overflow-hidden expandable" class:expanded={showPreview}>
		<div class="preview-head bg-body-tertiary border">
			<span class="flex-fill">Preview</span>
			<span class="expander btn btn-cust-light border-0" on:click={() => showPreview = !showPreview} />
		</div>
		<div class="preview-wrapper expandable-content">
			<div class="overflow-auto p-1">
				<ViewerPreview maxIndentClass={currentScheme.indents} />
			</div>
			<div class="editor-bg"></div>
		</div>
	</div>
	<button class="btn btn-primary" disabled={!canSave} on:click={save}>Save</button>
</div>