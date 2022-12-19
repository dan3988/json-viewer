import settings from "../settings.js";

console.log('launch');

const mf = chrome.runtime.getManifest();
const bag = settings.getDefault();
const filter: chrome.webRequest.RequestFilter = {
	urls: [ "<all_urls>" ],
	types: [ "main_frame", "sub_frame" ]
};

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

async function showSizeLimitOverride(tabId: number, frameIds: undefined | number[]): Promise<void> {
	const target = { tabId, frameIds }
	await chrome.scripting.insertCSS({
		target,
		files: [
			"res/size-limit.css"
		]
	});

	await chrome.scripting.executeScript({
		target,
		files: [
			"lib/size-limit.js"
		]
	});
}

async function inject(tabId: number, frameIds: undefined | number[], lenientParse: boolean) {
	const target = { tabId, frameIds }
	const files = [ "lib/viewer.js" ];

	if (lenientParse)
		files.unshift("lib/jsonic.js");

	await chrome.scripting.insertCSS({
		target,
		origin: "AUTHOR",
		files: [
			"lib/viewer.css",
		]
	});

	await chrome.scripting.executeScript({
		target,
		files,
		world: "ISOLATED"
	});
}

function onHeadersRecieved({ url, responseHeaders, tabId, frameId }: chrome.webRequest.WebResponseHeadersDetails): void {
	if (!bag.enabled)
		return;

	if (responseHeaders == null)
		return;

	let contentType: undefined | string = undefined;
	let contentLength: undefined | string = undefined;

	for (let { name, value } of responseHeaders) {
		if (value == null)
			return;

		name = name.toLowerCase();
		switch (name) {
			case "content-type":
				contentType = value;
				break;
			case "content-length":
				contentLength = value;
				break;
		}
	}

	if (typeof contentType === "undefined")
		return;

	const i = contentType.indexOf(";");
	if (i > 0)
		contentType = contentType.substring(0, i);

	const isJson = contentType === "application/json";
	if (!isJson && contentType !== "text/plain")
		return;

	if (bag.limitEnabled && contentLength !== undefined) {
		const len = parseInt(contentLength);
		if (len > bag.limitSize) {
			console.info("JSON is over size limit.", url);
			showSizeLimitOverride(tabId, [frameId]);
			return;
		}
	}

	inject(tabId, [frameId], !isJson);
}

chrome.webRequest.onHeadersReceived.addListener(onHeadersRecieved, filter, [ "responseHeaders" ]);
chrome.runtime.onMessage.addListener(async (message, sender, respond) => {
	if (sender.tab == null)
		return;

	if (message === "limit-override") {
		await inject(sender.tab.id!, sender.frameId == null ? undefined : [sender.frameId], true);
		respond();
	}
});
