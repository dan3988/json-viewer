import settings from "./settings.js";

console.log('launch');

const bag = settings.getDefault();
const filter: chrome.webRequest.RequestFilter = {
	urls: [ "<all_urls>" ],
	types: [ "main_frame", "sub_frame" ]
}

const manifest = chrome.runtime.getManifest();

settings.get().then(v => Object.assign(bag, v));
settings.addListener(det => {
	for (let [key, change] of Object.entries(det.changes))
		(bag as any)[key] = change.newValue;
});

async function showSizeLimitOverride(tabId: number): Promise<void> {
	await chrome.scripting.insertCSS({
		target: { tabId },
		files: [
			"res/size-limit.css"
		]
	});

	await chrome.scripting.executeScript({
		target: { tabId },
		files: [
			"lib/esm/size-limit.js"
		]
	});
}

async function inject(tabId: number, lenientParse: boolean) {
	const target = { tabId }
	const files: string[] = [];

	if (manifest.debug) {
		if (lenientParse)
			//use slower but less strict json parser
			files.push("node_modules/jsonic/jsonic.js");

		files.push(
			"lib/amd/amd.js",
			"node_modules/esprima/dist/esprima.js",
			"node_modules/jsonpath-plus/dist/index-browser-umd.cjs",
			"lib/amd/html.js",
			"lib/amd/vm.js",
			"lib/amd/json.js",
			"lib/amd/json-path.js",
			"lib/amd/json-viewer.js",
			"lib/amd/content.js", 
			"lib/amd/content.amd.js");

	} else {
		files.push("lib/amd/content.js");
	}

	await chrome.scripting.insertCSS({
		target,
		files: [
			"res/core.css",
			"res/json.css"
		],
		origin: "AUTHOR"
	});

	await chrome.scripting.executeScript({ target, files, world: "ISOLATED" });
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
		switch (name = name.toLowerCase()) {
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
			showSizeLimitOverride(tabId);
			return;
		}
	}

	inject(tabId, !isJson);
}

chrome.webRequest.onHeadersReceived.addListener(onHeadersRecieved, filter, [ "responseHeaders" ]);
chrome.runtime.onMessage.addListener(async (message, sender, respond) => {
	if (sender.tab == null)
		return;

	if (message === "limit-override") {
		await inject(sender.tab.id!, true);
		respond();
	}
});
