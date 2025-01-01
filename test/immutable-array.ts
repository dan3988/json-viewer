import ImmutableArray from "../src/immutable-array.js";

Array.prototype.with || Object.defineProperty(Array.prototype, "with", {
	configurable: true,
	writable: true,
	value(index, value) {
		const copy = Array.from(this);
		if (index < 0)
			index = this.length + index;
	
		copy[index] = value;
		return copy;
	}
});

function testInstance<T>(value: ImmutableArray<T>, expected: Iterable<T>, msg?: string) {
	const arr = makeObjectArray(expected);
	assert.strictEqual(value.length, arr.length, (msg && msg + ": ") || "" + `expected length to be ${arr.length}`);
	assert.deepStrictEqual<Iterable<T>>(value, arr, msg && msg + `: expected result to be [${Array.prototype.toString.call(expected)}]`);
	assert.isFrozen(value, msg && msg + ': expected result to be sealed');
}

function assertReturnsSelf<T, K extends string & keyof typeof ImmutableArray>(arr: ImmutableArray<T>, key: K, ...args: typeof ImmutableArray[K] extends (array: ImmutableArray<T>, ...args: infer A) => any ? A : never): typeof ImmutableArray[K] extends (...args: any[]) => infer R ? R : never {
	const fn = ImmutableArray[key] as Function;
	const result = Reflect.apply(fn, undefined, [ arr, ...args ]);
	assert.strictEqual(result, arr, `expected ${key}(${args}) to return the same instance`);
	return result;
}

function assertReturnsEmpty<T, K extends string & keyof typeof ImmutableArray>(arr: ImmutableArray<T>, key: K, ...args: typeof ImmutableArray[K] extends (array: ImmutableArray<T>, ...args: infer A) => any ? A : never): typeof ImmutableArray[K] extends (...args: any[]) => infer R ? R : never {
	const fn = ImmutableArray[key] as Function;
	const result = Reflect.apply(fn, undefined, [ arr, ...args ]);
	assert.strictEqual(result, ImmutableArray.empty, `expected ${key}(${args}) to return ImmutableArray.empty`);
	return result;
}

/** create an array-like object that returns `false` when calling `Array.isArray` for passing into `assert.deepEqual`. */
function makeObjectArray<T>(values: Iterable<T>): Iterable<T> & ArrayLike<T> {
	if (Array.isArray(values))
		return values;

	const obj: T[] = Object.create(Array.prototype, {
		length: {
			writable: true,
			value: 0
		}
	});

	for (const value of values)
		obj.push(value);

	return obj;
}

function* generateSequence(start: number, count: number, step: number = 1) {
	for (; --count >= 0; start += step)
		yield start;
}

const sequence = [...generateSequence(1, 10)];

describe("ImmutableArray", () => {
	it("Should copy value when creating instance from array", () => {
		testInstance(ImmutableArray(...sequence), sequence);
		testInstance(ImmutableArray.from(sequence), sequence);
		testInstance(ImmutableArray.from(sequence, v => v * 5), sequence.map(v => v * 5));
	});

	it("Should copy value when creating instance from iterable", () => {
		const create = () => generateSequence(0, 20, 5);
		const sequence = [...create()];
		testInstance(ImmutableArray.from(create()), sequence);
		testInstance(ImmutableArray.from(create(), v => v * 5), sequence.map(v => v * 5));
	});

	it("Should have the correct value for ImmutableArray.empty", () => {
		testInstance(ImmutableArray.empty, []);
	});

	it("Should return ImmutableArray.empty when creating from an empty array", () => {
		assert.strictEqual(ImmutableArray.empty, ImmutableArray.from([]));
		assert.strictEqual(ImmutableArray.empty, ImmutableArray());
		assert.deepEqual(ImmutableArray.empty, []);
	});

	it("Should return correct values when calling set()", () => {
		const value = ImmutableArray.from<any>(sequence);
		testInstance(ImmutableArray.set(value, 0, 'start'), sequence.with(0, 'start'));
		testInstance(ImmutableArray.set(value, -1, 'end'), sequence.with(-1, 'end'));
	});

	it("Should return correct values when calling add()", () => {
		const value = ImmutableArray.from(sequence);
		const modded = ImmutableArray.append(value, 'value1', 'value2', 'value3');
		testInstance(modded, sequence.concat('value1', 'value2', 'value3'));
	});

	it("Should return correct values when calling insert()", () => {
		const value = ImmutableArray.from(sequence);
		const modded = ImmutableArray.insert(value, 1, 'value1', 'value2', 'value3');
		const expected = Array.from<string | number>(sequence);
		expected.splice(1, 0, 'value1', 'value2', 'value3')
		testInstance(modded, expected);
	});

	it("Should return correct values when calling remove()", () => {
		function test(start: number, end?: number) {
			const expected = Array.from(sequence);
			expected.splice(start, (end === undefined ? sequence.length : (end < 0 ? sequence.length + end : end)) - start);

			let msg = `expected ImmutableArray(${sequence}).remove(${start}`;
			if (end !== undefined)
				msg += `, ${end}`;

			msg += `) to return ${expected}`;

			testInstance(ImmutableArray.remove(sequence, start, end), expected, msg);
		}

		test(5, 6);
		test(5, -6);
		test(0);
		test(1);
		test(-1);
		test(NaN, NaN);
		test(5, 4);

		assertReturnsEmpty(ImmutableArray.from(sequence), "remove", 0, 10);
		assertReturnsEmpty(ImmutableArray.from(sequence), "remove", -10, 10);
		assertReturnsSelf(ImmutableArray.from(sequence), "remove", 0, 0);
		assertReturnsSelf(ImmutableArray.from(sequence), "remove", 10, 0);
	});

	it("Should return correct values when calling slice()", () => {
		function test(start: number, end?: number) {
			const expected = Array.from(sequence).slice(start, end);

			let msg = `expected ImmutableArray(${sequence}).remove(${start}`;
			if (end !== undefined)
				msg += `, ${end}`;

			msg += `) to return ${expected}`;

			testInstance(ImmutableArray.slice(sequence, start, end), expected, msg);
		}

		test(5, 6);
		test(5, -6);
		test(0);
		test(1);
		test(-1);
		test(NaN, NaN);
		test(5, 4);

		assertReturnsSelf(ImmutableArray.from(sequence), "slice", 0, 10);
		assertReturnsSelf(ImmutableArray.from(sequence), "slice", -10, 10);
		assertReturnsEmpty(ImmutableArray.from(sequence), "slice", 0, 0);
		assertReturnsEmpty(ImmutableArray.from(sequence), "slice", 10, 0);
	});

	it("Should return correct values when calling splice()", () => {
		function test(start: number, deleteCount?: number, ...values: any[]) {
			const expected = Array.from(sequence);

			let msg = `expected ImmutableArray(${sequence}).splice(${start}`;
			if (deleteCount === undefined) {
				expected.splice(start);
			} else {
				expected.splice(start, deleteCount, ...values);
				msg += `, ${deleteCount}`;

				if (values.length)
					msg += `, ${values}`;
			}

			msg += `) to return ${expected}`;

			testInstance(ImmutableArray.splice(sequence, start, deleteCount, ...values), expected, msg);
		}

		test(5, 5);
		test(5, -5);
		test(0, 0, 'a', 'b', 'c');
		test(5, 0, 'a', 'b', 'c');
		test(0, 10, 'a', 'b', 'c');
		test(1);
		test(-1);
		test(NaN, NaN);
		test(5, 4);

		assertReturnsSelf(ImmutableArray.from(sequence), "splice", 0, 0);
		assertReturnsSelf(ImmutableArray.from(sequence), "splice", -10, 0);
		assertReturnsEmpty(ImmutableArray.from(sequence), "splice", 0, 10);
		assertReturnsEmpty(ImmutableArray.from(sequence), "splice", -10, Infinity);
	});

	it("Should return correct values when calling filter()", () => {
		const value = ImmutableArray.from([0, "0", false, 1, "1", true, 2n, "test", null, { test: 1 }]);
		testInstance(ImmutableArray.filter(value, v => typeof v === "number"), [0, 1]);
		testInstance(ImmutableArray.filter(value, v => typeof v === "string"), ["0", "1", "test"]);
		testInstance(ImmutableArray.filter(value, v => typeof v === "boolean"), [false, true]);
		testInstance(ImmutableArray.filter(value, v => typeof v === "object"), [null, { test: 1 }]);
	});

	it("Should return correct value for toString()", () => {
		const value = ImmutableArray.from([1, "2", true, undefined, {}]);
		assert.strictEqual(value.toString(), "1,2,true,,[object Object]");
	});

	it("Should return correct value for join()", () => {
		const value = ImmutableArray.from([1, "2", true, undefined, {}]);
		assert.strictEqual(value.join(), "1,2,true,,[object Object]");
		assert.strictEqual(value.join(""), "12true[object Object]");
		assert.strictEqual(value.join(" "), "1 2 true  [object Object]");
	});

	it("Should return correct value for includes()", () => {
		function test(expected: boolean, value: any, start?: number) {
			let msg = `expected collecton [${values}] to ${expected ? '' : 'not '}contain ${value}`;
			if (start != null)
				msg += ` with start index ${start}`

			assert.strictEqual(values.includes(value, start), expected, msg);
		}

		const values = ImmutableArray.from(sequence);
		test(true, 1);
		test(true, 10);
		test(true, 5);
		test(true, 5, 4);
		test(false, 5, 5);
		test(false, 1, 1);
		test(false, 0);
	});

	it("Should return correct value for find() and findIndex()", () => {
		function test(expectedIndex: null | number, test: (v: any) => boolean) {
			const [index, value] = expectedIndex == null ? [-1, undefined] : [expectedIndex, values[expectedIndex]];
			assert.strictEqual(values.find(test), value, `expected find() to return ${value} for function {${test}} on collecton [${values}]`);
			assert.strictEqual(values.findIndex(test), index, `expected findIndex() to return ${index} for function {${test}} on collecton [${values}]`);
		}

		const values = ImmutableArray.from(sequence);

		test(0, v => v > 0);
		test(null, v => v < 0);
		test(1, v => v == 2);
		test(2, v => v > 2);
		test(0, v => v < 7);
		test(3, v => (v % 4 === 0));
		test(null, v => !v);
	});

	it("Should return correct value for findLast() and findLastIndex()", () => {
		function test(expectedIndex: null | number, test: (v: any) => boolean) {
			const [index, value] = expectedIndex == null ? [-1, undefined] : [expectedIndex, values[expectedIndex]];
			assert.strictEqual(values.findLast(test), value, `expected findLast() to return ${value} for function {${test}} on collecton [${values}]`);
			assert.strictEqual(values.findLastIndex(test), index, `expected findLastIndex() to return ${index} for function {${test}} on collecton [${values}]`);
		}

		const values = ImmutableArray.from(sequence);

		test(9, v => v > 0);
		test(null, v => v < 0);
		test(1, v => v == 2);
		test(9, v => v > 2);
		test(5, v => v < 7);
		test(7, v => (v % 4 === 0));
		test(null, v => !v);
	});

	it("Should call the forEach() callback the with the correct values ", () => {
		const values = ImmutableArray.from(sequence);

		let count = 0;

		values.forEach((value, index, array) => {
			assert.strictEqual(array, values);
			assert.strictEqual(value, values[index]);
			assert.strictEqual(index, count);
			count++;
		});

		const arr = [];
		values.forEach(function(value) {
			Array.prototype.push.call(this, value);
		}, arr);

		assert.deepStrictEqual(arr, sequence);
	});

	it("Should return the correct value for reverse()", () => {
		function test(...values: any[]) {
			const arr = ImmutableArray.from(values);
			testInstance(ImmutableArray.reverse(arr), values.reverse());
		}

		test(...sequence);
		test(true, false, true, false, true, false);
	});
})