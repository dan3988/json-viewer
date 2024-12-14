import schemes$1 from '/lib/schemes.js';

/** @type {typeof import("../src/schemes").default} */
const schemes = schemes$1.default;
const ready = new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));

/** @type {HTMLInputElement} */
let chkEnabled;
/** @type {HTMLSelectElement} */
let drpScheme;
/** @type {[HTMLInputElement, HTMLInputElement, HTMLInputElement]} */
let radios;
/** @type {{ scheme: string, darkMode: null | boolean, enabled: boolean }} */
let { scheme = "default", darkMode = null, enabled = true } = await chrome.storage.local.get(["scheme", "darkMode", "enabled"]);

const style = document.createElement('style');
document.head.appendChild(style);

const rule = matchMedia("(prefers-color-scheme: dark)");
rule.addEventListener("change", setDarkModeAttr);
setDarkModeAttr();
setSchemeCss();

chrome.storage.local.onChanged.addListener(changes => {
	if ("scheme" in changes) {
		drpScheme.value = scheme = changes.scheme.newValue;
		setSchemeCss();
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

function setSchemeCss() {
	style.textContent = schemes.compileCss(schemes.presets[scheme]);
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

for (const [name, list] of schemes.groupedPresets) {
	if (!list.length)
		continue;

	const group = document.createElement('optgroup');
	group.label = name;
	for (const [id, name] of list) {
		const element = document.createElement('option');
		element.value = id;
		element.textContent = name;
		group.appendChild(element);
	}

	drpScheme.options.add(group);
}

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