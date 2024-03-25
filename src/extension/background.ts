import type { DocumentHeader, DocumentRequestInfo, WorkerMessage } from "../types.js";
import settings from "../settings.js";
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
		? updateIcon(mf.action.default_icon, mf.action.default_title)
		: updateIcon(gsIcons, mf.action.default_title + " (Disabled)");
}

function enableRequestListening(bag: settings.SettingsBag<"blacklist">) {
	currentRequestListener?.dispose();
	currentRequestListener = new RequestListener(bag);
}

async function loadExtension() {
	const bag = await settings.get();
	if (!bag.enabled)
		await onEnabledChanged(false);

	settings.addListener(async det => {
		for (let [key, change] of Object.entries(det.changes))
			(bag as any)[key] = change.newValue;

		const enabled = det.changes.enabled;
		if (enabled !== undefined)
			await onEnabledChanged(enabled.newValue);
	});

	const gsIcons: Record<number, string> = { ...mf.action.default_icon };
	for (const key in gsIcons)
		gsIcons[key] = gsIcons[key].replace(".png", "-gs.png");

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

	chrome.permissions.contains({ permissions: ["webRequest"] }, result => result && enableRequestListening(bag));
	chrome.permissions.onAdded.addListener(perm => {
		if (perm.permissions?.includes("webRequest"))
			enableRequestListening(bag);
	});

	chrome.runtime.onMessage.addListener((message: WorkerMessage, sender, respond) => {
		const tabId = sender.tab?.id;
		if (tabId == null)
			return;

		switch (message.type) {
			case "remember": {
				if (sender.url) {
					const url = new URL(sender.url);
					const key = message.autoload ? "whitelist" : "blacklist"
					const list = bag[key];
					list.push(url.host);
					settings.setValue(key, list).then(() => respond(true));
					return true;
				}

				respond(false);
				break;
			}
			case "checkme":
				if (bag.enabled && bag.mimes.includes(message.contentType)) {
					const url = sender.url && new URL(sender.url);
					let autoload = false;
					if (url) {
						if (bag.blacklist.includes(url.host)) {
							respond(false);
							return;
						}

						autoload = bag.whitelist.includes(url.host);
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

isFirefox && chrome.runtime.onInstalled.addListener(det => {
	if (det.reason === chrome.runtime.OnInstalledReason.INSTALL) {
		chrome.tabs.create({
			active: true,
			url: chrome.runtime.getURL("res/firefox.html")
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

	constructor(bag: settings.SettingsBag<"blacklist">) {
		this._onTabRemoved = this._onTabRemoved.bind(this);
		this._onPermissionRemoved = this._onPermissionRemoved.bind(this);
		this.#interceptor = WebRequestInterceptor.builder()
			.addFilterTypes("main_frame", "sub_frame")
			.onBeforeRequest(det => {
				if (det.type === "main_frame")
					this.#requestInfoMap.delete(det.tabId);
	
				const url = new URL(det.url);
				if (bag.blacklist.includes(url.hostname))
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

		chrome.permissions.onRemoved.addListener(this._onPermissionRemoved);
		chrome.tabs.onRemoved.addListener(this._onTabRemoved);
	}

	private _onTabRemoved(tabId: number) {
		this.#requestInfoMap.delete(tabId);
	}

	private _onPermissionRemoved(perm: chrome.permissions.Permissions) {
		if (currentRequestListener == this && perm.permissions?.includes("webRequest")) {
			currentRequestListener = null;
			this.dispose();
		}
	}

	get(tabId: number, frameId?: number) {
		const map = this.#requestInfoMap.get(tabId);
		return map?.get(frameId ?? 0);
	}

	dispose(): void {
		chrome.permissions.onRemoved.removeListener(this._onPermissionRemoved);
		chrome.tabs.onRemoved.removeListener(this._onTabRemoved);
		this.#interceptor.dispose();
	}
}