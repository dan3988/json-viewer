import type { DocumentHeader, DocumentRequestInfo, WorkerMessage } from "../types.js";
import type { ImmutableArray } from "../immutable-array.js";
import preferences from "../preferences-lite.js";
import lib from "../lib.json";
import WebRequestInterceptor from "./web-request.js";

var currentRequestListener: null | RequestListener = null;

function updateIcon(path: Record<string, string>, title: string) {
	const setIcon = chrome.action.setIcon({ path });
	const setTitle = chrome.action.setTitle({ title });
	return Promise.all([setIcon, setTitle]);
}

function onEnabledChanged(enabled: boolean) {
	return enabled
		? void updateIcon(mf.action.default_icon, mf.action.default_title)
		: void updateIcon(gsIcons, mf.action.default_title + " (Disabled)");
}

function reset<T>(set: Set<T>, source: ImmutableArray<T>) {
	set.clear();
	source.forEach(set.add, set);
}

async function loadExtension() {
	const prefs = await preferences.lite.manager.watch();
	const whitelist = new Set<string>();
	const blacklist = new Set<string>();
	const mimes = new Set<string>();

	prefs.props.enabled.subscribe(onEnabledChanged);
	prefs.props.useWebRequest.subscribe(setRequestListening);
	prefs.props.whitelist.subscribe(v => reset(whitelist, v));
	prefs.props.blacklist.subscribe(v => reset(blacklist, v));
	prefs.props.mimes.subscribe(v => reset(mimes, v));

	const gsIcons: Record<number, string> = { ...mf.action.default_icon };
	for (const key in gsIcons)
		gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

	function setRequestListening(enabled: boolean) {
		if (enabled) {
			try {
				currentRequestListener = new RequestListener(blacklist);
			} catch (e) {
				console.error("Failed to start listening to webRequest events", e);
			}
		} else {
			try {
				currentRequestListener?.dispose();
			} catch (e) {
				console.error("Failed to dispose webRequest listener", e);
			} finally {
				currentRequestListener = null;
			}
		}
	}

	function injectPopup(tabId: number, frameId?: number) {
		const target = getTarget(tabId, frameId);
		return inject(target, true, "lib/content.js");
	}

	async function injectViewer(tabId: number, frameId?: number) {
		const target = getTarget(tabId, frameId);
		if (isFirefox) {
			return await inject(target, true, "lib/messaging.firefox.js", "res/ffstub.js", lib.json5, "lib/viewer.js");
		} else {
			await inject(target, false, "lib/messaging.chrome.js");
			return await inject(target, true, "res/ffstub.js", lib.json5, "lib/viewer.js");
		}
	}

	chrome.runtime.onMessage.addListener((message: WorkerMessage, sender, respond) => {
		const tabId = sender.tab?.id;
		if (tabId == null)
			return;

		switch (message.type) {
			case "remember": {
				if (sender.url) {
					const url = new URL(sender.url);
					const [key, set] = message.autoload ? ["whitelist", whitelist] as const : ["blacklist", blacklist] as const;
					if (!set.has(url.host)) {
						const list = prefs.getValue(key).add(url.host);
						preferences.lite.manager.set(key, list);
						return true;
					}
				}

				respond(false);
				break;
			}
			case "checkme":
				if (prefs.getValue("enabled") && mimes.has(message.contentType)) {
					const url = sender.url && new URL(sender.url);
					let autoload = false;
					if (url) {
						if (blacklist.has(url.host)) {
							respond(false);
							return;
						}

						autoload = whitelist.has(url.host);
					}

					const fn = autoload ? injectViewer : injectPopup;
					fn(tabId, sender.frameId).then(respond);
					return true;
				}
				break;
			case "loadme": {
				injectViewer(tabId, sender.frameId).then(respond);
				return true;
			}
			case "requestInfo": {
				const info = currentRequestListener?.get(tabId);
				respond(info);
			}
		}
	});
}

function getTarget(tabId: number, frameId: number | undefined): chrome.scripting.InjectionTarget {
	const frameIds = frameId == null ? undefined : [frameId];
	return { tabId, frameIds };
}

async function inject(target: chrome.scripting.InjectionTarget, isolated: boolean, ...files: string[]) {
	const result = await chrome.scripting.executeScript({
		target,
		files,
		world: isolated ? "ISOLATED" : "MAIN"
	});

	return result[0].result;
}

const mf = chrome.runtime.getManifest();
const isFirefox = !!mf.browser_specific_settings?.gecko;
const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

loadExtension();

chrome.runtime.onInstalled.addListener(det => {
	if (det.reason === chrome.runtime.OnInstalledReason.INSTALL) {
		chrome.tabs.create({
			active: true,
			url: chrome.runtime.getURL("res/setup.html")
		});
	}
});

class RequestListener {
	static #addHeaders(array: DocumentHeader[], input: undefined | chrome.webRequest.HttpHeader[]): DocumentHeader[] {
		if (input)
			for (const { name, value } of input)
				array.push([name, value ?? ""]);
	
		return array;
	}
	
	readonly #requestInfoMap = new Map<number, Map<number, DocumentRequestInfo>>();
	readonly #currentRequestsMap = new Map<string, DocumentRequestInfo>();
	readonly #interceptor: WebRequestInterceptor;

	constructor(blacklist: Set<string>) {
		this._onTabRemoved = this._onTabRemoved.bind(this);
		this.#interceptor = WebRequestInterceptor.builder()
			.addFilterTypes("main_frame", "sub_frame")
			.onBeforeRequest(det => {
				if (det.type === "main_frame")
					this.#requestInfoMap.delete(det.tabId);
	
				const url = new URL(det.url);
				if (blacklist.has(url.hostname))
					return;

				this.#currentRequestsMap.set(det.requestId, {
					status: 0,
					statusText: "unknown",
					startTime: det.timeStamp,
					endTime: -1,
					responseHeaders: [],
					requestHeaders: []
				});
			})
			.onBeforeSendHeaders(true, det => {
				const info = this.#currentRequestsMap.get(det.requestId);
				if (info != null)
					RequestListener.#addHeaders(info.requestHeaders, det.requestHeaders);
			})
			.onHeadersReceived(true, det => {
				const info = this.#currentRequestsMap.get(det.requestId);
				if (info != null) {
					info.status = det.statusCode;
					info.statusText = det.statusLine;
					RequestListener.#addHeaders(info.responseHeaders, det.responseHeaders);
				}
			})
			.onCompleted(det => {
				const info = this.#currentRequestsMap.get(det.requestId);
				if (info != null) {
					info.endTime = det.timeStamp;
					const { tabId, frameId } = det;
					let map = this.#requestInfoMap.get(tabId);
					if (map == null)
					this.#requestInfoMap.set(tabId, map = new Map());
	
					map.set(frameId, info);
				}
			})
			.onEnd(det => this.#currentRequestsMap.delete(det.requestId))
			.build();

		chrome.tabs.onRemoved.addListener(this._onTabRemoved);
	}

	private _onTabRemoved(tabId: number) {
		this.#requestInfoMap.delete(tabId);
	}

	get(tabId: number, frameId?: number) {
		const map = this.#requestInfoMap.get(tabId);
		return map?.get(frameId ?? 0);
	}

	dispose(): void {
		chrome.tabs.onRemoved.removeListener(this._onTabRemoved);
		this.#interceptor.dispose();
	}
}