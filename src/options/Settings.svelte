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
	}

	function convertFrom(settings: settings.Settings): SettingValues {
		const [limitValue, limitUnit] = getLimitUnit(settings.limitSize);
		const { enabled, limitEnabled } = settings;
		return { enabled, limitEnabled, limitUnit, limitValue };
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

		await settings.setValues(bag);
	}

	const def = convertFrom(settings.getDefault());
	const editor = new EditorModel(def);
	const { enabled, limitEnabled, limitUnit, limitValue } = editor.values;

	load();
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.base {
		display: flex;
		gap: 5px;
		flex-direction: column;
		width: 100%;
	}
</style>
<div class="base cr">
	<div class="group">
		<label class="check border control">
			<input class="control border check" type="checkbox" bind:checked={$enabled}/>
			Enabled
		</label>
	</div>
	<div id="grp-limit-enabled" class="group">
		<label class="check border control">
			<input class="control border check" type="checkbox" bind:checked={$limitEnabled}/>
			JSON Size Limit
		</label>
	</div>
	<div id="grp-limit-value" class="group">
		<span class="lbl border">Size limit</span>
		<input class="control border hv" type="number" step="any" inputmode="numeric" bind:value={$limitValue}/>
		<select class="control border hv" bind:value={$limitUnit}>
			{#each units as unit}
				<option value={unit}>{LimitUnit[unit]}</option>
			{/each}
		</select>
	</div>
	<button class="btn border control lt" on:click={save}>Save</button>
</div>