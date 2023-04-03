<script lang="ts">
	import settings from "../settings";
	import EditorModel, { type EntryRef } from "./editor";
    import ListEditor from "./ListEditor.svelte";

	const indents = [
		["Tab", "\t"],
		["Space", " "]
	]

	async function save() {
		const bag: settings.SaveType = {};

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
		({ enabled, mimes, whitelist, indentChar, indentCount } = model.props);
	});

	let { enabled, mimes, whitelist, indentChar, indentCount } = Object.prototype as typeof model["props"];
	let model: EditorModel<settings.SettingsBag>;
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.dirty:not(:invalid) {
		background-color: #553;
	}

	.base {
		display: grid;
		grid-template-columns: 7rem 1fr 7rem;
		grid-row-gap: 5px;
		width: 500px;
		margin: auto;

		> .group {
			&.list {
				grid-column: 1 / -1;
			}

			&:not(.list) {
				display: contents;
			}

			&.dirty > * {
				@extend .dirty;
			}
		}

		> .grp-enabled > *,
		> .grp-limit-enabled > *,
		> .btn {
			grid-column: 1 / -1;
		}
	}

	@media only screen and (max-width: 500px) {
		.base {
			width: 100%;
		}
	}
</style>
{#await loading}
	<p>Loading...</p>
{:then}
	<div class="base cr">
		<div class="group grp-enabled" class:dirty={$enabled.changed}>
			<label class="check">
				<input class="control border" type="checkbox" bind:checked={$enabled.value}/>
				Enabled
			</label>
		</div>
		<div class="group grp-mimes list" class:dirty={$mimes.changed}>
			<ListEditor title="MIME Types" help="A list of mime types that the extension will try to parse as JSON." bind:items={$mimes.value}/>
		</div>
		<div class="group grp-whitelist list" class:dirty={$whitelist.changed}>
			<ListEditor title="Whitelist" help="A list of hosts to automatically load the extension for." bind:items={$whitelist.value}/>
		</div>
		<div class="group grp-indent">
			<span class="lbl">Indent</span>
			<input class="control" class:dirty={$indentCount.changed} type="number" inputmode="numeric" bind:value={$indentCount.value}/>
			<select class="control" class:dirty={$indentChar.changed} bind:value={$indentChar.value}>
				{#each indents as [key, value]}
					<option value={value}>{key}</option>
				{/each}
			</select>
		</div>
		<button class="btn border control lt" on:click={save}>Save</button>
	</div>
{/await}