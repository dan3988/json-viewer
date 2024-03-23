function copyText() {
	navigator.clipboard.writeText(this.textContent);
}

async function requestPermissions() {
	const result = await chrome.permissions.request({
		origins: ["<all_urls>"]
	});

	console.log(result);
}

for (const element of document.getElementsByClassName("copy-text")) {
	element.addEventListener("click", copyText);
}

const permissionsDiv = document.getElementById("div-permissions")
const permissionsBtn = document.getElementById("btn-permissions")
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