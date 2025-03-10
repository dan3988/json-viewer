<script lang="ts" context="module">
	export type SchemeRef = [id: string, scheme: schemes.ColorScheme];

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
	import type { Unsubscriber } from "svelte/store";
	import ThemeTracker from "../theme-tracker";
	import TabBar from "../shared/TabBar.svelte";
	import SchemeStyleSheet from "../shared/SchemeStyleSheet.svelte";
	import preferences from "../preferences-lite";
	import fs from "../fs";
	import schemes from "../schemes";
	import TabGeneral from "./TabGeneral.svelte";
	import TabAppearance from "./TabAppearance.svelte";
	import TabAdvanced from "./TabAdvanced.svelte";
	import { CustomScheme } from "./custom-scheme";

	export let model: EditorModel<preferences.lite.Bag>;

	const tracker = new ThemeTracker();
	const webRequestPerm: chrome.permissions.Permissions = { permissions: ["webRequest"] };

	let schemeEditor: CustomScheme;

	$: ({ changed, props: { darkMode, schemeDark, schemeLight, background, customSchemes } } = model);
	$: tracker.preferDark = $darkMode;
	$: scheme = $tracker ? $schemeDark : $schemeLight;
	$: updateSchemeEditor(scheme);
	$: currentScheme = schemeEditor.scheme;
	$: maxIndentClass = $currentScheme.indents.length;
	$: schemeEditor, onSchemeEditorChanged();

	let unsub: undefined | Unsubscriber;

	function updateSchemeEditor(scheme: string) {
		schemeEditor = new CustomScheme($customSchemes[scheme] ?? schemes.presets[scheme]);
	}

	function onSchemeEditorChanged() {
		unsub?.();
		unsub = schemeEditor.scheme.listen(v => {
			if (scheme in schemes.presets)
				return;

			const copy = { ...$customSchemes };
			copy[scheme] = v as any;
			customSchemes.set(copy);
		})
	}

	async function save() {
		const bag: Dict = {};
		const { useWebRequest } = model.props;
		if (useWebRequest.changed) {
			const result = await chrome.permissions[useWebRequest ? "request" : "remove"](webRequestPerm);
			if (!result)
				useWebRequest.reset();
		}

		for (const key of $changed) {
			const preference = preferences.lite.manager.getPreference(key);
			const value = model.props[key].value;
			bag[key] = preference.serialize(value);
		}

		await preferences.lite.manager.set(bag);

		model.commit();
		canSave = false;
	}

	async function exportSettings() {
		const values = await preferences.lite.manager.get();
		const result: any = {};
		for (const setting of preferences.lite.values as readonly preferences.core.Preference<any, preferences.lite.Key>[]) {
			let value: any = values[setting.key];
			if (value !== undefined)
				result[setting.key] = setting.serialize(value);
		}

		const indent = values.indentChar.repeat(values.indentCount);
		const json = JSON.stringify(result, undefined, indent);
		await fs.saveFile(json, `jsonviewer-${new Date().toISOString().slice(0, -5)}`, 'json');
	}

	async function importSettings() {
		const file = await fs.openFile('json');
		if (file == null)
			return;

		try {
			const values = await file.text().then(JSON.parse);

			for (const setting of preferences.lite.values as readonly preferences.core.Preference<any, preferences.lite.Key>[]) {
				let value: any = values[setting.key];
				if (value !== undefined) {
					value = setting.deserialize(value);
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
	@forward "../globals.scss";

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

	.tab-wrapper {
		--padding: .25rem;
		display: contents;
	}
</style>
<svelte:window on:beforeunload={onUnload} />
<SchemeStyleSheet scheme={$currentScheme} darkMode={$tracker} />
<div class="root bg-body overflow-hidden d-flex flex-column scheme" data-editor-bg={$background}>
	<div class="header bg-body-tertiary border-bottom gap-2">
		<img src="/res/icon128.png" alt="icon" />
		<span class="h3 m-0">Settings</span>
		<TabBar {tabs} bind:selected={tab}>
			<button slot="tab" let:tab let:active let:select class="btn btn-faded" class:active on:click={select}>
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
			<TabGeneral {model} />
		</div>
		<div class="tab-wrapper" hidden={tab !== 'style'}>
			<TabAppearance {model} {tracker} {maxIndentClass} bind:schemeEditor />
		</div>
		<div class="tab-wrapper" hidden={tab !== 'network'}>
			<TabAdvanced {model} />
		</div>
	</div>
</div>