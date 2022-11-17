const ignore = document.createElement("button");
ignore.type = "button";
ignore.textContent = "Load Anyway";
ignore.addEventListener("click", () => {
	panel.remove();
	chrome.runtime.sendMessage("limit-override");
});

const dismiss = document.createElement("button");
dismiss.type = "button";
dismiss.textContent = "Dismiss";
dismiss.addEventListener("click", () => {
	panel.remove();
});


const panel = document.createElement("div");
panel.id = "json-viewer-msg";
panel.innerText = "The JSON is over the configured size limit";
panel.append(ignore, dismiss);

document.body.appendChild(panel);
