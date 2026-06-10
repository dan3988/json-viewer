<script lang="ts" module>
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
	import SchemeStyleSheet from "../shared/SchemeStyleSheet.svelte";
	import preferences from "../preferences-lite";
	import fs from "../fs";
	import schemes from "../schemes";
	import TabBar from "../shared/TabBar.svelte";
	import TabGeneral from "./TabGeneral.svelte";
	import TabAppearance from "./TabAppearance.svelte";
	import TabAdvanced from "./TabAdvanced.svelte";
	import { CustomScheme } from "./custom-scheme";
	import { untrack } from "svelte";

	interface Props {
		model: EditorModel<preferences.lite.Bag>;
	}

	const { model }: Props = $props();

	const tracker = new ThemeTracker();
	const webRequestPerm: chrome.permissions.Permissions = { permissions: ["webRequest"] };

	let unsub: undefined | Unsubscriber = undefined;
	let schemeEditor: CustomScheme = $state(undefined!);

	const {
		changed,
		props: {
			darkMode,
			schemeDark,
			schemeLight,
			background,
			customSchemes,
			fontSize,
			fontFamily,
		},
	} = $derived(model);

	$effect(() => void (tracker.preferDark = $darkMode));

	const scheme = $derived($tracker ? $schemeDark : $schemeLight);
	const currentScheme = $derived(schemeEditor.scheme);
	const maxIndentClass = $derived($currentScheme.indents.length);

	$effect.pre(() => updateSchemeEditor(scheme));

	function updateSchemeEditor(scheme: string) {
		untrack(() => {
			schemeEditor = new CustomScheme($customSchemes[scheme] ?? schemes.loadPreset(scheme));
			unsub?.();
			unsub = schemeEditor.scheme.listen(v => {
				if (scheme in schemes.presets)
					return;

				const copy = { ...$customSchemes };
				copy[scheme] = v as any;
				customSchemes.set(copy);
			});
		});
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

	const canSave = $derived($changed.length > 0);

	let selectedTab: Tab = $state((location.hash.substring(1) as Tab) || 'general');
	let count = 0;

	$effect(() => {
		const tab = selectedTab;
		++count === 1 || (location.hash = tab);
	});

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
<svelte:window onbeforeunload={onUnload} />
<SchemeStyleSheet scheme={$currentScheme} darkMode={$tracker} fontSize={$fontSize} fontFamily={$fontFamily} />
<div class="root bg-body overflow-hidden d-flex flex-column scheme" data-editor-bg={$background}>
	<div class="header bg-body-tertiary border-bottom gap-2">
		<img src="/res/icon128.png" alt="icon" />
		<span class="h3 m-0">Settings</span>
		<TabBar {tabs} bind:selected={selectedTab}>
			{#snippet tab(tabId, active, select)}
				<button class="btn btn-faded" class:active onclick={select}>
					{tabNames[tabId]}
				</button>
			{/snippet}
		</TabBar>
		<div class="btn-group">
			<button class="btn btn-primary" title="Export" onclick={exportSettings}>
				<i class="bi-box-arrow-down"></i>
				Export
			</button>
			<button class="btn btn-primary" title="Import" onclick={importSettings}>
				<i class="bi-box-arrow-up"></i>
				Import
			</button>
		</div>
		<button class="btn btn-primary" disabled={!canSave} title="Save" onclick={save}>
			<i class="bi-floppy-fill"></i>
			Save
		</button>
	</div>
	<div class="panel-root d-flex flex-fill flex-column overflow-hidden">
		<div class="tab-wrapper" hidden={selectedTab !== 'general'}>
			<TabGeneral {model} />
		</div>
		<div class="tab-wrapper" hidden={selectedTab !== 'style'}>
			<TabAppearance {model} {tracker} {maxIndentClass} bind:schemeEditor />
		</div>
		<div class="tab-wrapper" hidden={selectedTab !== 'network'}>
			<TabAdvanced {model} />
		</div>
	</div>
</div>