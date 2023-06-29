interface ExtendedEventTarget<Events = Dict<Event>> extends EventTarget {
	on<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): this;
	once<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): this;
	off<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): this;
	subscribe<K extends keyof Events>(type: K, handler: (this: this, evt: Events[K]) => any): Action;
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
