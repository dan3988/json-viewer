import settings from "./settings.js";

console.log('launch');

const filter: chrome.webRequest.RequestFilter = {
	urls: [ "<all_urls>" ],
	types: [ "main_frame", "sub_frame" ]
}

const bag = settings.getDefault();

settings.get().then(v => Object.assign(bag, v));

function onHeadersRecieved(det: chrome.webRequest.WebResponseHeadersDetails): void {
	if (!bag.enabled)
		return;

	const headers = det.responseHeaders;
	if (headers == null)
		return;

	let ct = headers.find(v => v.name.toLowerCase() === "content-type")?.value;
	if (ct == null)
		return;

	const i = ct.indexOf(";");
	if (i > 0)
		ct = ct.substring(0, i);

	if (ct !== "application/json" && ct !== "text/plain")
		return;

	chrome.scripting.executeScript({
		target: { tabId: det.tabId, frameIds: [det.frameId] },
		files: [
			"lib/amd/amd.js",
			"node_modules/jsonpath-plus/dist/index-browser-umd.cjs",
			"lib/amd/html.js",
			"lib/amd/json.js",
			"lib/amd/json-path.js",
			"lib/amd/json-viewer.js",
			"lib/amd/content.js" 
		],
		world: "ISOLATED"
	})
}

chrome.webRequest.onHeadersReceived.addListener(onHeadersRecieved, filter, [ "responseHeaders" ]);