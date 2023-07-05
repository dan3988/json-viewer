import type { WorkerMessage } from "../types.js";
import settings from "../settings.js";
import lib from "../lib.json";

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

async function loadExtension(isFirefox: boolean) {
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

	function injectPopup(target: chrome.scripting.InjectionTarget) {
		return inject(target, true, "lib/content.js");
	}

	function injectViewer(target: chrome.scripting.InjectionTarget) {
		if (isFirefox) {
			return inject(target, true, "lib/messaging.firefox.js", "res/ffstub.js", lib.json5, "lib/viewer.js");
		} else {
			return inject(target, false, "lib/messaging.chrome.js")
				.then(() => inject(target, true, "res/ffstub.js", lib.json5, "lib/viewer.js"));
		}
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

					const target = getTarget(tabId, sender.frameId);
					const fn = autoload ? injectViewer : injectPopup;
					fn(target).then(respond);
					return true;
				}
				break;
			case "loadme": {
				const target = getTarget(tabId, sender.frameId);
				injectViewer(target).then(respond);
				return true;
			}
		}
	});
}

function getTarget(tabId: number, frameId: number | undefined): chrome.scripting.InjectionTarget {
	const frameIds = frameId == null ? undefined : [frameId];
	return { tabId, frameIds };
}

async function inject(target: chrome.scripting.InjectionTarget, isolated: boolean, ...files: string[]) {
	const result = await chrome.scripting.executeScript({
		target,
		files,
		world: isolated ? "ISOLATED" : "MAIN"
	});

	return result[0].result;
}


const mf = chrome.runtime.getManifest();
const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

function checkIsFirefox(): Promise<boolean> {
	if (chrome.runtime.getBrowserInfo) {
		return chrome.runtime.getBrowserInfo().then(v => v.name === "Firefox");
	} else {
		return Promise.resolve(false);
	}
}

const isFirefox = checkIsFirefox();

isFirefox.then(loadExtension);

chrome.runtime.onInstalled.addListener((det) => {
	if (det.reason === chrome.runtime.OnInstalledReason.INSTALL) {
		isFirefox.then(v => {
			v && chrome.tabs.create({
				active: true,
				url: chrome.runtime.getURL("res/firefox.html")
			});
		})
	}
})