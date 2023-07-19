import json from "../src/json.js";
import * as s from "./json-shared.js";

describe("JObject", () => {
	describe("simple object", () => {
		const og = {
			number: 5,
			string: "text",
			boolean: true,
			null: null
		};

		const prop = json(og);
		s.conversionTestContainer(prop.value, json.JObject, "object", og);
		s.testProp(prop.value, "number", v => s.conversionTestValue(v, "number", 5));
		s.testProp(prop.value, "string", v => s.conversionTestValue(v, "string", "text"));
		s.testProp(prop.value, "boolean", v => s.conversionTestValue(v, "boolean", true));
		s.testProp(prop.value, "null", v => s.conversionTestValue(v, "null", null));
	});
	
	describe("empty object", () => s.conversionTestContainer(json({}).value, json.JObject, "object", {}));

	describe("adding", () => {
		const root = new json.JObject();
		const jValue = root.add("jValue", "value");
		const jArray = root.add("jArray", "array");
		const jObject = root.add("jObject", "object");

		s.testLinks(root);
		s.testProp(root, "jValue", v => {
			it("Is the same as the value returned by add()", () => expect(v.owner).eq(jValue));
			s.conversionTestCommon(v, json.JValue, "value", "null");
		});

		s.testProp(root, "jArray", v => {
			it("Is the same as the value returned by add()", () => expect(v.owner).eq(jArray));
			s.conversionTestCommon(v, json.JArray, "container", "array");
		});

		s.testProp(root, "jObject", v => {
			it("Is the same as the value returned by add()", () => expect(v.owner).eq(jObject));
			s.conversionTestCommon(v, json.JObject, "container", "object");
		});
	});

	describe("replace", () => {
		const object = { a: 1, b: 2, c: 3 };

		function testReplace(key: string, value: any) {
			describe("Replace property " + JSON.stringify(key), () => {
				const { value: tkn } = json(object);
				const old = tkn.getProperty(key);
				const val = tkn.add(key, "value");
				val.value.value = value;

				const expected = { ...object };
				expected[key] = value;

				it("has removed the parent of the old property", () => expect(old.parent).to.be.null);
				s.testLinks(tkn);
				it("returns the updated value when calling toJSON()", () => expect(tkn.toJSON()).to.be.deep.equal(expected));
			});
		}
		
		testReplace("a", "replaced a");
		testReplace("b", "replaced b");
		testReplace("c", "replaced c");
	});
});