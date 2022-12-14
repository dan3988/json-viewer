<script lang="ts">
	import settings from "../settings";
	import EditorModel, { type EntryValue } from "./editor";

	enum LimitUnit {
		B,
		KB,
		MB,
		GB
	}

	const units = [
		LimitUnit.B,
		LimitUnit.KB,
		LimitUnit.MB,
		LimitUnit.GB
	]

	const indents = [
		["Tab", "\t"],
		["Space", " "]
	]

	function getByteSize(limit: number, unit: LimitUnit): number {
		return limit * (1 << (10 * unit));
	}

	function getLimitUnit(limit: number): [limit: number, unit: LimitUnit] {
		let unit = units[0];
		let i = 0;
		while (true) {
			if (limit < 1024 || ++i === units.length)
				break;

			limit >>= 10;
			unit = units[i];
		}
		
		return [limit, unit];
	}

	interface SettingValues {
		enabled: boolean;
		limitValue: number;
		limitUnit: LimitUnit;
		limitEnabled: boolean;
		indentCount: number;
		indentChar: string;
	}

	function convertFrom(settings: settings.Settings): SettingValues {
		const [limitValue, limitUnit] = getLimitUnit(settings.limitSize);
		const { enabled, limitEnabled, indentCount, indentChar } = settings;
		return { enabled, limitEnabled, limitUnit, limitValue, indentCount, indentChar };
	}

	async function load() {
		const v = await settings.get();
		const settingValues = convertFrom(v);
		editor.update(settingValues);
	}

	function addDirty<K extends keyof (SettingValues | settings.Settings)>(bag: settings.SaveType, entry: EntryValue<K, SettingValues[K]>) {
		if (entry.isDirty)
			bag[entry.key] = entry.value;
	}

	async function save() {
		const bag: settings.SaveType = {};
		if (limitValue.isDirty || limitUnit.isDirty) {
			const limitSize = getByteSize(limitValue.value, limitUnit.value);
			bag.limitSize = limitSize;
		}

		addDirty(bag, limitEnabled);
		addDirty(bag, enabled);
		addDirty(bag, indentChar);
		addDirty(bag, indentCount);

		await settings.setValues(bag);
	}

	const def = convertFrom(settings.getDefault());
	const editor = new EditorModel(def);
	const { enabled, limitEnabled, limitUnit, limitValue, indentChar, indentCount } = editor.values;
	const loading = load();
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.base {
		display: grid;
		grid-template-columns: 7rem 1fr 7rem;
		grid-row-gap: 5px;
		width: 500px;
		margin: auto;

		> .group {
			display: contents;
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
		<div class="group grp-enabled">
			<label class="check">
				<input class="control border" type="checkbox" bind:checked={$enabled}/>
				Enabled
			</label>
		</div>
		<div class="group grp-limit-enabled">
			<label class="check">
				<input class="control border" type="checkbox" bind:checked={$limitEnabled}/>
				JSON Size Limit
			</label>
		</div>
		<div class="group grp-limit-value">
			<span class="lbl border">Size limit</span>
			<input class="control" type="number" step="any" inputmode="numeric" bind:value={$limitValue}/>
			<select class="control" bind:value={$limitUnit}>
				{#each units as unit}
					<option value={unit}>{LimitUnit[unit]}</option>
				{/each}
			</select>
		</div>
		<div class="group grp-indent">
			<span class="lbl">Indent</span>
			<input class="control" type="number" inputmode="numeric" bind:value={$indentCount}/>
			<select class="control" bind:value={$indentChar}>
				{#each indents as [key, value]}
					<option value={value}>{key}</option>
				{/each}
			</select>
		</div>
		<button class="btn border control lt" on:click={save}>Save</button>
	</div>
{/await}