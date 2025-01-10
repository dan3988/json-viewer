export type ImmutableArray<T = any> = readonly T[];

export function ImmutableArray<T>(...values: T[]): ImmutableArray<T> {
	return ImmutableArray.from(values);
}

function clamp(value: number, min: number, max: number) {
	return value <= min ? min : (value > max ? max : value)
}

/**
 * Define a range of values starting at {@link index}, using a range of values in {@link src} starting from {@link srcIndex} and ending at {@link srcEnd}.
 * @param index Index in this array to start defining values.
 * @param src The object to copy values from.
 * @param srcIndex The first index in the source to copy.
 * @param srcEnd The last index in the source to copy.
 * @returns The index of the last value defined, plus one.
 */
function addValues(array: any[], index: number, src: ArrayLike<any>, srcIndex: number = 0, srcEnd: number = src.length): number {
	for (; srcIndex < srcEnd; index++, srcIndex++)
		Object.defineProperty(array, index, { value: src[srcIndex], enumerable: true });

	return index;
}

function asFrozen<T>(array: readonly T[]) {
	return Object.isFrozen(array) ? array : Object.freeze([ ...array ]);
}

export namespace ImmutableArray {
	export const empty: readonly [] = Object.freeze([]);

	export function from<T>(items: Iterable<T>): ImmutableArray<T>;
	export function from<T, V>(items: Iterable<T>, mapping: (value: T, index: number) => V, thisArg?: any): ImmutableArray<V>; 
	export function from(items: Iterable<any>, mapping?: (value: any, index: number) => any, thisArg?: any) {
		if (isArrayLike(items)) {
			const length = Number(items.length);
			if (length === 0 || isNaN(length))
				return empty;

			const array: any[] = [];
			for (let i = 0; i < length; i++) {
				let value = items[i];
				if (mapping)
					value = mapping.call(thisArg, value, i);

				array.push(value);
			}

			return Object.freeze(array);
		} else if (Symbol.iterator in items) {
			const it = items[Symbol.iterator]();
			let res = it.next();
			if (res.done)
				return empty;

			const array: any[] = [];
			do {
				const value = mapping ? mapping.call(thisArg, res.value, array.length) : res.value;
				array.push(value);
			} while (!(res = it.next()).done);

			return Object.freeze(array);
		} else {
			throw new TypeError(`${items} is not iterable`);
		}
	}

	export function append<T extends readonly any[], V extends readonly any[]>(array: T, ...values: V): readonly [...T, ...V];
	export function append<T>(array: readonly T[], ...values: T[]): ImmutableArray<T>;
	export function append<T, V>(array: readonly T[], ...values: V[]): ImmutableArray<T | V>;
	export function append(array: readonly any[], ...values: any[]): ImmutableArray {
		if (values.length === 0)
			return array;

		const result: any[] = [];
		result.push(...array);
		result.push(...values);
		return Object.freeze(result);
	}

	export function prepend<T extends ImmutableArray, V extends ImmutableArray>(array: T, ...values: V): readonly [...V, ...T];
	export function prepend<T>(array: ImmutableArray<T>, ...values: ImmutableArray<T>): ImmutableArray<T>;
	export function prepend<T, V>(array: ImmutableArray<T>, ...values: readonly V[]): ImmutableArray<T | V>;
	export function prepend(array: ImmutableArray, ...values: ImmutableArray): ImmutableArray {
		if (values.length === 0)
			return array;

		const result: any[] = [];
		result.push(...values);
		result.push(...array);
		return Object.freeze(result);
	}

	export function insert<T>(array: ImmutableArray<T>, index: number, ...items: any[]) {
		if (items.length === 0)
			return array;

		index = toIndex(index, array.length);

		let i: number;

		const result: any = [];
		i = addValues(result, 0, array, 0, index);
		i = addValues(result, i, items);
		i = addValues(result, i, array, index);
		return Object.freeze(result);
	}

	export function set<T, V>(array: ImmutableArray<T>, index: number, value: V): ImmutableArray<T | V>;
	export function set<T>(array: ImmutableArray<T>, index: number, value: T): ImmutableArray<T>;
	export function set(array: ImmutableArray, index: number, value: any): ImmutableArray {
		const result = array.with(index, value);
		return Object.freeze(result);
	}

	export function remove<T>(array: ImmutableArray<T>, start: number, end?: number): ImmutableArray<T> {
		const { length } = array;
		start = toIndex(start, length);
		end = end === undefined ? length : toIndex(end, length);

		if (start === 0 && end === length)
			return empty;

		if (start >= end)
			return asFrozen(array);

		const result: any[] = [];
		addValues(result, 0, array, 0, start);
		addValues(result, start, array, end);
		return Object.freeze(result);
	}

	export function splice<T>(array: ImmutableArray<T>, start: number): ImmutableArray<T>;
	export function splice<T, V>(array: ImmutableArray<T>, start: number, deleteCount: number, ...items: V[]): ImmutableArray<T | V>;
	export function splice<T>(array: ImmutableArray<T>, start: number, deleteCount: number, ...items: ImmutableArray<T>): ImmutableArray<T>;
	export function splice(array: ImmutableArray, start: number, deleteCount?: number, ...items: ImmutableArray): ImmutableArray {
		const { length } = array;
		start = toIndex(start, length);
		const end = deleteCount === undefined ? length : clamp(start + toIntegerOrInfinity(deleteCount), start, length);

		if (items.length === 0) {
			if (start === end && Object.isFrozen(array))
				return array;

			if (start === 0 && end === length)
				return empty;
		}

		let i: number;

		const result: any[] = [];
		i = addValues(result, 0, array, 0, start);
		i = addValues(result, i, items);
		i = addValues(result, i, array, end);
		return Object.freeze(result);
	}

	export function slice<T>(array: ImmutableArray<T>, start: number, end?: number) {
		const { length } = array;
		start = toIndex(start, length);
		end = end === undefined ? length : toIndex(end, length);

		if (start === 0 && end === length)
			return asFrozen(array);

		if (start >= end)
			return empty;

		const result: any[] = [];
		addValues(result, 0, array, start, end);
		return Object.freeze(result);
	}

	export function reverse<T extends readonly any[]>(array: T): Reverse<T>;
	export function reverse<T>(array: ImmutableArray<T>): ImmutableArray<T>;
	export function reverse(array: ImmutableArray): ImmutableArray {
		if (array.length == 0)
			return array;

		const other: any[] = [];
		for (let i = 0, j = array.length; j > 0; i++)
			other[i] = array[--j];

		return Object.freeze(other);
	}

	export function filter<T, S extends T>(array: ImmutableArray<T>, predicate: (value: T, index: number, array: ImmutableArray<T>) => value is S, thisArg?: any): ImmutableArray<S>;
	export function filter<T>(array: ImmutableArray<T>, predicate: (value: T, index: number, array: ImmutableArray<T>) => unknown, thisArg?: any): ImmutableArray<T>;	
	export function filter(array: ImmutableArray, predicate: (value: any, index: number, array: ImmutableArray) => unknown, thisArg?: any) {
		let length = 0;
		const result: any = [];
		for (let i = 0; i < array.length; i++) {
			const value = array[i];
			if (predicate.call(thisArg, array[i], i, array))
				result[length++] = value;
		}

		return Object.freeze(result);
	}
}

type Reverse<T extends readonly any[]> = T extends [infer A, ...infer B] ? _Reverse<[A], B> : (T extends (infer V)[] ? readonly V[] : T);
type _Reverse<X extends readonly any[], Y extends any[]> = Y extends [infer A, ...infer B] ? _Reverse<readonly [A, ...X], B> : X;

export default ImmutableArray;

function toIntegerOrInfinity(value: any) {
	return (value = +value) !== value || value === 0 ? 0 : Math.trunc(value);
}

function toIndex(value: any, length: number) {
	const int = toIntegerOrInfinity(value);
	return int < 0 ? Math.max(length + int, 0) : Math.min(int, length);
}

function isArrayLike(value: any): value is ArrayLike<any> {
	return typeof value === "string" || "length" in value;
}
