<script lang="ts">
	import settings from "../settings";
	import EditorModel from "./editor";

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

	function save() {
	}

	const def = convertFrom(settings.getDefault());
	const editor = new EditorModel(def);
	const { enabled, limitEnabled, limitUnit, limitValue } = editor.values;
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
		<input class="control border hv" type="number" inputmode="numeric" bind:value={$limitValue}/>
		<select class="control border hv" bind:value={$limitUnit}>
			<option value="0">B</option>
			<option value="1">KB</option>
			<option value="2">MB</option>
			<option value="3">GB</option>
		</select>
	</div>
	<button class="btn border control lt" on:click={save}>Save</button>
</div>