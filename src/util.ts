
const jsIdentifier = /^[$A-Z_][0-9A-Z_$]*$/i;

export function isIdentifier(text: string) {
	return jsIdentifier.test(text);
}

export function toPointer(segment: string | number) {
	return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

type ExtractFunctions<TObject extends object> = { [P in keyof TObject as TObject[P] extends Function ? P : never]?: TObject[P] extends (...args: infer A) => infer V ? (this: TObject, ...args: A) => V : never };
type ExtractAccessors<TObject extends object> = { [P in keyof TObject as TObject[P] extends Function ? never : P]?: Accessor<TObject, TObject[P]> };

interface Accessor<T, V> {
	get?(this: T): V;
	set?(this: T, value: V): void;
}

interface ClassDefs<T extends object> {
	accessors?: ExtractAccessors<T>
	functions?: ExtractFunctions<T>
}

function* allKeys(value: object): Iterable<string | symbol> {
	for (const key of Object.getOwnPropertyNames(value))
		yield key;

	for (const key of Object.getOwnPropertySymbols(value))
		yield key;
}

export function defValue<T extends object, K extends keyof T>(object: T, p: K, value: T[K], enumerable?: boolean, writable?: boolean, configurable?: boolean): void
export function defValue(object: object, p: PropertyKey, value: any, enumerable?: boolean, writable?: boolean, configurable?: boolean): void
export function defValue(object: object, p: PropertyKey, value: any, enumerable?: boolean, writable?: boolean, configurable?: boolean): void {
	Object.defineProperty(object, p, { value, enumerable, writable, configurable });
}

export function defFn<T extends object>(clazz: Constructor<T>, functions: ExtractFunctions<T>): void
export function defFn(clazz: Function, functions: any): void {
	for (const key of allKeys(functions)) {
		const fn = functions[key];
		defValue(fn, "name", key, false, false, true);
		defValue(clazz.prototype, key, fn, false, true, true);
	}
}

export function def<T extends object>(clazz: Constructor<T>, defs: ClassDefs<T>): void
export function def(clazz: Constructor<any>, { accessors, functions }: ClassDefs<any>): void {
	if (accessors) {
		for (const key in allKeys(accessors)) {
			const { get, set } = accessors[key]!;
			Object.defineProperty(clazz.prototype, key, { get, set, enumerable: true });
		}
	}

	if (functions)
		defFn(clazz, functions);
}

/**
 * Shortcut for `instance[key].bind(instance[key], ...args)`
 */
export function delegate<T, K extends keyof { [P in keyof T as T[P] extends (...args: [...A, ...any[]]) => any ? P : never]: T[P] }, A extends any[]>(instance: T, key: K, ...args: A): T[K] extends (...args: [...A, ...infer B]) => infer R ? (...args: [...B]) => R : unknown
export function delegate(instance: any, key: PropertyKey, ...args: any[]) {
	const fn: Fn = instance[key];
	return fn.bind(instance, ...args);
}