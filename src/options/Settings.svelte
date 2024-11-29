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

	type Tab = keyof typeof tabNames;

	const tabNames = {
		general: 'General',
		style: 'Appearance',
		network: 'Advanced',
	}

	const tabs: Tab[] = Object.keys(tabNames) as any;

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
	import type ImmutableArray from "../immutable-array";
	import { onDestroy, onMount } from "svelte";
	import TabBar from "../shared/TabBar.svelte";
	import ListEditor from "./ListEditor.svelte";
	import ViewerPreview from "./ViewerPreview.svelte";
	import NumberEditor from "../shared/NumberEditor.svelte";
	import Radio from "./Radio.svelte";
	import preferences from "../preferences-lite";

	export let model: EditorModel<preferences.lite.Bag>;
	export let tracker: ThemeTracker;

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
	let tab: Tab = 'style';

	function onUnload(evt: BeforeUnloadEvent) {
		if (canSave) {
			evt.returnValue = true;
			evt.preventDefault();
		}
	}
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	$breakpoint-s: 500px;
	$breakpoint-l: 960px;

	@media only screen and (max-width: $breakpoint-s) {
		.tab-short {
			--content-width: 100%;
		}
	}

	@media only screen and (max-width: $breakpoint-l) {
		.tab-network {
			--content-flex: 1 1 20rem;
			--flex-direction: column;
		}

		.tab-style {
			--start-flex: 0 0 auto;
			flex-direction: column;
		}
	}

	@media only screen and (min-width: $breakpoint-l) {
		.tab-network {
			--content-flex: 1 1 0;
			--flex-direction: row;
		}

		.tab-style {
			--start-flex: 0 0 #{$breakpoint-s};
			flex-direction: row;
		}
	}

	.root {
		position: absolute;
		inset: 0;
	}

	.header {
		display: flex;
		height: 4rem;
		align-items: center;

		> img {
			height: 100%;
		}
	}

	.tab-btn {
		--text-opacity: 0.5;
		border-color: var(--bs-btn-bg);
		
		--bs-btn-color: var(--bs-tertiary-color);
		--bs-btn-bg: transparent;
		--bs-btn-hover-color: var(--bs-secondary-color);
		--bs-btn-hover-bg: var(--cst-btn-hover-bg);
		--bs-btn-active-color: var(--bs-body);
		--bs-btn-active-bg: var(--cst-btn-active-bg);
		--bs-btn-active-border-color: var(--bs-btn-bg);
	}

	.tab {
		--padding: .25rem;
		overflow: hidden;
		padding: var(--padding);
		display: flex;
		gap: var(--padding);
		flex: 1 1 0;

		.tab-content {
			flex-direction: var(--flex-direction);
		}
	}

	.tab-content {
		flex: 1 1 0;
		display: flex;
		gap: var(--padding);
		overflow: hidden;
	}

	.tab-short {
		--content-width: #{$breakpoint-s};
		--flex-direction: column;
		width: var(--content-width);
	}

	.tab-left {
		display: flex;
		gap: var(--padding);
		flex: var(--start-flex);
		flex-direction: column;
	}

	.tab-network > .tab-content {
		overflow: hidden;
		width: $breakpoint-s;

		> * {
			flex: var(--content-flex);
		}
	}

	.grp-indent > :global(*) {
		flex: 1 1 0;
	}

	.panel {
		justify-content: stretch;
		width: $breakpoint-l;
		margin: 0.25rem auto 0.25rem 0.25rem;
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

			> .flex-fill {
				padding: 0 calc(0.75rem - $pad-med);
			}
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
		display: flex;
		flex-direction: column;
	}

	.editor-bg {
		position: absolute;
		pointer-events: none;
		inset: 0;
	}

	.list {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<div class="root bg-body overflow-hidden d-flex flex-column" data-editor-bg={$background.value}>
	<div class="header bg-body-tertiary border-bottom gap-2">
		<img src="/res/icon128.png" alt="icon" />
		<span class="h3 m-0">Settings</span>
		<TabBar {tabs} bind:selected={tab}>
			<button slot="tab" let:tab let:active let:select class="btn tab-btn" class:active on:click={select}>
				{tabNames[tab]}
			</button>
		</TabBar>
		<button class="btn btn-primary" disabled={!canSave} on:click={save}>Save</button>
	</div>
	<div class="panel-root d-flex flex-fill flex-column overflow-hidden">
		<div class="tab tab-short" hidden={tab !== 'general'}>
			<div class="tab-content">
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
				<div class="input-group grp-indent">
					<span class="input-group-text">Clipboard Indent</span>
					<NumberEditor class="form-control {$indentCount.changed ? "dirty" : ""}" bind:value={$indentCount.value} type="integer" min={1} max={10}/>
					<select class="form-select" class:dirty={$indentChar.changed} bind:value={$indentChar.value}>
						{#each indents as [key, value]}
							<option value={value}>{key}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>
		<div class="tab tab-style" hidden={tab !== 'style'}>
			<div class="tab-left">
				<div class="input-group hoverable-radio grp-menu-align" role="group" class:dirty={$menuAlign.changed}>
					<span class="input-group-text">Menu Alignment</span>
					<Radio class="flex-fill btn btn-cust-light" items={radioMenuAlign} bind:value={$menuAlign.value}></Radio>
				</div>
				<div class="input-group hoverable-radio grp-theme" role="group" class:dirty={$darkMode.changed}>
					<span class="input-group-text">Theme</span>
					<Radio class="flex-fill btn btn-cust-light" items={radioTheme} bind:value={$darkMode.value}/>
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
			</div>
			<div class="preview-wrapper border rounded">
				<div class="editor-bg"></div>
				<div class="overflow-auto p-1">
					<ViewerPreview maxIndentClass={currentScheme.indents} />
				</div>
			</div>
		</div>
		<div class="tab tab-network" hidden={tab !== 'network'}>
			<div class="tab-content">
				<div class="input-group grp-mimes list" class:dirty={$mimes.changed}>
					<ListEditor title="MIME Types" help="A list of mime types that the extension will try to parse as JSON." validator={mimeValidator} bind:items={$mimes.value}/>
				</div>
				<div class="input-group grp-whitelist list" class:dirty={$whitelist.changed}>
					<ListEditor title="Whitelist" help="A list of hosts to automatically load the extension for." validator={hostValidator} bind:items={$whitelist.value}/>
				</div>
				<div class="input-group grp-whitelist list" class:dirty={$blacklist.changed}>
					<ListEditor title="Blacklist" help="A list of hosts to not load the extension for." validator={hostValidator} bind:items={$blacklist.value}/>
				</div>
			</div>
		</div>
	</div>
</div>