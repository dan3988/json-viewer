export interface IEvent<THandler extends Fn> {
	addListener(handler: THandler): void;
	removeListener(handler: THandler): void;
}

export class EventHandlers<THandler extends Fn> {
	static readonly #Event = class Event<THandler extends Fn> implements IEvent<THandler> {
		readonly #source: EventHandlers<THandler>;

		constructor(source: EventHandlers<THandler>) {
			this.#source = source;
		}

		addListener(handler: THandler): void {
			this.#source.#handlers.push(handler);
		}

		removeListener(handler: THandler): void {
			const ls = this.#source.#handlers;
			const i = ls.indexOf(handler);
			if (i >= 0)
				ls.splice(i, 1);
		}
	}
	
	readonly #handlers: THandler[];
	readonly #event: IEvent<THandler>;

	get length() {
		return this.#handlers.length;
	}

	get event() {
		return this.#event;
	}

	constructor() {
		this.#handlers = [];
		this.#event = new EventHandlers.#Event(this);
	}

	fire(thisArg: ThisParameterType<THandler>, ...args: Parameters<THandler>) {
		for (let handler of this.#handlers)
			handler.apply(thisArg, args);
	}
}