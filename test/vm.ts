import Script from "../src/vm.js";

describe("vm", () => {
	function evalTest(scriptText: string, expected: any) {
		const script = new Script(scriptText);
		const result = script.runInNewContext(undefined);
		expect(result).is.deep.eq(expected);
	}

	function serialize(v: any) {
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

	describe("Binary Operators", () => {
		type BinaryOpTest = [x: any, y: any, result: any, reverseResult?: any];

		function evalBinOp(operator: string, left: string, right: string, expected: any) {
			const code = `${left} ${operator} ${right}`;
			it(`Should evaluate ${JSON.stringify(code)} correctly`, () => evalTest(code, expected));
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

		// const values = [0, 1, 675, 0.1, 0.2, -1, -675, -0.1, -0.2, NaN, "", "5", "text", true, false, [], {}] as const;
		// const bigints = [0n, 1n, -1n, 55n, 0xffffffffn, -0xffffffffn] as const;
		// const both = [...values, ...bigints] as const;

		// testBinaryOperator("==", both);
		// testBinaryOperator("===", both);
		// testBinaryOperator("!=", both);
		// testBinaryOperator("!==", both);
		// testBinaryOperator("<", both);
		// testBinaryOperator("<=", both);
		// testBinaryOperator(">", both);
		// testBinaryOperator(">=", both);
		// testBinaryOperator("+", values, bigints);
		// testBinaryOperator("-", values, bigints);
		// testBinaryOperator("*", values, bigints);
		// testBinaryOperator("/", values, bigints);
		// testBinaryOperator("%", values, bigints);
		// testBinaryOperator("**", values, bigints);
		// testBinaryOperator("|", values, bigints);
		// testBinaryOperator("&", values, bigints);
		// testBinaryOperator("^", values, bigints);
		// testBinaryOperator("<<", values);
		// testBinaryOperator(">>", values);
		// testBinaryOperator(">>>", values);
	});

	describe("Lambdas", () => {
		type FunctionTest = [...params: any[], expect: any];

		function funcTests(def: string, tests: FunctionTest[]) {
			describe(`Function: ${JSON.stringify(def)}`, () => {
				let fn: Function;

				before(() => {
					const script = new Script(def);
					fn = script.runInNewContext(globalThis);
				});

				
				for (const test of tests) {
					const expected = test.pop();
					it(`Should return ${JSON.stringify(expected)} for parameters ${test.map(v => JSON.stringify(v)).join(", ")}`, () => {
						const result = fn.apply(undefined, test);
						expect(result).is.deep.eq(expected);
					});
				}
			})
		}

		funcTests("(a, b) => a + b", [
			[5, 6, 11],
			["left", "right", "leftright"]
		]);

		funcTests("(a = 5) => a", [
			[5],
			[null, null],
			[true, true]
		]);

		funcTests("([v1, v2, v3 = 5] = []) => v1 + v2 + v3", [
			[NaN],
			[[], NaN],
			[[1, 2], 8],
			[[5, 5, 10], 20]
		]);

		funcTests("({ v1, v2, v3 = 5 } = {}) => v1 + v2 + v3", [
			[NaN],
			[{ v1: 12, v2: 6 }, 23],
			[{ v1: 56, v2: 93, v3: -49 }, 100]
		]);

		funcTests("({ ['long property name']: x, [Symbol.iterator]: y } = {}) => [x, y]", [
			[{}, [undefined, undefined]],
			[[], [undefined, Array.prototype[Symbol.iterator]]],
			[{ ["long property name"]: 5 }, [5, undefined]]
		]);
	});
})