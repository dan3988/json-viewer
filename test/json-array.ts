import json from "../src/json.js";
import helpers from "./helpers.js";
import * as s from "./json-shared.js";

describe("JArray", () => {
	describe("simple array", () => {
		const og = Linq.range(0, 10, 5).toArray();
		const prop = json(og);
		s.conversionTestArray(prop, og);
		s.testProp(prop, 0, v => s.conversionTestValue(v, "number", 0));
		s.testProp(prop, 1, v => s.conversionTestValue(v, "number", 5));
		s.testProp(prop, 2, v => s.conversionTestValue(v, "number", 10));
		s.testProp(prop, 3, v => s.conversionTestValue(v, "number", 15));
		s.testProp(prop, 4, v => s.conversionTestValue(v, "number", 20));
		s.testProp(prop, 5, v => s.conversionTestValue(v, "number", 25));
		s.testProp(prop, 6, v => s.conversionTestValue(v, "number", 30));
		s.testProp(prop, 7, v => s.conversionTestValue(v, "number", 35));
		s.testProp(prop, 8, v => s.conversionTestValue(v, "number", 40));
		s.testProp(prop, 9, v => s.conversionTestValue(v, "number", 45));
	});

	describe("empty array", () => s.conversionTestArray(json([]), []));

	describe("adding", () => {
		const root = new json.Array();
		const jValue = helpers.array.addValue(root, null);
		const jArray = helpers.array.addArray(root);
		const jObject = helpers.array.addObject(root);

		s.testLinks(root);
		s.testProp(root, 0, v => {
			it("Is the same as the value passed to add()", () => expect(v).eq(jValue));
			s.conversionTestValue(v, "null", null);
		});

		s.testProp(root, 1, v => {
			it("Is the same as the value passed to add()", () => expect(v).eq(jArray));
			s.conversionTestArray(v, []);
		});

		s.testProp(root, 2, v => {
			it("Is the same as the value passed to add add()", () => expect(v).eq(jObject));
			s.conversionTestObject(v, {});
		});

		const gap = json('test');
		root.add(gap, 10);

		s.testLinks(root);
		s.testProp(root, 10, v => {
			it("Is the same as the value passed to add()", () => expect(v).eq(gap));
		});

		it("Has added null values bewteen the last property and the added property", () => {
			expect(root.count).to.be.eq(11);
			for (let i = 3; i < 10; i++)
				expect(root.get(i).value).to.be.eq(null);
		});
	});
});