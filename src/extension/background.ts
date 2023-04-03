import settings from "../settings.js";

console.log('launch');

const mf = chrome.runtime.getManifest();
const bag = settings.getDefault();

const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

async function onEnabledChanged(enabled: boolean) {
	if (enabled) {
		await chrome.action.setIcon({ path: mf.action.default_icon });
		await chrome.action.setTitle({ title: mf.action.default_title });
	} else {
		await chrome.action.setIcon({ path: gsIcons });
		await chrome.action.setTitle({ title: mf.action.default_title + " (Disabled)" });
	}
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

loadSettings();

async function inject(tabId: number, frameId: number | undefined, script: string, addJsonic: boolean) {
	const target = { tabId, frameIds: frameId == undefined ? undefined : [frameId] };
	const files = [ `lib/${script}.js` ];

	if (addJsonic)
		files.unshift("node_modules/jsonic/jsonic-min.js");

	await chrome.scripting.insertCSS({
		target,
		origin: "AUTHOR",
		files: [
			`lib/${script}.css`,
		]
	});
	
	await chrome.scripting.executeScript({
		target,
		files,
		world: "ISOLATED"
	});
}

interface MessageBase {
	type: "checkme" | "loadme";
}

interface LoadMessage extends MessageBase {
	type: "loadme";
}

interface CheckMessage extends MessageBase {
	type: "checkme"
	contentType: string;
}

type Message = LoadMessage | CheckMessage;

//chrome.webRequest.onHeadersReceived.addListener(onHeadersRecieved, filter, [ "responseHeaders" ]);
chrome.runtime.onMessage.addListener(async (message: Message, sender, respond) => {
	const tabId = sender.tab?.id;
	if (tabId == null)
		return;

	switch (message.type) {
		case "checkme":
			if (bag.mimes.includes(message.contentType)) {
				const url = sender.url && new URL(sender.url);
				const autoLoad = Boolean(url && bag.whitelist.includes(url.host));
				await inject(tabId, sender.frameId, autoLoad ? "viewer" : "content", autoLoad);
			}

			respond();
			break;
		case "loadme":
			await inject(tabId, sender.frameId, "viewer", true);
			respond();
			break;
	}
});
