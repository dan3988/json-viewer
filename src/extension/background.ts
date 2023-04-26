import type { WorkerMessage } from "../messaging.js";
import settings from "../settings.js";

console.log('launch');

const mf = chrome.runtime.getManifest();
const bag = settings.getDefault();

const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

function updateIcon(path: Record<string, string>, title: string) {
	const setIcon = chrome.action.setIcon({ path });
	const setTitle = chrome.action.setTitle({ title });
	return Promise.all([setIcon, setTitle]);
}

async function onEnabledChanged(enabled: boolean) {
	return enabled
		? updateIcon(mf.action.default_icon, mf.action.default_title)
		: updateIcon(gsIcons, mf.action.default_title + " (Disabled)");
}

async function loadSettings() {
	const v = await settings.get();
	Object.assign(bag, v);
	if (!v.enabled)
		await onEnabledChanged(false);

	settings.addListener(async det => {
		for (let [key, change] of Object.entries(det.changes))
			(bag as any)[key] = change.newValue;

		const enabled = det.changes.enabled;
		if (enabled !== undefined)
			await onEnabledChanged(enabled.newValue);
	});
}

async function inject(tabId: number, frameId: number | undefined, script: string, viewer: boolean) {
	const target = { tabId, frameIds: frameId == undefined ? undefined : [frameId] };
	const scripts = [ `lib/${script}.js` ];
	const styles = [ `lib/${script}.css` ];

	if (viewer) {
		scripts.unshift("node_modules/json5/dist/index.min.js");
		styles.unshift("node_modules/bootstrap/dist/css/bootstrap.min.css");
	}

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

loadSettings();

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

				inject(tabId, sender.frameId, autoload ? "viewer" : "content", autoload).then(() => respond(true));
				return true;
			}
			break;
		case "loadme":
			inject(tabId, sender.frameId, "viewer", true).then(respond);
			return true;
	}
});
