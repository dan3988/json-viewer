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

function onHeadersRecieved(det: chrome.webRequest.WebResponseHeadersDetails): void {
	if (!bag.enabled)
		return;

	if (det.responseHeaders == null)
		return;

	let contentType: undefined | string = undefined;
	let contentLength: undefined | string = undefined;

	for (let { name, value } of det.responseHeaders) {
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
			console.info("JSON is over size limit.", det.url);
			return;
		}
	}

	const target = { tabId: det.tabId, frameIds: [det.frameId] }
	const files: string[] = [];

	if (manifest.debug) {
		if (!isJson)
			//use less restrictive json parser if content-type is plain text
			files.unshift("node_modules/jsonic/jsonic.js");

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

	chrome.scripting.insertCSS({
		target,
		files: [
			"res/core.css",
			"res/json.css"
		],
		origin: "AUTHOR"
	});

	chrome.scripting.executeScript({ target, files, world: "ISOLATED" });
}

chrome.webRequest.onHeadersReceived.addListener(onHeadersRecieved, filter, [ "responseHeaders" ]);

