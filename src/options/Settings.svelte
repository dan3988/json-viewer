<script lang="ts" context="module">
	type Tab = keyof typeof tabNames;

	const tabNames = {
		general: 'General',
		style: 'Appearance',
		network: 'Advanced',
	}

	const tabs: Tab[] = Object.keys(tabNames) as any;
</script>
<script lang="ts">
	import type { EditorModel, EntryRef } from "./editor";
	import type ThemeTracker from "../theme-tracker";
	import type ImmutableArray from "../immutable-array";
	import TabBar from "../shared/TabBar.svelte";
	import SchemeStyleSheet from "../shared/SchemeStyleSheet.svelte";
	import preferences from "../preferences-lite";
	import fs from "../fs";
	import SettingsGeneral from "./SettingsGeneral.svelte";
	import SettingsAppearance from "./SettingsAppearance.svelte";
    import schemes from "../schemes";
    import SettingsAdvanced from "./SettingsAdvanced.svelte";

	export let model: EditorModel<preferences.lite.Bag>;
	export let tracker: ThemeTracker;

	const webRequestPerm: chrome.permissions.Permissions = { permissions: ["webRequest"] };

	$: ({ changed, props: { darkMode, scheme, background } } = model);
	$: tracker.preferDark = $darkMode;
	$: currentScheme = schemes.presets[$scheme] as schemes.ColorScheme;
	$: maxIndentClass = schemes.getIndentCount(currentScheme, $tracker);

	async function save() {
		const bag: Dict = {};
		const { useWebRequest } = model.props;
		if (useWebRequest.changed) {
			const result = await chrome.permissions[useWebRequest ? "request" : "remove"](webRequestPerm);
			if (!result)
				useWebRequest.reset();
		}

		for (const key of $changed)
			bag[key] = model.props[key].value;

		await preferences.lite.manager.set(bag);

		model.commit();
		canSave = false;
	}

	async function exportSettings() {
		const settings = await preferences.lite.manager.get();
		const indent = settings.indentChar.repeat(settings.indentCount);
		const json = JSON.stringify(settings, undefined, indent);
		await fs.saveFile(json, `jsonviewer-${new Date().toISOString().slice(0, -5)}`, 'json');
	}

	async function importSettings() {
		const file = await fs.openFile('json');
		if (file == null)
			return;

		try {
			const values = await file.text().then(JSON.parse);

			for (const setting of preferences.lite.values as readonly preferences.Preference<any, preferences.lite.Key>[]) {
				let value: any = values[setting.key];
				if (value !== undefined) {
					value = setting.type(value);
					const entry: EntryRef<any, any> = model.props[setting.key];
					entry.set(value);
				}
			}
		} catch (error) {
			console.warn({ error });
			alert(error.message);
		}
	}

	$: canSave = $changed.length > 0;
	let tab = (location.hash.substring(1) as Tab) || 'general';
	let first = false;

	$: !first ? (first = true) : location.hash = tab;

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

		--bs-btn-color: rgba(var(--jv-body-text-rgb), 0.5);
		--bs-btn-bg: transparent;
		--bs-btn-hover-color: rgba(var(--jv-body-text-rgb), 1);
		--bs-btn-hover-bg: var(--jv-tertiary-hover-bg);
		--bs-btn-active-color: rgba(var(--jv-body-text-rgb), 0.8);
		--bs-btn-active-bg: var(--jv-tertiary-active-bg);
		--bs-btn-active-border-color: var(--bs-btn-bg);
	}

	.tab-wrapper {
		--padding: .25rem;
		display: contents;
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<SchemeStyleSheet scheme={currentScheme} />
<div class="root bg-body overflow-hidden d-flex flex-column scheme" data-editor-bg={$background}>
	<div class="header bg-body-tertiary border-bottom gap-2">
		<img src="/res/icon128.png" alt="icon" />
		<span class="h3 m-0">Settings</span>
		<TabBar {tabs} bind:selected={tab}>
			<button slot="tab" let:tab let:active let:select class="btn tab-btn" class:active on:click={select}>
				{tabNames[tab]}
			</button>
		</TabBar>
		<div class="btn-group">
			<button class="btn btn-primary" title="Export" on:click={exportSettings}>
				<i class="bi-box-arrow-down"></i>
				Export
			</button>
			<button class="btn btn-primary" title="Import" on:click={importSettings}>
				<i class="bi-box-arrow-up"></i>
				Import
			</button>
		</div>
		<button class="btn btn-primary" disabled={!canSave} title="Save" on:click={save}>
			<i class="bi-floppy-fill"></i>
			Save
		</button>
	</div>
	<div class="panel-root d-flex flex-fill flex-column overflow-hidden">
		<div class="tab-wrapper" hidden={tab !== 'general'}>
			<SettingsGeneral {model} />
		</div>
		<div class="tab-wrapper" hidden={tab !== 'style'}>
			<SettingsAppearance {model} {maxIndentClass} />
		</div>
		<div class="tab-wrapper" hidden={tab !== 'network'}>
			<SettingsAdvanced {model} />
		</div>
	</div>
</div>