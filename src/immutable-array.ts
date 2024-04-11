type IImmutableArray<T> = ImmutableArray<T>;

namespace impl {
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

	export class ImmutableArray<T = any> implements IImmutableArray<T> {
		static readonly #empty = new this<any>().#finalize(0);
		static readonly empty: ImmutableArray<never> = ImmutableArray.#empty as any;

		static from(values: Iterable<any>, mapping?: (value: any) => any, thisArg?: any) {
			if (values instanceof ImmutableArray)
				return mapping ? values.map(mapping) : values;

			if (isArrayLike(values)) {
				const length = Number(values.length);
				if (length === 0 || isNaN(length))
					return ImmutableArray.#empty;

				const array = new ImmutableArray();
				for (let i = 0; i < length; i++) {
					let value = values[i];
					if (mapping)
						value = mapping.call(thisArg, value);

					array.#setValue(i, value);
				}

				return array.#finalize(length);
			} else if (Symbol.iterator in values) {
				const it = values[Symbol.iterator]();
				let res = it.next();
				if (res.done)
					return ImmutableArray.#empty;

				const array = new ImmutableArray();
				for (let i = 0; ; i++) {
					const value = mapping ? mapping.call(thisArg, res.value) : res.value;
					array.#setValue(i, value);

					if ((res = it.next()).done)
						return array.#finalize(i + 1);
				}
			} else {
				throw new TypeError(`${values} is not iterable`);
			}
		}

		readonly [i: number]: T;

		declare readonly length: number;

		declare [Symbol.iterator]: () => IterableIterator<T>;
		declare includes: (searchElement: T, fromIndex?: number) => boolean;
		declare at: (index: number) => T | undefined;

		declare toString: () => string;
		declare toLocaleString: () => string;

		declare join: (separator?: string) => string;

		declare indexOf: (searchElement: T, fromIndex?: number) => number;
		declare lastIndexOf: (searchElement: T, fromIndex?: number) => number;

		declare find: (predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any) => T | undefined;
		declare findIndex: (predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any) => number;
		declare findLast: (predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any) => T | undefined;
		declare findLastIndex: (predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any) => number;

		declare every: (predicate: (value: T, index: number, array: this) => unknown, thisArg?: any) => boolean;

		declare some: (predicate: (value: T, index: number, array: this) => unknown, thisArg?: any) => boolean;

		declare forEach: (callbackfn: (value: T, index: number, array: this) => void, thisArg?: any) => boolean;

		declare reduce: (callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: this) => T) => T;
		declare reduceRight: (callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: this) => T) =>T;

		/**
		 * 
		 * @param length 
		 * @returns 
		 */
		#finalize(length: number) {
			Object.defineProperty(this, "length", { value: length });
			return Object.preventExtensions(this);
		}

		/**
		 * Define a range of values starting at {@link index}, using a range of values in {@link src} starting from {@link srcIndex} and ending at {@link srcEnd}.
		 * @param index Index in this array to start defining values.
		 * @param src The object to copy values from.
		 * @param srcIndex The first index in the source to copy.
		 * @param srcEnd The last index in the source to copy.
		 * @returns The index of the last value defined, plus one.
		 */
		#addValues(index: number, src: ArrayLike<any>, srcIndex: number = 0, srcEnd: number = src.length): number {
			for (; srcIndex < srcEnd; index++, srcIndex++)
				Object.defineProperty(this, index, { value: src[srcIndex], enumerable: true });

			return index;
		}

		/**
		 * Declares an enumerable, read-only & non-configurable property with key {@link index} and value {@link value}
		 * @param index 
		 * @param value 
		 */
		#setValue(index: number, value: T) {
			Object.defineProperty(this, index, { value, enumerable: true });
		}

		toArray(): T[] {
			return Array.from(this);
		}

		map<V>(mapping: (value: T, index: number, array: this) => V, thisArg?: any): ImmutableArray<V> {
			const result = new ImmutableArray();
			for (let i = 0; i < this.length; i++) {
				const value = mapping.call(thisArg, this[i], i, this);
				result.#setValue(i, value);
			}
			
			return result.#finalize(this.length);
		}

		filter<S extends T>(predicate: (value: T, index: number, array: this) => value is S, thisArg?: any): ImmutableArray<S>;
		filter(predicate: (value: T, index: number, array: this) => unknown, thisArg?: any): ImmutableArray<T>;	
		filter(predicate: (value: any, index: number, array: this) => unknown, thisArg?: any) {
			let length = 0;
			const result = new ImmutableArray();
			for (let i = 0; i < this.length; i++) {
				const value = this[i];
				if (predicate.call(thisArg, this[i], i, this))
					result.#setValue(length++, value);
			}

			return result.#finalize(length);
		}

		add(...values: any[]) {
			if (values.length === 0)
				return this;

			const result = new ImmutableArray<T>();
			result.#addValues(0, this);
			const length = result.#addValues(this.length, values, 0, values.length);
			result.#finalize(length);
			return result;
		}

		set<V>(index: number, value: V): ImmutableArray<T | V>;
		set(index: number, value: T): ImmutableArray<T>;
		set(index: number, value: any): ImmutableArray {
			index = toIndex(index, this.length);

			const result = new ImmutableArray<T>();
			result.#addValues(0, this, 0, index);
			result.#setValue(index, value);
			result.#addValues(++index, this, index);
			return result.#finalize(this.length);
		}

		insert(index: number, ...values: any[]) {
			if (values.length === 0)
				return this;

			index = toIndex(index, this.length);

			let i: number;

			const result = new ImmutableArray<T>();
			i = result.#addValues(0, this, 0, index);
			i = result.#addValues(i, values);
			i = result.#addValues(i, this, index);
			return result.#finalize(i);
		}

		remove(start: number, end?: number) {
			const { length } = this;
			start = toIndex(start, length);
			end = end === undefined ? length : toIndex(end, length);

			if (start === 0 && end === length)
				return ImmutableArray.#empty;
			
			if (start >= end)
				return this;
				
			const result = new ImmutableArray<T>();
			result.#addValues(0, this, 0, start);
			const resultLength = result.#addValues(start, this, end);
			return result.#finalize(resultLength);
		}

		slice(start: number, end?: number) {
			const { length } = this;
			start = toIndex(start, length);
			end = end === undefined ? length : toIndex(end, length);

			if (start === 0 && end === length)
				return this;

			if (start >= end)
				return ImmutableArray.#empty;

			const result = new ImmutableArray<T>();
			const resultLength = result.#addValues(0, this, start, end);
			return result.#finalize(resultLength);
		}

		reverse() {
			if (this.length == 0)
				return this;

			const other = new ImmutableArray<T>();
			for (let i = 0, j = this.length; j > 0; i++)
				other.#setValue(i, this[--j]);
			
			return other.#finalize(this.length);
		}

		sort(comparefn?: (a: T, b: T) => number): ImmutableArray<T> {
			if (this.length == 0)
				return this;

			const values = Array.prototype.sort.call(this, comparefn);
			return ImmutableArray.from(values);
		}
	}

	function copy<V, const K extends (keyof V)[]>(src: V, dst: any, ...keys: K) {
		for (const key of keys)
			Object.defineProperty(dst, key, Object.getOwnPropertyDescriptor(src, key)!);
	}

	copy(Array.prototype, ImmutableArray.prototype, Symbol.iterator, "at", "toString", "toLocaleString", "join", "indexOf", "lastIndexOf", "includes", "forEach", "find", "findIndex", "findLast", "findLastIndex", "reduce", "reduceRight");
}

export interface ImmutableArray<T = any> extends ArrayLike<T>, Iterable<T> {
	[Symbol.iterator](): IterableIterator<T>;

	at(index: number): T | undefined;

	add<V>(...values: V[]): ImmutableArray<T | V>;
	add(...values: T[]): ImmutableArray<T>;

	set<V>(index: number, value: V): ImmutableArray<T | V>;
	set(index: number, value: T): ImmutableArray<T>;

	insert<V>(index: number, ...values: V[]): ImmutableArray<T | V>;
	insert(index: number, ...values: T[]): ImmutableArray<T>;

	remove(start: number, end?: number): ImmutableArray<T>;
	slice(start: number, end?: number): ImmutableArray<T>;

	sort(comparefn?: (a: T, b: T) => number): ImmutableArray<T>;
	reverse(): ImmutableArray<T>;

	map<V>(mapping: (value: T, index: number, array: this) => V, thisArg?: any): ImmutableArray<V>;

	filter<S extends T>(predicate: (value: T, index: number, array: this) => value is S, thisArg?: any): ImmutableArray<S>;
	filter(predicate: (value: T, index: number, array: this) => unknown, thisArg?: any): ImmutableArray<T>;

	toArray(): T[]

	toString(): string;
	toLocaleString(): string;

	join(separator?: string): string;

	includes(value: T, fromIndex?: number): boolean;

	indexOf(searchElement: T, fromIndex?: number): number;
	lastIndexOf(searchElement: T, fromIndex?: number): number;

	find<S extends T>(predicate: (value: T, index: number, obj: readonly T[]) => value is S, thisArg?: any): S | undefined;
	find(predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any): T | undefined;
	findIndex(predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any): number;

	findLast<S extends T>(predicate: (value: T, index: number, obj: readonly T[]) => value is S, thisArg?: any): S | undefined;
	findLast(predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any): T | undefined;
	findLastIndex(predicate: (value: T, index: number, obj: readonly T[]) => unknown, thisArg?: any): number;

	every<S extends T>(predicate: (value: T, index: number, array: this) => value is S, thisArg?: any): this is ImmutableArray<S>;
	every(predicate: (value: T, index: number, array: this) => unknown, thisArg?: any): boolean;

	some(predicate: (value: T, index: number, array: this) => unknown, thisArg?: any): boolean;

	forEach(callbackfn: (value: T, index: number, array: this) => void, thisArg?: any): void;

	reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: this) => T): T;
	reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: this) => U, initialValue: U): U;

	reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: this) => T): T;
	reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: this) => U, initialValue: U): U;
}

interface ImmutableArrayConstructorBase extends Function {
	readonly prototype: ImmutableArray<any>;
	readonly empty: ImmutableArray<never>;
	from<T>(values: Iterable<T>): ImmutableArray<T>;
	from<T, V>(values: Iterable<T>, mapping: (value: T) => V, thisArg?: any): ImmutableArray<V>; 
}

interface ImmutableArrayConstructor extends ImmutableArrayConstructorBase {
	new<T>(...value: T[]): ImmutableArray<T>;
	<T>(...value: T[]): ImmutableArray<T>;
}

export const ImmutableArray: ImmutableArrayConstructor = <any>new Proxy(impl.ImmutableArray as ImmutableArrayConstructorBase, {
	apply(target, _, argArray) {
		return target.from(argArray);
	},
	construct(target, argArray) {
		return target.from(argArray);
	}
});

export default ImmutableArray;