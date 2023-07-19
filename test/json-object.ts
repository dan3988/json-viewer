import json from "../src/json.js";
import * as r from "./json-shared.js";

describe("JObject", () => {
	describe("simple object", () => {
		const og = {
			number: 5,
			string: "text",
			boolean: true,
			null: null
		};

		const prop = json(og);
		r.conversionTestContainer(prop.value, json.JObject, "object", og);
		r.testProp(prop.value, "number", v => r.conversionTestValue(v, "number", 5));
		r.testProp(prop.value, "string", v => r.conversionTestValue(v, "string", "text"));
		r.testProp(prop.value, "boolean", v => r.conversionTestValue(v, "boolean", true));
		r.testProp(prop.value, "null", v => r.conversionTestValue(v, "null", null));
	});
	
	describe("empty object", () => r.conversionTestContainer(json({}).value, json.JObject, "object", {}));
});