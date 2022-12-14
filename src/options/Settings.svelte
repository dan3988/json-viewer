<script lang="ts">
	import settings from "../settings";
	import EditorModel, { type EntryRef } from "./editor";

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

	async function load(): Promise<SettingValues> {
		const v = await settings.get();
		return convertFrom(v);
	}

	// function isDirty(prop: keyof SettingValues) {
	// 	return original[prop] !== editing[prop];
	// }

	async function save() {
		const bag: settings.SaveType = {};

		if (limitUnit.changed || limitValue.changed)
			bag.limitSize = getByteSize(limitValue.value, limitUnit.value);

		addDirty(bag, limitEnabled);
		addDirty(bag, enabled);
		addDirty(bag, indentChar);
		addDirty(bag, indentCount);

		await settings.setValues(bag);

		model.commit();
	}

	function addDirty<K extends (keyof SettingValues) & (keyof settings.Settings)>(bag: settings.SaveType, prop: EntryRef<K, SettingValues[K]>) {
		if (prop.changed)
			bag[prop.key] = prop.value;
	}

	const loading = load().then(v => {
		model = new EditorModel(v);
		({ enabled, limitEnabled, limitUnit, limitValue, indentChar, indentCount } = model.props);
	});

	let { enabled, limitEnabled, limitUnit, limitValue, indentChar, indentCount } = Object.prototype as typeof model["props"];
	let model: EditorModel<SettingValues>;
</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

	.dirty {
		background-color: #553;
	}

	.base {
		display: grid;
		grid-template-columns: 7rem 1fr 7rem;
		grid-row-gap: 5px;
		width: 500px;
		margin: auto;

		> .group {
			display: contents;

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
		<div class="group grp-limit-enabled" class:dirty={$limitEnabled.changed}>
			<label class="check">
				<input class="control border" type="checkbox" bind:checked={$limitEnabled.value}/>
				JSON Size Limit
			</label>
		</div>
		<div class="group grp-limit-value">
			<span class="lbl border">Size limit</span>
			<input class="control" class:dirty={$limitValue.changed} type="number" step="any" inputmode="numeric" bind:value={$limitValue.value}/>
			<select class="control" class:dirty={$limitUnit.changed}  bind:value={$limitUnit.value}>
				{#each units as unit}
					<option value={unit}>{LimitUnit[unit]}</option>
				{/each}
			</select>
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