export interface ReadOnlyArrayLikeProxyHandler<Target extends object, Element> {
	getIterator(self: Target): () => Iterator<Element>;
	getLength(self: Target): number;
	getAt(self: Target, index: number): Element;
}

export interface MutableArrayLikeProxyHandler<Target extends object, Element> extends ReadOnlyArrayLikeProxyHandler<Target, Element> {
	setLength(self: Target, length: number): boolean;
	setAt(self: Target, index: number, value: Element): boolean;
}

interface RealArrayLikeProxyHandler<Target extends object = any, Element = any> {
	getIterator(self: Target): () => Iterator<Element>;
	getLength(self: Target): number;
	getAt(self: Target, index: number): Element;
	setLength?(self: Target, length: number): boolean;
	setAt?(self: Target, index: number, value: Element): boolean;
}

interface HasLength {
	readonly length: number;
}

//type BuildObject<Obj, Required extends keyof Obj, Optional extends Exclude<keyof Obj, Required> = never> = { [K in Required]: Obj[K] } & { [K in Optional]?: Obj[K] };
type MakeOptional<Obj extends object, Keys extends keyof Obj> = { [P in Keys]?: Obj[P] } & { [P in Exclude<keyof Obj, Keys>]: Obj[P] };
type ArgType<Base extends ReadOnlyArrayLikeProxyHandler<any, any>, Target extends object> = MakeOptional<Base, (Target extends HasLength ? "getLength" : never) | (Target extends Iterable<any> ? "getIterator" : never)>;

function desc<T>(value: T, configurable?: boolean, enumerable?: boolean, writable?: boolean): TypedPropertyDescriptor<T> {
	return { value, configurable, enumerable, writable };
}

function getter(this: PropertyKey, self: any): any {
	return self[this];
}

function validateDesc<T>(key: string | symbol, desc: TypedPropertyDescriptor<T>, enumerable: boolean, writable: boolean) {
	if (!desc.configurable)
		throw new TypeError(`Property ${String(key)} must be configurable.`);
	if (desc.enumerable != enumerable)
		throw new TypeError(`Property ${String(key)} must ${enumerable ? "be" : "not be"} enumerable.`);
	if (desc.writable != writable)
		throw new TypeError(`Property ${String(key)} must ${writable ? "be" : "not be"} writable.`);

	return true;
}

interface Wrapper<T> {
	self: T;
	length: undefined;
	[Symbol.iterator]: undefined;
}

class HandlerImpl<Target extends object, Element> implements ProxyHandler<Wrapper<Target>> {
	readonly #handler: RealArrayLikeProxyHandler<Target, Element>;

	constructor(handler: RealArrayLikeProxyHandler<Target, Element>) {
		const { getAt, setAt, setLength } = handler;
		this.#handler = {
			getAt,
			getLength: handler.getLength ?? getter.bind("length"),
			getIterator: handler.getIterator ?? getter.bind(Symbol.iterator),
			setAt,
			setLength
		};
	}

	ownKeys(wrapper: Wrapper<Target>): ArrayLike<string | symbol> {
		const { self } = wrapper;
		const len = this.#handler.getLength(self);
		const keys = Array<string | symbol>(len + 2);
		keys[0] = "length";
		keys[1] = Symbol.iterator;
		for (let i = 0; i < len; i++)
			keys[i + 2] = String(i);

		if (!(Symbol.iterator in wrapper)) {
			const handler = this.#handler;
			const length = handler.getLength(self);
			const getIterator = handler.getIterator(self);
			const writable = handler.setLength != null;
			Reflect.defineProperty(wrapper, "length", {
				configurable: false,
				enumerable: false,
				writable,
				value: length
			});
			Reflect.defineProperty(wrapper, Symbol.iterator, {
				configurable: false,
				enumerable: false,
				writable: false,
				value: getIterator
			});
		}

		return keys;
	}

	has({ self }: Wrapper<Target>, p: string | symbol): boolean {
		if (p === "length" || p === Symbol.iterator)
			return true;

		const n = Number(p);
		const len = this.#handler.getLength(self);
		return Number.isInteger(n) && n >= 0 && n < len;
	}

	get({ self }: Wrapper<Target>, p: string | symbol) {
		const handler = this.#handler;
		if (p === "length")
			return handler.getLength(self);

		if (p === Symbol.iterator)
			return handler.getIterator(self);

		const n = Number(p);
		if (Number.isInteger(n))
			return handler.getAt(self, n);
	}

	getOwnPropertyDescriptor(wrapper: Wrapper<Target>, p: string | symbol): PropertyDescriptor | undefined {
		const { self } = wrapper;
		const handler = this.#handler;
		if (p === "length") {
			const value = handler.getLength(self);
			const writable = handler.setLength != null;
			Reflect.defineProperty(wrapper, "length", {
				configurable: false,
				enumerable: false,
				writable,
				value
			});
			return desc(value, false, false, writable);
		}

		if (p === Symbol.iterator) {
			const value = handler.getIterator(self);
			Reflect.defineProperty(wrapper, Symbol.iterator, {
				configurable: false,
				enumerable: false,
				writable: false,
				value
			});
			return desc(value, false, false, false)
		}

		const n = Number(p);
		if (Number.isInteger(n)) {
			const value = handler.getAt(self, n);
			return desc(value, true, true, handler.setAt != null);
		}
	}

	set(wrapper: Wrapper<Target>, p: string | symbol, newValue: any): boolean {
		const { self } = wrapper;
		const handler = this.#handler;
		if (typeof p === "symbol")
			return false;

		if (p === "length")
			return this.#setLength(wrapper, newValue);

		if (handler.setAt == null)
			return false;

		const n = Number(p);
		return Number.isInteger(n) && handler.setAt(self, n, newValue);
	}

	#setLength(wrapper: Wrapper<Target>, value: any): boolean {
		const handler = this.#handler;
		if (handler.setLength == null || !handler.setLength(wrapper.self, value))
			return false;

		value = handler.getLength(wrapper.self);
		Reflect.defineProperty(wrapper, "length", {
			configurable: false,
			enumerable: false,
			writable: true,
			value
		});

		return true;
	}

	defineProperty(wrapper: Wrapper<Target>, p: string | symbol, attributes: PropertyDescriptor): boolean {
		const handler = this.#handler;
		if (typeof p === "symbol")
			return false;

		if (p === "length")
			return handler.setLength != null && validateDesc(p, attributes, false, true) && this.#setLength(wrapper, attributes.value);

		if (handler.setAt == null)
			return false;

		const n = Number(p);
		return Number.isInteger(n) && validateDesc(p, attributes, true, true) && handler.setAt(wrapper.self, n, attributes.value);
	}
}

interface ReadOnlyArrayLike<T> {
	readonly length: number;
	readonly [index: number]: T;
	[Symbol.iterator](): Iterator<T>;
}

interface MutableArrayLike<T> extends ReadOnlyArrayLike<T> {
	length: number;
	[index: number]: T;
}

interface ArrayLikeProxyConstructor {
	new <Target extends object, Element>(target: Target, handler: ArgType<ReadOnlyArrayLikeProxyHandler<Target, Element>, Target>): ReadOnlyArrayLike<Element>;
	new <Target extends object, Element>(target: Target, handler: ArgType<MutableArrayLikeProxyHandler<Target, Element>, Target>): MutableArrayLike<Element>;
}

var _ArrayLikeProxy = function ArrayLikeProxy(self: any, handler: any) {
	const wrapper = {
		self
	};
	return new Proxy(wrapper, new HandlerImpl(handler));
}

Object.setPrototypeOf(_ArrayLikeProxy, Proxy);
_ArrayLikeProxy.prototype = undefined;

export var ArrayLikeProxy: ArrayLikeProxyConstructor = _ArrayLikeProxy as any;
export default ArrayLikeProxy;
