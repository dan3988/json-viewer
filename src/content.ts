if (document.contentType === "application/json") {
	loadJson();
}

async function loadJson() {
	const { settings } = await import("./settings.js");
	const { enabled, limit, limitType } = await settings.get("enabled", "limit", "limitType");
	if (!enabled)
		return;

	const pre = document.body.querySelector("pre")!;
	const text = pre.innerText;
	const limitBytes = settings.getByteSize(limit, limitType);
	if (text.length > limitBytes)
		return;

	pre.remove();
	const json = JSON.parse(text);
	const module = await import("./json-viewer.js");
	module.load(json);
}
