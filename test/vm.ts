import Script from "../src/vm.js";

describe("vm", () => {
	function constDef(value: any) {
		return { value, writable: false, configurable: false }
	}

	function createContext() {
		return Object.create(null, {
			"undefined": constDef(undefined),
			"NaN": constDef(NaN),
			"Infinity": constDef(Infinity),
		});
	}

	function evalTest(scriptText: string, expected: any, context?: any) {
		const script = new Script(scriptText);
		const ctx = createContext();
		if (context)
			Object.setPrototypeOf(ctx, context);

		const result = script.runInNewContext(ctx);
		expect(result).is.deep.eq(expected);
	}

	function serialize(v: any) {
		if (v === null)
			return "null";

		switch (typeof v) {
			case "object":
				return Array.isArray(v) ? JSON.stringify(v) : `(${JSON.stringify(v)})`;
			case "function":
				return `(${v})`;
			case "bigint":
				return v >= 0 ? `${v}n` : `(${v}n)`;
			case "number":
				return v >= 0 ? String(v) : `(${v})`;
			default:
				return JSON.stringify(v);
		}
	}

	type BinaryOpTest = [x: any, y: any, result: any, reverseResult?: any];

	function evalBinOp(operator: string, left: string, right: string, expected: any) {
		const code = `${left} ${operator} ${right}`;
		it(`Expression ${code} should evaluate to ${serialize(expected)}`, () => evalTest(code, expected));
	}

	function binaryOpTests(operator: string, values: BinaryOpTest[]) {
		describe(operator, () => {
			for (const test of values) {
				const [x, y, expected] = test;
				const expectedFlipped = test.length === 3 ? expected : test[3];
				const left = serialize(x);
				const right = serialize(y);
				evalBinOp(operator, left, right, expected);
				evalBinOp(operator, right, left, expectedFlipped);
			}
		});
	}

	describe("Equality Operators", () => {
		type EqualityTest = [x: any, y: any, equal: boolean, looselyEqual?: boolean];

		function addValues(...tests: EqualityTest[]) {
			const values = {
				"==": [],
				"===": [],
				"!=": [],
				"!==": []
			};

			for (const [x, y, equal, looselyEqual = equal] of tests) {
				const left = serialize(x);
				const right = serialize(y);
				values["=="].push([left, right, looselyEqual]);
				values["==="].push([left, right, equal]);
				values["!="].push([left, right, !looselyEqual]);
				values["!=="].push([left, right, !equal]);
			}

			for (const key in values) {
				const array = values[key];
				describe(key, () => {
					for (const [left, right, expected] of array)
						evalBinOp(key, left, right, expected);
				});
			}
		}

		addValues(
			[true, true, true],
			[false, false, true],
			[true, false, false],
			[true, "true", false],
			[false, "false", false],
			[true, "1", false, true],
			[false, "0", false, true],
			[false, "", false, true],
			[false, 0, false, true],
			[false, 1, false],
			[true, 0, false],
			[true, 1, false, true],
			[5, 0, false],
			[0, 0, true],
			[5, 5, true],
			[0, "5", false],
			[0, "0", false, true],
			[5, "5", false, true],
			["a", "b", false],
			["a", "a", true],
			[5n, 0n, false],
			[5n, 5n, true],
			[5n, 5, false, true],
			["[object Object]", {}, false, true]
		)
	});

	describe("Binary Operators", () => {
		binaryOpTests("+", [
			[1, 2, 3],
			[1, -2, -1],
			[10, "2", "102", "210"],
			["left", "right", "leftright", "rightleft"],
			[0, false, 0],
			[0, true, 1],
			[0.1, 0.2, 0.30000000000000004],
			[7n, 2n, 9n],
			[-7n, 2n, -5n]
		]);

		binaryOpTests("-", [
			[1, 2, -1, 1],
			[1, -2, 3, -3],
			[10, "2", 8, -8],
			["left", "right", NaN],
			[0, false, 0],
			[0, true, -1, 1],
			[0.1, 0.2, -0.1, 0.1],
			[7n, 2n, 5n, -5n],
			[-7n, 2n, -9n, 9n]
		]);

		binaryOpTests("*", [
			[1, 2, 2],
			[1, -2, -2],
			[10, "2", 20],
			["left", "right", NaN],
			[0, false, 0],
			[0, true, 0],
			[0.1, 0.2, 0.020000000000000004],
			[7n, 2n, 14n],
			[-7n, 2n, -14n]
		]);

		binaryOpTests("/", [
			[1, 2, 0.5, 2],
			[1, -2, -0.5, -2],
			[10, "2", 5, 0.2],
			["left", "right", NaN],
			[0, false, NaN],
			[0, true, 0, Infinity],
			[0.1, 0.2, 0.5, 2],
			[7n, 2n, 3n, 0n],
			[-7n, 2n, -3n, 0n]
		]);

		binaryOpTests("%", [
			[1, 2, 1, 0],
			[1, -2, 1, -0],
			[10, "2", 0, 2],
			["left", "right", NaN],
			[0, false, NaN],
			[0, true, 0, NaN],
			[0.1, 0.2, 0.1, 0],
			[7n, 2n, 1n, 2n],
			[-7n, 2n, -1n, 2n]
		]);

		binaryOpTests("**", [
			[1, 2, 1, 2],
			[1, -2, 1, -2],
			[10, "2", 100, 1024],
			["left", "right", NaN],
			[0, false, 1],
			[0, true, 0, 1],
			[0.1, 0.2, 0.6309573444801932, 0.8513399225207846],
			[7n, 2n, 49n, 128n]
		]);
	});

	describe("Logical Operators", () => {
		binaryOpTests("&&", [
			[true, true, true],
			[true, false, false],
			[false, false, false],
			[true, {}, {}, true],
			[true, "", ""],
			[true, 0, 0],
			[true, 5, 5, true],
			[true, 0n, 0n],
			[true, 5n, 5n, true],
			[true, undefined, undefined],
			[true, null, null],
			[true, "test", "test", true],
			[false, {}, false],
			[false, "", false, ""],
			[false, 0, false, 0],
			[false, 5, false],
			[false, 0n, false, 0n],
			[false, 5n, false],
			[false, undefined, false, undefined],
			[false, null, false, null],
			[false, "test", false]
		]);

		binaryOpTests("||", [
			[true, true, true],
			[true, false, true],
			[false, false, false],
			[true, {}, true, {}],
			[true, "", true],
			[true, 0, true],
			[true, 5, true, 5],
			[true, 0n, true],
			[true, 5n, true, 5n],
			[true, undefined, true],
			[true, null, true],
			[true, "test", true, "test"],
			[false, {}, {}],
			[false, "", "", false],
			[false, 0, 0, false],
			[false, 5, 5],
			[false, 0n, 0n, false],
			[false, 5n, 5n],
			[false, undefined, undefined, false],
			[false, null, null, false],
			[false, "test", "test"]
		]);

		binaryOpTests("??", [
			[true, true, true],
			[true, false, true, false],
			[false, false, false],
			[true, {}, true, {}],
			[true, "", true, ""],
			[true, 0, true, 0],
			[true, 5, true, 5],
			[true, 0n, true, 0n],
			[true, 5n, true, 5n],
			[true, undefined, true],
			[true, null, true],
			[true, "test", true, "test"],
			[false, {}, false, {}],
			[false, "", false, ""],
			[false, 0, false, 0],
			[false, 5, false, 5],
			[false, 0n, false, 0n],
			[false, 5n, false, 5n],
			[false, undefined, false],
			[false, null, false],
			[false, "test", false, "test"]
		]);
	})

	describe("Unary operators", () => {
		type UnaryOpTest = [value: any, expected: any];
		
		function evalUnaryOp(operator: string, value: any, expected: any) {
			const code = `${operator}${operator.length === 1 ? "" : " "}${value}`;
			it(`Expression ${code} should evaluate to ${serialize(expected)}`, () => evalTest(code, expected));
		}
	
		function unaryOpTests(operator: string, values: UnaryOpTest[]) {
			describe(operator, () => {
				for (const [value, expected] of values)
					evalUnaryOp(operator, serialize(value), expected);
			});
		}

		unaryOpTests("!", [
			[true, false],
			[false, true],
			[0, true],
			[1, false],
			[0n, true],
			[1n, false],
			["", true],
			["test", false],
			["5", false],
			[{}, false],
			[[], false],
			[() => undefined, false]
		]);

		unaryOpTests("+", [
			[true, 1],
			[false, 0],
			[0, 0],
			[1, 1],
			// [0n, 0n],
			// [1n, 1n],
			["", 0],
			["test", NaN],
			["5", 5],
			[NaN, NaN],
			[undefined, NaN],
			[null, 0],
			[{}, NaN],
			[[], 0],
			[() => undefined, NaN]
		]);

		unaryOpTests("-", [
			[true, -1],
			[false, -0],
			[0, -0],
			[1, -1],
			[0n, 0n],
			[1n, -1n],
			["", -0],
			["test", NaN],
			["5", -5],
			[NaN, NaN],
			[undefined, NaN],
			[null, -0],
			[{}, NaN],
			[[], -0],
			[() => undefined, NaN]
		]);

		unaryOpTests("~", [
			[true, -2],
			[false, -1],
			[0, -1],
			[1, -2],
			[0n, -1n],
			[1n, -2n],
			["", -1],
			["test", -1],
			["5", -6],
			[NaN, -1],
			[undefined, -1],
			[null, -1],
			[{}, -1],
			[[], -1],
			[() => undefined, -1]
		]);

		unaryOpTests("void", [
			[true, undefined],
			[false, undefined],
			[0, undefined],
			[1, undefined],
			[0n, undefined],
			[1n, undefined],
			["", undefined],
			["test", undefined],
			["5", undefined],
			[NaN, undefined],
			[undefined, undefined],
			[null, undefined],
			[{}, undefined],
			[[], undefined],
			[() => undefined, undefined]
		]);

		unaryOpTests("typeof", [
			[true, "boolean"],
			[false, "boolean"],
			[0, "number"],
			[1, "number"],
			[0n, "bigint"],
			[1n, "bigint"],
			["", "string"],
			["test", "string"],
			["5", "string"],
			[NaN, "number"],
			[undefined, "undefined"],
			[null, "object"],
			[{}, "object"],
			[[], "object"],
			[() => undefined, "function"]
		]);
	});

	describe("Chaining", () => {
		it("Should return the correct value when using optional chaining", () => {
			evalTest("value?.nested?.text", undefined, { value: undefined });
			evalTest("value?.nested?.text", undefined, { value: {} })
			evalTest("value?.nested?.text", undefined, { value: { nested: null } })
			evalTest("value?.['nested']?.text", undefined, { value: { nested: null } })
			evalTest("value?.nested?.text", "text", { value: { nested: { text: "text" } } });
			evalTest("value?.['nested']?.text", "text", { value: { nested: { text: "text" } } });

			evalTest("value?.()", undefined, { value: undefined });
			evalTest("value?.()", true, { value: () => true });
		});
	})

	describe("Lambdas", () => {
		type FunctionTest = { expected: any, params?: any[] };

		function funcTests(def: string, tests: FunctionTest[]) {
			describe(`Function: ${JSON.stringify(def)}`, () => {
				let fn: Function;
	
				// Parse the function before running the tests
				before(() => {
					const script = new Script(def);
					fn = script.runInNewContext(globalThis);
				});
	
				for (const { expected, params = [] } of tests) {
					it(`Should return ${JSON.stringify(expected)} for parameters (${params.map(v => JSON.stringify(v)).join(", ")})`, () => {
						const result = fn.apply(undefined, params);
						expect(result).is.deep.eq(expected);
					});
				}
			});
		}

		// Test a lambda with 2 parameters
		funcTests("(a, b) => a + b", [
			{ expected: 11, params: [5, 6] },
			{ expected: "leftright", params: ["left", "right"] }
		]);
	
		// Test a lambda with a default parameter
		funcTests("(a = 5) => a", [
			{ expected: 5, params: [5] },
			{ expected: null, params: [null] },
			{ expected: true, params: [true] }
		]);
	
		// Test a lambda with destructuring and default values in an array
		funcTests("([v1, v2, v3 = 5] = []) => v1 + v2 + v3", [
			{ expected: NaN },
			{ expected: NaN, params: [[]] },
			{ expected: 8, params: [[1, 2]] },
			{ expected: 20, params: [[5, 5, 10]] }
		]);
	
		// Test a lambda with destructuring and default values in an object
		funcTests("({ v1, v2, v3 = 5 } = {}) => v1 + v2 + v3", [
			{ expected: NaN },
			{ expected: 23, params: [{ v1: 12, v2: 6 }] },
			{ expected: 100, params: [{ v1: 56, v2: 93, v3: -49 }] }
		]);

		// Test a lambda with computed property names and symbols in an object
		funcTests("({ ['long property name']: x, [Symbol.iterator]: y } = {}) => [x, y]", [
			{ expected: [undefined, undefined] },
			{ expected: [undefined, Array.prototype[Symbol.iterator]], params: [[]] },
			{ expected: [5, undefined], params: [{ ["long property name"]: 5 }] }
		]);
	});
})