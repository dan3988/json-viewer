console.log('launch');

const filter: chrome.webRequest.RequestFilter = {
	urls: [ "<all_urls>" ],
	types: [ "main_frame", "sub_frame" ]
}

function getDocument() {
	return window.document;
}

function onHeadersRecieved(det: chrome.webRequest.WebResponseHeadersDetails): void {
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
			"lib/amd.js",
			"node_modules/jsonpath-plus/dist/index-browser-umd.cjs",
			"lib/html.js",
			"lib/json.js",
			"lib/json-path.js",
			"lib/json-viewer.js",
			"lib/content.js" 
		],
		world: "ISOLATED"
	})
}

chrome.webRequest.onHeadersReceived.addListener(onHeadersRecieved, filter, [ "responseHeaders" ]);