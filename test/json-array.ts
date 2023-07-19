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

});