import type { WorkerMessage } from "../types.js";
import settings from "../settings.js";
import lib from "../lib.json";

console.log('launch');

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

	function injectPopup(tabId: number, frameId: undefined | number) {
		return inject(tabId, frameId, "lib/content.js");
	}

	function injectViewer(tabId: number, frameId: undefined | number) {
		return inject(tabId, frameId, "res/ffstub.js", lib.json5, "lib/viewer.js");
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
					fn(tabId, sender.frameId).then(respond);
					return true;
				}
				break;
			case "loadme":
				injectViewer(tabId, sender.frameId).then(respond);
				return true;
		}
	});
}

async function inject(tabId: number, frameId: number | undefined, ...files: string[]) {
	const target = { tabId, frameIds: frameId == undefined ? undefined : [frameId] };
	const result = await chrome.scripting.executeScript({
		target,
		files,
		world: "ISOLATED"
	});

	return result[0].result;
}


const mf = chrome.runtime.getManifest();
const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

loadExtension();

chrome.runtime.onInstalled.addListener((det) => {
	if (det.reason === chrome.runtime.OnInstalledReason.INSTALL) {
		if (chrome.runtime.getBrowserInfo) {
			chrome.runtime.getBrowserInfo().then(v => {
				if (v.name === "Firefox") {
					chrome.tabs.create({
						active: true,
						url: chrome.runtime.getURL("res/firefox.html")
					});
				}
			})
		}
	}
})