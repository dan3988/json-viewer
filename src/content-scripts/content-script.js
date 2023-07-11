{
	const msg = {
		type: "checkme",
		contentType: document.contentType
	};

	chrome.runtime.sendMessage(msg);
}