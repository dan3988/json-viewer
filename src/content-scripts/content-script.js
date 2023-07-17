(() => {
	const pre = document.querySelector("body > pre:first-child:last-child")
	if (!pre) 
		return;

	if (document.contentType !== "application/json") {
		const text = pre.textContent.trim();
		const isJsonContainer = text.startsWith("{") ? text.endsWith("}") : (text.startsWith("[") && text.endsWith("]"));
		if (!isJsonContainer)
			return;
	}

	chrome.runtime.sendMessage({
		type: "checkme",
		contentType: document.contentType
	});
})();