console.debug(document.contentType);
if (document.contentType === "application/json") {
	const pre = document.body.querySelector("pre")!;
	const json = JSON.parse(pre.innerText);
	pre.remove();
	load(json);
}

async function load(json: any) {
	const module = await import("./json-viewer.js");
	module.load(json);
}
