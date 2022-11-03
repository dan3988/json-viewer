import settings from "./settings.js";

const eEnabled = document.getElementById("enabled") as HTMLInputElement;
//const eLimitEnabled = document.getElementById("limit-enabled") as HTMLInputElement;
const eLimitValue = document.getElementById("limit") as HTMLInputElement;
const eLimitUnit = document.getElementById("limit-unit") as HTMLSelectElement;
const eSave = document.getElementById("save") as HTMLButtonElement;

const bag = await settings.get();

eEnabled.checked = bag.enabled;

eLimitUnit.value = String(bag.limitType);
eLimitUnit.addEventListener("input", function() {
	eLimitValue.disabled = this.value === "0";
});

eLimitValue.disabled = bag.limitType === settings.LimitUnit.Disabled;
eLimitValue.valueAsNumber = bag.limit ?? 0;

eSave.addEventListener("click", () => {
	settings.setValues({
		enabled: eEnabled.checked,
		limit: eLimitValue.valueAsNumber,
		limitType: parseInt(eLimitUnit.value)
	})
});

export {};