/**
* @param {Record<string, Watchable>} tags
*/
function sock(tags) {
	function onChanges(files) {
		for (const [key, checksum] of Object.entries(files)) {
			const ref = tags[key];
			if (ref != null && ref.tag.integrity !== checksum) {
				ref.tag.integrity = checksum;
				ref.reload();
			}
		}
	}

	function onInit(files) {
		for (const [key, checksum] of Object.entries(files)) {
			const ref = tags[key];
			if (ref)
				ref.tag.integrity = checksum;
		}
	}

	/**
	 * 
	 * @param {MessageEvent} msg 
	 */
	function onMessage(msg) {
		const data = JSON.parse(msg.data);
		switch (data.type) {
			case "update":
				onChanges(data.files);
				break;
			case "init":
				onInit(data.files);
				break;
		}
	}

	const url = new URL(meta);
	url.pathname = "/hotreload";
	url.protocol = "ws" + url.protocol.substring(4);
	const ws = new WebSocket(url);
	ws.addEventListener("error", console.error);
	ws.addEventListener("message", onMessage);
}

class Watchable {
	url;
	tag;

	/**
	 * @param {URL} url 
	 * @param {HTMLLinkElement | HTMLScriptElement} tag
	 */
	constructor(url, tag) {
		this.url = url;
		this.tag = tag;
	}

	/**
	 * @param {URL} url 
	 */
	reload() {
	}
}

class WatchableStyle extends Watchable {
	#count;

	/**
	 * @param {URL} url 
	 * @param {HTMLLinkElement} tag
	 */
	constructor(url, tag) {
		super(url, tag);
		this.#count = 0;
	}

	reload() {
		console.debug('hotreload: reloading stylesheet: ', this.url);
		const count = ++this.#count;
		this.url.searchParams.set("hotreload", count);
		this.tag.href = this.url;
	}
}

class WatchableScript extends Watchable {
	/**
	 * @param {URL} url 
	 * @param {HTMLScriptElement} tag
	 */
	constructor(url, tag) {
		super(url, tag);
	}

	reload() {
		console.debug('hotreload: script updated, reloading', this.url);
		window.location.reload();
	}
}

const meta = new URL(import.meta.url);
const prefix = meta.searchParams.get('prefix') + ":";
const local = new URL(window.location);
let any = false;
/** @type {Record<string, Watchable>} */
let values = {};

for (const tag of document.getElementsByTagName("link")) {
	if (tag.rel !== "stylesheet")
		continue;

	const url = new URL(tag.href, local);
	if (url.protocol !== prefix)
		continue;

	any = true;
	values[url.pathname] = new WatchableStyle(url, tag)
}

if (any)
	sock(values);

export {};