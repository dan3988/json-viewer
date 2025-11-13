function get(...names) {
	return names.map(v => document.getElementById(v));
}

function delay(ms) {
	return new Promise(r => setTimeout(r, ms));
}

function dataUrlToBlob(url, x, y, w, h) {
	return new Promise((resolve, reject) => {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		const image = new Image();
		image.src = url;
		image.onerror = reject;
		image.onload = () => {
			canvas.width = w;
			canvas.height = h;
			context.drawImage(image, x, y);
			canvas.toBlob(resolve, "image/png");
		}
	});
}

const [res, dw, dh, url, delayVal, update, single, start, frame] = get("resolution", "dw", "dh", "url", "delay", "btn-go", "btn-single", "btn-start", "view");

function updateRes() {
	[dw.value, dh.value] = res.value.split("x");
}

res.addEventListener("input", updateRes);
updateRes();

update.addEventListener("click", () => {
	const w = dw.valueAsNumber;
	const h = dh.valueAsNumber;

	if (frame.src !== url.value)
		frame.src = url.value;

	frame.width = w;
	frame.height = h;
});

single.addEventListener("click", () => {
	capture().then(v => window.open(URL.createObjectURL(v)));
})

start.addEventListener("click", () => {
	showDirectoryPicker({ id: "screenshot", mode: "readwrite" }).then(takeScreenshots);
});

async function capture() {
	await delay(delayVal.valueAsNumber * 1000)
	const { x, y, width, height } = frame.getBoundingClientRect();
	const url = await chrome.tabs.captureVisibleTab();
	return await dataUrlToBlob(url, -x, -y, width, height);
}

/**
 * 
 * @param {FileSystemDirectoryHandle} dir
 */
async function takeScreenshots(dir) {
	async function saveBlob(blob, name) {
		const file = await dir.getFileHandle(name, { create: true });
		const stream = await file.createWritable();
		await stream.write(blob);
		await stream.close();
	}

	async function captureScheme(darkMode, scheme) {
		let filename = scheme;
		filename = filename.replace('_light', '-lt');
		filename = filename.replace('_dark', '-dk');
		filename += '.png';

		const prefs = { darkMode };

		prefs[darkMode ? 'schemeDark' : 'schemeLight'] = scheme;

		await chrome.storage.local.set(prefs);
		await delay(600);

		const blob = await capture();
		await saveBlob(blob, filename);
	}

	for (const scheme of lightSchemes)
		await captureScheme(false, scheme);

	for (const scheme of darkSchemes)
		await captureScheme(true, scheme);
}

var lightSchemes = [
	'default_light',
	'dracula_light',
	'mat_light',
	'monokai_light',
	'github_light',
	'solarized_light',
];

var darkSchemes = [
	'abyss',
	'default_dark',
	'dracula_dark',
	'mat_dark',
	'monokai_dark',
	'github_dark',
	'cyberpunk',
	'terminal',
	'solarized_dark',
];
