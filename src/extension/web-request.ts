export interface WebRequestInterceptorBuilder {
	addFilterTypes(...types: chrome.webRequest.ResourceType[]): this;
	addFilterUrls(...urls: string[]): this;

	onBeforeRequest(handler: (det: chrome.webRequest.WebRequestBodyDetails) => void): this;
	onBeforeRequest(includeBody: boolean, handler: (det: chrome.webRequest.WebRequestBodyDetails) => void): this;

	onBeforeSendHeaders(handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;
	onBeforeSendHeaders(includeHeaders: boolean, handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;

	onSendHeaders(handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;
	onSendHeaders(includeHeaders: boolean, handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;

	onAuthRequired(handler: (det: chrome.webRequest.WebAuthenticationChallengeDetails) => void): this;
	onAuthRequired(includeHeaders: boolean, handler: (det: chrome.webRequest.WebAuthenticationChallengeDetails) => void): this;

	onBeforeRedirect(handler: (det: chrome.webRequest.WebRedirectionResponseDetails) => void): this;
	onBeforeRedirect(includeHeaders: boolean, handler: (det: chrome.webRequest.WebRedirectionResponseDetails) => void): this;

	onHeadersReceived(handler: (det: chrome.webRequest.WebResponseHeadersDetails) => void): this;
	onHeadersReceived(includeHeaders: boolean, handler: (det: chrome.webRequest.WebResponseHeadersDetails) => void): this;

	onResponseStarted(handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;
	onResponseStarted(includeHeaders: boolean, handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;

	onCompleted(handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;
	onCompleted(includeHeaders: boolean, handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;

	onErrorOccurred(handler: (det: chrome.webRequest.WebResponseErrorDetails) => void): this;

	onEnd(handler: (det: chrome.webRequest.WebResponseErrorDetails | chrome.webRequest.WebResponseCacheDetails) => void): this;

	build(): WebRequestInterceptor;
}

type EventMap = ChromeEventMap<Chrome["webRequest"]>;
type EventType = keyof EventMap;

interface WebRequestEvent<T extends Function> extends chrome.events.EventWithRequiredFilterInAddListener<T> {
	addListener(callback: T, filter: chrome.webRequest.RequestFilter, opt_extraInfoSpec?: string[]): void;
} 

type IWebRequestInterceptorBuilder = WebRequestInterceptorBuilder;
type EventInfo<T extends EventType = any> = [event: WebRequestEvent<EventMap[T]>, handler: EventMap[T], extraInfoSpec?: string];

export class WebRequestInterceptor {
	static readonly #Builder = class WebRequestInterceptorBuilder implements IWebRequestInterceptorBuilder {
		readonly #types: Set<chrome.webRequest.ResourceType>;
		readonly #urls: string[];
		readonly #events: EventInfo[];

		constructor() {
			this.#types = new Set();
			this.#urls = [];
			this.#events = [];
		}

		build(): WebRequestInterceptor {
			const events = this.#events.slice();
			const filter: chrome.webRequest.RequestFilter = {
				urls: this.#urls
			};

			if (filter.urls.length === 0)
				filter.urls = ["<all_urls>"];

			const types = this.#types;
			if (types.size)
				filter.types = [...types];
			
			for (const [event, handler, extraInfoSpec] of events) {
				const args = [handler, filter] as [handler: Function, filter: chrome.webRequest.RequestFilter, extraInfoSpec?: string[]];
				if (extraInfoSpec)
					args.push([extraInfoSpec]);

				event.addListener.apply(event, args);
			}

			return new WebRequestInterceptor(events);
		}

		addFilterTypes(...types: chrome.webRequest.ResourceType[]): this {
			types.forEach(v => this.#types.add(v));
			return this;
		}

		addFilterUrls(...urls: string[]): this {
			this.#urls.push(...urls);
			return this;
		}

		#addEvent<T extends EventType>(event: WebRequestEvent<EventMap[T]>, extraInfoSpec: string, arg0: boolean | EventMap[T], arg1: undefined | EventMap[T]): this {
			const [handler, useExtra]: [EventMap[T], boolean] = <any>(arg1 == null ? [arg0, false] : [arg1, arg0]);
			const info: EventInfo = [event, handler];
			if (useExtra)
				info.push(extraInfoSpec);

			this.#events.push(info);
			return this;
		}

		onBeforeRequest(handler: (det: chrome.webRequest.WebRequestBodyDetails) => void): this;
		onBeforeRequest(includeBody: boolean, handler: (det: chrome.webRequest.WebRequestBodyDetails) => void): this;
		onBeforeRequest(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onBeforeRequest, "requestBody", arg0, arg1);
		}

		onBeforeSendHeaders(handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;
		onBeforeSendHeaders(includeHeaders: boolean, handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;
		onBeforeSendHeaders(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onBeforeSendHeaders, "requestHeaders", arg0, arg1);
		}
		
		onSendHeaders(handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;
		onSendHeaders(includeHeaders: boolean, handler: (det: chrome.webRequest.WebRequestHeadersDetails) => void): this;
		onSendHeaders(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onSendHeaders, "requestHeaders", arg0, arg1);
		}
		
		onAuthRequired(handler: (det: chrome.webRequest.WebAuthenticationChallengeDetails) => void): this;
		onAuthRequired(includeHeaders: boolean, handler: (det: chrome.webRequest.WebAuthenticationChallengeDetails) => void): this;
		onAuthRequired(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onAuthRequired, "responseHeaders", arg0, arg1);
		}

		onBeforeRedirect(handler: (det: chrome.webRequest.WebRedirectionResponseDetails) => void): this;
		onBeforeRedirect(includeHeaders: boolean, handler: (det: chrome.webRequest.WebRedirectionResponseDetails) => void): this;
		onBeforeRedirect(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onBeforeRedirect, "responseHeaders", arg0, arg1);
		}

		onHeadersReceived(handler: (det: chrome.webRequest.WebResponseHeadersDetails) => void): this;
		onHeadersReceived(includeHeaders: boolean, handler: (det: chrome.webRequest.WebResponseHeadersDetails) => void): this;
		onHeadersReceived(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onHeadersReceived, "responseHeaders", arg0, arg1);
		}

		onResponseStarted(handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;
		onResponseStarted(includeHeaders: boolean, handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;
		onResponseStarted(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onResponseStarted, "responseHeaders", arg0, arg1);
		}

		onCompleted(handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;
		onCompleted(includeHeaders: boolean, handler: (det: chrome.webRequest.WebResponseCacheDetails) => void): this;
		onCompleted(arg0: any, arg1?: any): this {
			return this.#addEvent(chrome.webRequest.onCompleted, "responseHeaders", arg0, arg1);
		}

		onEnd(handler: (det: chrome.webRequest.WebResponseErrorDetails | chrome.webRequest.WebResponseCacheDetails) => void): this {
			this.#events.push([chrome.webRequest.onErrorOccurred, handler]);
			this.#events.push([chrome.webRequest.onCompleted, handler]);
			return this;
		}
	
		onErrorOccurred(handler: (det: chrome.webRequest.WebResponseErrorDetails) => void): this {
			this.#events.push([chrome.webRequest.onErrorOccurred, handler]);
			return this;
		}
	}

	static builder(): WebRequestInterceptorBuilder {
		return new this.#Builder();
	}

	readonly #events: EventInfo[];

	private constructor(events: EventInfo[]) {
		this.#events = events;
	}

	dispose() {
		for (const [event, handler] of this.#events)
			event.removeListener(handler);

		this.#events.length = 0;
	}
}

export default WebRequestInterceptor;