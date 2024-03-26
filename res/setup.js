const mf = chrome.runtime.getManifest();
const isFirefox = !!mf.browser_specific_settings?.gecko;
const browserName = isFirefox ? "firefox" : "chrome";

function copyText() {
	navigator.clipboard.writeText(this.textContent);
}

/**
 * @param {string} selector 
 * @param {(e: HTMLElement) => void} fn 
 */
function forEach(selector, fn) {
	for (const element of document.querySelectorAll(selector)) {
		fn(element);
	}
}

forEach(".copy-btn", e => e.addEventListener("click", copyText));
forEach(".browser-name", e => e.textContent = browserName);
forEach(`[data-browser]:not([data-browser*="${browserName}"])`, e => e.hidden = true);

const permissionsDiv = document.getElementById("div-permissions");
const permissionsBtn = document.getElementById("btn-permissions");
const perm = { origins: ["<all_urls>"], permissions: null };

chrome.permissions.contains(perm, result => {
	if (result)
		return;

	permissionsDiv.classList.add("permission-denied");
	permissionsBtn.addEventListener("click", async () => {
		chrome.permissions.request(perm, result => {
			if (result)
				permissionsDiv.classList.remove("permission-denied");
		});
	});
});
