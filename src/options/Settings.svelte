<script lang="ts">
	import settings from "../settings";
	import ThemeTracker from "../theme-tracker";
	import EditorModel, { type EntryRef } from "./editor";
	import ListEditor from "./ListEditor.svelte";

	const tracker = new ThemeTracker(document.documentElement);
	const indents = [
		["Tab", "\t"],
		["Space", " "]
	]

	async function save() {
		const bag: settings.SaveType = {};

		addIfDirty(bag, darkMode);
		addIfDirty(bag, enabled);
		addIfDirty(bag, mimes);
		addIfDirty(bag, whitelist);
		addIfDirty(bag, indentChar);
		addIfDirty(bag, indentCount);

		await settings.setValues(bag);

		model.commit();
	}

	function addIfDirty<K extends keyof settings.Settings>(bag: settings.SaveType, prop: EntryRef<K, settings.Settings[K]>) {
		if (prop.changed)
			bag[prop.key] = prop.value;
	}

	const loading = settings.get().then(v => {
		model = new EditorModel(v);
		model.addListener(() => canSave = true);
		({ darkMode, enabled, mimes, whitelist, indentChar, indentCount } = model.props);
		darkMode.subscribe(v => tracker.preferDark = v.value);
	});

	let canSave = false;
	let { darkMode, enabled, mimes, whitelist, indentChar, indentCount } = Object.prototype as typeof model["props"];
	let model: EditorModel<settings.SettingsBag>;
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.dirty:not(:invalid) {
		//background-color: #553;
	}

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

	.eq > * {
		flex: 1 1 0px;
	}
</style>
{#await loading}
	<p>Loading...</p>
{:then}
	<div class="base cr d-flex flex-column p-1 gap-1">
		<div class="input-group" class:dirty={$enabled.changed}>
			<label class="input-group-text flex-fill align-items-start gap-1">
				<input class="form-check-input" type="checkbox" bind:checked={$enabled.value}/>
				Enabled
			</label>
		</div>
		<div class="input-group eq" class:dirty={$darkMode.changed}>
			<span class="input-group-text">Theme</span>
			<span role="button" class="btn btn-outline-secondary" class:active={$darkMode.value == null} on:click={() => $darkMode.value = null}>Default</span>
			<span role="button" class="btn btn-outline-secondary" class:active={$darkMode.value === false} on:click={() => $darkMode.value = false}>Light</span>
			<span role="button" class="btn btn-outline-secondary" class:active={$darkMode.value === true} on:click={() => $darkMode.value = true}>Dark</span>
		</div>
		<div class="input-group grp-mimes list" class:dirty={$mimes.changed}>
			<ListEditor title="MIME Types" help="A list of mime types that the extension will try to parse as JSON." bind:items={$mimes.value}/>
		</div>
		<div class="input-group grp-whitelist list" class:dirty={$whitelist.changed}>
			<ListEditor title="Whitelist" help="A list of hosts to automatically load the extension for." bind:items={$whitelist.value}/>
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
		<button class="btn btn-primary" disabled={!canSave} on:click={save}>Save</button>
	</div>
{/await}