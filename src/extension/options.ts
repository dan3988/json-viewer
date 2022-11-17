import settings from "./settings.js";

const ePluginEnabled = document.getElementById("plugin-enabled") as HTMLInputElement;
const eLimitEnabled = document.getElementById("limit-enabled") as HTMLInputElement;
const eLimitValue = document.getElementById("limit-value") as HTMLInputElement;
const eLimitUnit = document.getElementById("limit-unit") as HTMLSelectElement;
const eSave = document.getElementById("save") as HTMLButtonElement;
const grpLimitValue = document.getElementById("grp-limit-value")!;

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

async function load() {
	const bag = await settings.get();
	const modified: settings.SaveType = {};
	let [limit, unit] = getLimitUnit(bag.limitSize);

	function setValue<K extends keyof settings.Settings>(e: HTMLElement, key: K, value: settings.Settings[K]) {
		const setting = settings.getSetting(key, true);
		const trueValue = setting.type(value);
		const group = e.closest(".group");
		if (trueValue === bag[key]) {
			delete modified[key];
			group?.classList.remove("dirty");
		} else {
			modified[key] = trueValue;
			group?.classList.add("dirty");
		}
	}

	ePluginEnabled.checked = bag.enabled;
	ePluginEnabled.addEventListener("input", function() {
		setValue(this, "enabled", this.checked);
	});

	eLimitEnabled.checked = bag.limitEnabled;
	eLimitEnabled.addEventListener("input", function() {
		setValue(this, "limitEnabled", this.checked);
		grpLimitValue.hidden = !this.checked;
	});

	eLimitUnit.value = String(unit);
	eLimitUnit.addEventListener("input", function() {
		unit = parseInt(this.value);
		setValue(this, "limitSize", getByteSize(limit, unit));
	});

	eLimitValue.valueAsNumber = limit;
	eLimitValue.addEventListener("input", function() {
		limit = parseFloat(this.value);
		setValue(this, "limitSize", getByteSize(limit, unit));
	});

	eSave.addEventListener("click", async () => {
		await settings.setValues(modified);

		for (let key in modified)
			Reflect.deleteProperty(modified, key);

		document.querySelectorAll(".dirty").forEach(v => v.classList.remove("dirty"));
	});

	grpLimitValue.hidden = !bag.limitEnabled;
}

load();