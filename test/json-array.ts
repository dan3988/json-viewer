import json from "../src/json.js";
import * as s from "./json-shared.js";

describe("JArray", () => {
	describe("simple array", () => {
		const og = Linq.range(0, 10, 5).toArray();
		const prop = json(og);
		s.conversionTestContainer(prop.value, json.JArray, "array", og);
		s.testProp(prop.value, 0, v => s.conversionTestValue(v, "number", 0));
		s.testProp(prop.value, 1, v => s.conversionTestValue(v, "number", 5));
		s.testProp(prop.value, 2, v => s.conversionTestValue(v, "number", 10));
		s.testProp(prop.value, 3, v => s.conversionTestValue(v, "number", 15));
		s.testProp(prop.value, 4, v => s.conversionTestValue(v, "number", 20));
		s.testProp(prop.value, 5, v => s.conversionTestValue(v, "number", 25));
		s.testProp(prop.value, 6, v => s.conversionTestValue(v, "number", 30));
		s.testProp(prop.value, 7, v => s.conversionTestValue(v, "number", 35));
		s.testProp(prop.value, 8, v => s.conversionTestValue(v, "number", 40));
		s.testProp(prop.value, 9, v => s.conversionTestValue(v, "number", 45));
	});

	describe("empty array", () => s.conversionTestContainer(json([]).value, json.JArray, "array", []));

	describe("adding", () => {
		const root = new json.JArray();
		const jValue = root.add("value");
		const jArray = root.add("array");
		const jObject = root.add("object");

		s.testLinks(root);
		s.testProp(root, 0, v => {
			it("Is the same as the value returned by add()", () => expect(v).eq(jValue));
			s.conversionTestCommon(v, json.JValue, "value", "null");
		});

		s.testProp(root, 1, v => {
			it("Is the same as the value returned by add()", () => expect(v).eq(jArray));
			s.conversionTestCommon(v, json.JArray, "container", "array");
		});

		s.testProp(root, 2, v => {
			it("Is the same as the value returned by add()", () => expect(v).eq(jObject));
			s.conversionTestCommon(v, json.JObject, "container", "object");
		});
	});
});