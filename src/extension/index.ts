import type { DocumentHeader, DocumentRequestInfo, WorkerMessage } from "../types.js";
import type { State } from "../state.js";
import ImmutableArray from "../immutable-array.js";
import preferences from "../preferences-lite.js";
import lib from "../lib.json" with { type: "json" };
import WebRequestInterceptor from "./web-request.js";

type PrefsState = State<preferences.lite.Bag>;

function onEnabledChanged(enabled: boolean) {
	return enabled
		? void updateIcon(mf.action.default_icon, mf.action.default_title)
		: void updateIcon(gsIcons, mf.action.default_title + " (Disabled)");
}

function reset<T>(set: Set<T>, source: ImmutableArray<T>) {
	set.clear();
	source.forEach(set.add, set);
}

function injectPopup(tabId: number, frameId?: number) {
	const target = getTarget(tabId, frameId);
	return inject(target, true, "lib/content.js");
}

function updateIcon(path: Record<string, string>, title: string) {
	const setIcon = chrome.action.setIcon({ path });
	const setTitle = chrome.action.setTitle({ title });
	return Promise.all([setIcon, setTitle]);
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

async function injectViewer(tabId: number, frameId?: number) {
	const target = getTarget(tabId, frameId);
	if (isFirefox) {
		return await inject(target, true, "lib/messaging.firefox.js", "res/ffstub.js", lib.json5, "lib/viewer.js");
	} else {
		await inject(target, false, "lib/messaging.chrome.js");
		return await inject(target, true, "res/ffstub.js", lib.json5, "lib/viewer.js");
	}
}

const mf = chrome.runtime.getManifest();
const isFirefox = !!mf.browser_specific_settings?.gecko;
const gsIcons: Record<number, string> = { ...mf.action.default_icon };
for (const key in gsIcons)
	gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

class ExtensionListener {
	#prefs: PrefsState | Promise<PrefsState>;
	readonly #whitelist = new Set<string>();
	readonly #blacklist = new Set<string>();
	readonly #mimes = new Set<string>();
	#requestListener: null | RequestListener = null;

	constructor() {
		this.#prefs = preferences.lite.manager.watch();
		this.#prefs.then(this.#init.bind(this));
	}

	async #init(prefs: PrefsState) {
		this.#prefs = prefs;
		const [whitelist, blacklist, mimes] = [this.#whitelist, this.#blacklist, this.#mimes];
		prefs.props.enabled.subscribe(onEnabledChanged);
		prefs.props.useWebRequest.subscribe(this.#setRequestListening.bind(this));
		prefs.props.whitelist.subscribe(v => reset(whitelist, v));
		prefs.props.blacklist.subscribe(v => reset(blacklist, v));
		prefs.props.mimes.subscribe(v => reset(mimes, v));
	}

	#setRequestListening(enabled: boolean) {
		if (enabled) {
			try {
				this.#requestListener = new RequestListener(this.#blacklist);
			} catch (e) {
				console.error("Failed to start listening to webRequest events", e);
			}
		} else {
			try {
				this.#requestListener?.dispose();
			} catch (e) {
				console.error("Failed to dispose webRequest listener", e);
			} finally {
				this.#requestListener = null;
			}
		}
	}

	#withPrefs<V>(handler: (prefs: PrefsState) => V): V | Promise<V> {
		if (this.#prefs instanceof Promise) {
			return this.#prefs.then(handler);
		} else {
			return handler(this.#prefs);
		}
	}

	handleMessage(message: WorkerMessage, sender: chrome.runtime.MessageSender) {
		const tabId = sender.tab?.id;
		if (tabId == null)
			return;

		switch (message.type) {
			case "remember":
				if (sender.url) {
					const url = new URL(sender.url);
					const [key, set] = message.autoload ? ["whitelist", this.#whitelist] as const : ["blacklist", this.#blacklist] as const;
					return this.#withPrefs(prefs => {
						if (!set.has(url.host)) {
							const list = prefs.getValue(key)
							const updated = ImmutableArray.append(list, url.host);
							preferences.lite.manager.set(key, updated);
							return true;
						}
					});
				}

				return false;
			case "checkme":
				return this.#withPrefs(prefs => {
					if (prefs.getValue("enabled") && this.#mimes.has(message.contentType)) {
						const url = sender.url && new URL(sender.url);
						let autoload = false;
						if (url) {
							if (this.#blacklist.has(url.host))
								return false;
		
							autoload = this.#whitelist.has(url.host);
						}
		
						const fn = autoload ? injectViewer : injectPopup;
						return fn(tabId, sender.frameId);
					}
				});
			case "loadme":
				return injectViewer(tabId, sender.frameId);
			case "requestInfo":
				return this.#requestListener?.get(tabId);
		}
	}
}

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

const listener = new ExtensionListener();

chrome.runtime.onInstalled.addListener(det => {
	if (det.reason === chrome.runtime.OnInstalledReason.INSTALL) {
		chrome.tabs.create({
			active: true,
			url: chrome.runtime.getURL("res/setup.html")
		});
	}
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
	const result = listener.handleMessage(message, sender);
	result instanceof Promise ? result.then(respond) : respond(result);
});
