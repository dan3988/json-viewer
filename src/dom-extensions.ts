interface ExtendedEventTarget<Events = Dict<Event>> extends EventTarget {
	/**
	 * Shorthand for {@linkcode EventTarget.addEventListener}
	 * @param type The type of event to listen for
	 * @param handler The function to be called when the event is dispatched
	 */
	on<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): this;
	/**
	 * Shorthand for {@linkcode EventTarget.addEventListener} with `{ once: true }` passed in as the third argument.
	 * @param type The type of event to listen for
	 * @param handler The function to be called when the event is dispatched
	 */
	once<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): this;
	/**
	 * Shorthand for {@linkcode EventTarget.removeEventListener}
	 * @param type The type of event to remove the event handler for
	 * @param handler The function to remove from the list of event handlers
	 */
	off<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): this;
	/**
	 * Add an event listener for events of type {@link K}, and return a function used to unsubscribe from the event.
	 * @param type The type of event to listen for
	 * @param handler The function to be called when the event is dispatched
	 * @returns A function used to unsubscribe from all events
	 */
	subscribe<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): Action;
	/**
	 * Add event listeners for multiple events, using the keys of {@link handlers}, and return a function used to unsubscribe from all events.
	 * @param handlers A dictionary of event names and their handlers
	 * @returns A function used to unsubscribe from all events
	 */
	subscribe(handlers: { [P in keyof Events]?: (this: this, evt: Events[P]) => any }): Action;
}

interface Document extends ExtendedEventTarget<DocumentEventMap> {
}

interface Window extends ExtendedEventTarget<WindowEventMap> {
}

interface HTMLElement extends ExtendedEventTarget<HTMLElementEventMap> {
}

{
	const optOnce = { once: true };

	const on: ExtendedEventTarget["on"] = function(this: ExtendedEventTarget, type, handler) {
		this.addEventListener(type, handler);
		return this;
	}

	const once: ExtendedEventTarget["once"] = function(this: ExtendedEventTarget, type, handler) {
		this.addEventListener(type, handler, optOnce);
		return this;
	}

	const off: ExtendedEventTarget["off"] = function(this: ExtendedEventTarget, type, handler) {
		this.removeEventListener(type, handler);
		return this;
	}

	const subscribe: ExtendedEventTarget["subscribe"] = function(this: EventTarget, arg0: any, arg1?: any) {
		if (typeof arg0 === "string") {
			this.addEventListener(arg0, arg1);
			return unsub.bind(this, [arg0, arg1]);
		} else {
			const listeners: any[] = [];
			for (const key in arg0) {
				const handler = arg0[key];
				this.addEventListener(key, handler);
				listeners.push(key, handler);
			}
			return unsub.bind(this, listeners);
		}
	}

	const unsub = function(this: EventTarget, values: any[]) {
		const it = values[Symbol.iterator]();
		while (true) {
			const [type, handler] = it;
			if (type == undefined)
				break;

			this.removeEventListener(type, handler);
		}
	}

	const def = function(ctor: Function, value: Function) {
		Object.defineProperty(ctor.prototype, value.name, {
			configurable: true,
			writable: true,
			value,
		});
	}

	def(EventTarget, once);
	def(EventTarget, on);
	def(EventTarget, off);
	def(EventTarget, subscribe);
}
