export interface IEvent<TSelf, TArgs extends any[]> {
	addListener(handler: Handler<TSelf, TArgs>): void;
	removeListener(handler: Handler<TSelf, TArgs>): void;
}

type Handler<TSelf, TArgs extends any[]> = (this: TSelf, ...args: TArgs) => any;

export class EventHandlers<TSelf, TArgs extends any[]> {
	static readonly #Event = class Event<TSelf, TArgs extends any[]> implements IEvent<TSelf, TArgs > {
		readonly #source: EventHandlers<TSelf, TArgs>;

		constructor(source: EventHandlers<TSelf, TArgs>) {
			this.#source = source;
		}

		addListener(handler: Handler<TSelf, TArgs>): void {
			this.#source.#handlers.push(handler);
		}

		removeListener(handler: Handler<TSelf, TArgs>): void {
			const ls = this.#source.#handlers;
			const i = ls.indexOf(handler);
			if (i >= 0)
				ls.splice(i, 1);
		}
	}
	
	readonly #handlers: Handler<TSelf, TArgs>[];
	readonly #event: IEvent<TSelf, TArgs>;

	get hasListeners() {
		return this.#handlers.length > 0;
	}

	get event() {
		return this.#event;
	}

	constructor() {
		this.#handlers = [];
		this.#event = new EventHandlers.#Event(this);
	}

	fire(thisArg: TSelf, ...args: TArgs) {
		for (let handler of this.#handlers)
			handler.apply(thisArg, args);
	}
}