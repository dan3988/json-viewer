class ObjectProxyHandler implements ProxyHandler<any> {
	readonly #path: PropertyKey[];

	constructor(path: PropertyKey[]) {
		this.#path = path;
	}

	#expand(value: any) {
		for (const key of this.#path) {
			const type = typeof (value = value[key]);
			if (type !== "function" && type !== "object")
				return undefined;
		}

		return value;
	}

	get(target: any, p: string | symbol) {
		const value = Reflect.get(target, p);
		return value && this.#expand(value)
	}

	getOwnPropertyDescriptor(target: any, p: string | symbol): PropertyDescriptor | undefined {
		const prop = Reflect.getOwnPropertyDescriptor(target, p);
		if (prop)
			prop.value = this.#expand(prop.value);

		return prop;
	}
}

export function objectProxy<T extends object, K extends keyof T[keyof T]>(target: T, key: K): { [P in keyof T]: T[P][K] }
export function objectProxy<T extends object, K1 extends keyof T[keyof T], K2 extends keyof T[keyof T][K1]>(target: T, key1: K1, key2: K2): { [P in keyof T]: T[P][K1][K2] }
export function objectProxy(target: object, ...keys: string[]): unknown
export function objectProxy(target: object, ...keys: string[]): object {
	const handler = new ObjectProxyHandler(keys);
	return new Proxy(target, handler);
}

export default objectProxy;
