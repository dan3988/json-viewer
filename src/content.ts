console.debug(document.contentType);
if (document.contentType === "application/json") {
	const pre = document.body.querySelector("pre")!;
	const text = pre.innerText;
	pre.remove();
	const json = JSON.parse(text);
	load(json);
}

async function load(json: any) {
	const module = await import("./json-viewer.js");
	module.load(json);
}
