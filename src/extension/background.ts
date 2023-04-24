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

async function inject(tabId: number, frameId: number | undefined, script: string, addJsonic: boolean) {
	const target = { tabId, frameIds: frameId == undefined ? undefined : [frameId] };
	const files = [ `lib/${script}.js` ];

	if (addJsonic)
		files.unshift("node_modules/json5/dist/index.min.js");

	await chrome.scripting.insertCSS({
		target,
		origin: "AUTHOR",
		files: [
			`lib/${script}.css`,
		]
	});
	
	const result = await chrome.scripting.executeScript({
		target,
		files,
		world: "ISOLATED"
	});

	return result[0].result;
}

interface MessageBase {
	type: "checkme" | "loadme" | "error";
}

interface LoadMessage extends MessageBase {
	type: "loadme";
}

interface CheckMessage extends MessageBase {
	type: "checkme"
	contentType: string;
}

type Message = LoadMessage | CheckMessage;

loadSettings();

chrome.runtime.onMessage.addListener((message: Message, sender, respond) => {
	const tabId = sender.tab?.id;
	if (tabId == null)
		return;

	switch (message.type) {
		case "checkme":
			if (bag.enabled && bag.mimes.includes(message.contentType)) {
				const url = sender.url && new URL(sender.url);
				const autoLoad = Boolean(url && bag.whitelist.includes(url.host));
				inject(tabId, sender.frameId, autoLoad ? "viewer" : "content", autoLoad).then(respond);
				return true;
			}
			break;
		case "loadme":
			inject(tabId, sender.frameId, "viewer", true).then(respond);
			return true;
	}
});
