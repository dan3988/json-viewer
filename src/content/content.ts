import LoadOverlay from "./LoadOverlay.svelte";

function run() {
	try {
		const target = document.body;
		const overlay = new LoadOverlay({ target });
		//result for chrome.scripting.executeScript
		undefined;
	} catch (e) {
		e instanceof Error ? `${e.name}: ${e.message}` : String(e);
	}
}

//the return value will be used by chrome.scripting.executeScript
run();