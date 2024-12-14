import LoadOverlay from "./LoadOverlay.svelte";

function run() {
	try {
		const target = document.body;
		const overlay = new LoadOverlay({ target });
	} catch (e) {
		console.error("JSON Viewer load overlay failed to load: ", e);
		const msg = e instanceof Error ? `${e.name}: ${e.message}` : e;
		alert("JSON Viewer: " + msg);
	}
}

//the return value will be used by chrome.scripting.executeScript
run();