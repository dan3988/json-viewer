import type { IndentStyles, WorkerMessage } from "../types.js";
import settings from "../settings.js";

console.log('launch');

function fetchResource(mode: "text", path: string): Promise<string>
function fetchResource<T = any>(mode: "json", path: string): Promise<T>
function fetchResource(mode: "json" | "text", path: string): Promise<any> {
	const url = chrome.runtime.getURL(path);
	return fetch(url).then(v => v[mode]());
}

function updateIcon(path: Record<string, string>, title: string) {
	const setIcon = chrome.action.setIcon({ path });
	const setTitle = chrome.action.setTitle({ title });
	return Promise.all([setIcon, setTitle]);
}

function onEnabledChanged(enabled: boolean) {
	return enabled
		? updateIcon(mf.action.default_icon, mf.action.default_title)
		: updateIcon(gsIcons, mf.action.default_title + " (Disabled)");
}

async function loadExtension() {
	const bag = await settings.get();
	if (!bag.enabled)
		await onEnabledChanged(false);

	settings.addListener(async det => {
		for (let [key, change] of Object.entries(det.changes))
			(bag as any)[key] = change.newValue;

		const enabled = det.changes.enabled;
		if (enabled !== undefined)
			await onEnabledChanged(enabled.newValue);
	});

	const gsIcons: Record<number, string> = { ...mf.action.default_icon };
	for (const key in gsIcons)
		gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

	const themes = await fetchResource<IndentStyles>("json", "res/themes.json");

	function injectPopup(tabId: number, frameId: undefined | number) {
		return inject(tabId, frameId, ["lib/content.js"], ["lib/content.css"]);
	}

	function injectViewer(tabId: number, frameId: undefined | number) {
		const indentStyle = themes[bag.indentStyle];
		return inject(tabId, frameId, [lib.json5, "lib/viewer.js"], [lib.bootstrap, indentStyle.css, "lib/viewer.css"]);
	}

	chrome.runtime.onMessage.addListener((message: WorkerMessage, sender, respond) => {
		const tabId = sender.tab?.id;
		if (tabId == null)
			return;

		switch (message.type) {
			case "remember": {
				if (sender.url) {
					const url = new URL(sender.url);
					const key = message.autoload ? "whitelist" : "blacklist"
					const list = bag[key];
					list.push(url.host);
					settings.setValue(key, list).then(() => respond(true));
					return true;
				}

				respond(false);
				break;
			}
			case "checkme":
				if (bag.enabled && bag.mimes.includes(message.contentType)) {
					const url = sender.url && new URL(sender.url);
					let autoload = false;
					if (url) {
						if (bag.blacklist.includes(url.host)) {
							respond(false);
							return;
						}

						autoload = bag.whitelist.includes(url.host);
					}

					const fn = autoload ? injectViewer : injectPopup;
					fn(tabId, sender.frameId).then(() => respond(true));
					return true;
				}
				break;
			case "loadme":
				injectViewer(tabId, sender.frameId).then(respond);
				return true;
		}
	});
}

const lib = {
	json5: "node_modules/json5/dist/index.min.js",
	bootstrap: "node_modules/bootstrap/dist/css/bootstrap.min.css"
};

async function inject(tabId: number, frameId: number | undefined, scripts: string[], styles: string[]) {
	const target = { tabId, frameIds: frameId == undefined ? undefined : [frameId] };
	await chrome.scripting.insertCSS({
		target,
		files: styles,
		origin: "AUTHOR"
	});

	const result = await chrome.scripting.executeScript({
		target,
		files: scripts,
		world: "ISOLATED"
	});

	return result[0].result;
}


const mf = chrome.runtime.getManifest();
const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

loadExtension();