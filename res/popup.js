const ready = new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));

/** @type {HTMLInputElement} */
let chkEnabled;
/** @type {HTMLSelectElement} */
let drpScheme;
/** @type {[HTMLInputElement, HTMLInputElement, HTMLInputElement]} */
let radios;
/** @type {{ scheme: string, darkMode: null | boolean, enabled: boolean }} */
let { scheme = "default", darkMode = null, enabled = true } = await chrome.storage.local.get(["scheme", "darkMode", "enabled"]);

const rule = matchMedia("(prefers-color-scheme: dark)");
rule.addEventListener("change", setDarkModeAttr);
setDarkModeAttr();
setSchemeAttr();

chrome.storage.local.onChanged.addListener(changes => {
	if ("scheme" in changes) {
		drpScheme.value = scheme = changes.scheme.newValue;
		setSchemeAttr();
	}

	if ("darkMode" in changes) {
		darkMode = changes.darkMode.newValue;
		setDarkModeAttr();
		for (const radio of radios)
			radio.checked = darkMode == JSON.parse(radio.value);
	}

	if ("enabled" in changes) {
		chkEnabled.checked = enabled = changes.enabled.newValue;
	}
});

function setDarkModeAttr(source = rule) {
	document.documentElement.setAttribute("data-bs-theme", (darkMode ?? source.matches) ? "dark" : "light");
}

function setSchemeAttr() {
	document.documentElement.setAttribute("data-scheme", scheme);
}

function onDarkModeChanged() {
	darkMode = JSON.parse(this.value);
	for (const radio of radios)
		if (radio !== this)
			radio.checked = false;

	chrome.storage.local.set({ darkMode });
}

await ready;

chkEnabled = document.getElementById('chkEnabled');
chkEnabled.checked = enabled;
chkEnabled.addEventListener('input', function () {
	chrome.storage.local.set({ enabled: this.checked });
});

drpScheme = document.getElementById('drpScheme');
drpScheme.value = scheme;
drpScheme.addEventListener('input', function() {
	chrome.storage.local.set({ scheme: this.value });
})

radios = [
	document.getElementById('radThemeAuto'),
	document.getElementById('radThemeLight'),
	document.getElementById('radThemeDark'),
];

for (const radio of radios) {
	radio.checked = darkMode === JSON.parse(radio.value);
	radio.addEventListener('input', onDarkModeChanged);
}

export {};