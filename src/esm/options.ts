import settings from "./settings.js";

const eEnabled = document.getElementById("enabled") as HTMLInputElement;
const eLimitValue = document.getElementById("limit") as HTMLInputElement;
const eLimitUnit = document.getElementById("limit-unit") as HTMLSelectElement;
const eSave = document.getElementById("save") as HTMLButtonElement;

async function load() {
	const bag = await settings.get();
	const modified: settings.SaveType = {};

	function setValue<K extends keyof settings.Settings>(e: HTMLElement, key: K, value: settings.Settings[K]) {
		const setting = settings.getSetting(key, true);
		const trueValue = setting.type(value);
		if (trueValue === bag[key]) {
			delete modified[key];
			e.classList.remove("dirty");
		} else {
			modified[key] = trueValue;
			e.classList.add("dirty");
		}
	}

	eEnabled.checked = bag.enabled;
	eEnabled.addEventListener("input", function() {
		setValue(this.parentElement!, "enabled", this.checked);
	});

	eLimitUnit.value = String(bag.limitType);
	eLimitUnit.addEventListener("input", function() {
		const value = parseInt(this.value);
		setValue(this, "limitType", value);
		eLimitValue.disabled = value === settings.LimitUnit.Disabled;
	});

	eLimitValue.disabled = bag.limitType === settings.LimitUnit.Disabled;
	eLimitValue.valueAsNumber = bag.limit ?? 0;
	eLimitValue.addEventListener("input", function() {
		const value = parseInt(this.value);
		setValue(this, "limit", value);
	});

	eSave.addEventListener("click", async () => {
		await settings.setValues(modified);

		for (let key in modified)
			Reflect.deleteProperty(modified, key);

		document.querySelectorAll(".dirty").forEach(v => v.classList.remove("dirty"));
	});
}

load();