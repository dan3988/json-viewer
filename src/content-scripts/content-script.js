{
	const msg = {
		type: "checkme",
		contentType: document.contentType
	};

	chrome.runtime.sendMessage(msg).then(r => r && alert(r));
}