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

const [dw, dh, url, delayVal, update, single, start, frame] = get("dw", "dh", "url", "delay", "btn-go", "btn-single", "btn-start", "view");

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
		let fileName = scheme;
		if (darkMode != null)
			fileName += darkMode ? "-dk" : "-lt";

		fileName += ".png";

		await chrome.storage.local.set({ darkMode, scheme });
		await delay(600);

		const blob = await capture();
		await saveBlob(blob, fileName);
	}

	for (const [name, { mode }] of Object.entries(schemes)) {
		if (mode === "auto") {
			await captureScheme(true, name);
			await captureScheme(false, name);
		} else {
			await captureScheme(null, name);
		}
	}
}

var schemes = {
	"default": {
		"name": "Visual Studio",
		"indents": 3,
		"mode": "auto"
	},
	"dracula": {
		"name": "Dracula",
		"indents": 6,
		"mode": "auto"
	},
	"abyss": {
		"name": "Abyss",
		"indents": 3,
		"mode": "dark"
	},
	"mat": {
		"name": "Material",
		"indents": 6,
		"mode": "auto"
	},
	"monokai": {
		"name": "Monokai",
		"indents": 3,
		"mode": "auto"
	},
	"github": {
		"name": "GitHub",
		"indents": 3,
		"mode": "auto"
	},
	"cyberpunk": {
		"name": "Cyberpunk",
		"indents": 3,
		"mode": "dark"
	},
	"terminal": {
		"name": "Matrix",
		"indents": 3,
		"mode": "dark"
	},
	"solarized": {
		"name": "Solarized",
		"indents": 3,
		"mode": "auto"
	}
}