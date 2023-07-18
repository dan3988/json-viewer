import Linq from "@daniel.pickett/linq-js";
import json from "../src/json.js";

function conversionTestCommon<T extends json.JsonToken>(value: json.JsonToken, clazz: Constructor<T>, type: keyof json.JsonTokenTypeMap, subtype: keyof json.JsonTokenSubTypeMap): asserts value is T {
	it(`Return value of json() when called with a ${type} should return an instance of ${clazz.name}`, () => expect(value).instanceOf(clazz));
	it(`Should have the correct type`, () => expect(value.type).eq(type));
	it(`Should have the correct subtype`, () => expect(value.subtype).eq(subtype));
	it(`Should return true when calling is("${type}")`, () => expect(value.is(type)).to.be.true);
	it(`Should return true when calling is("${subtype}")`, () => expect(value.is(subtype)).to.be.true);
}

function conversionTestValue(value: json.JsonToken, subtype: keyof json.JsonTokenSubTypeMap, expected: any): asserts value is json.JsonValue {
	conversionTestCommon(value, json.JsonValue, "value", subtype);
	it("JsonValue.value should be the value passed into json()", () => expect(value.value).eq(expected));
	it("JsonValue.proxy should be the value passed into json()", () => expect(value.proxy).eq(expected));
	it("JsonValue.toJSON() should return the value passed into json()", () => expect(value.toJSON()).eq(expected));
	it("JsonValue.toString() should return the stringified value passed into json()", () => expect(value.toString()).eq(JSON.stringify(expected)));
}

function conversionTestContainer<T extends json.JsonContainer>(value: json.JsonToken, clazz: Constructor<T>, subtype: keyof json.JsonTokenSubTypeMap, expected: any): asserts value is T {
	conversionTestCommon(value, clazz, "container", subtype);
	it(clazz.name + ".toJSON() should be deeply equal to the value passed into json()", () => expect(value.toJSON()).deep.eq(expected));
	it(clazz.name + ".toString() should return the stringified value passed into json()", () => expect(value.toString()).eq(JSON.stringify(expected)));
}

describe("JSON", () => {
	describe("json()", () => {
		describe("JsonValue: string", () => {
			const prop = json("text");
			conversionTestValue(prop.value, "string", "text");
		});

		describe("JsonValue: number", () => {
			const prop = json(5);
			conversionTestValue(prop.value, "number", 5);
		});
		
		describe("JsonValue: boolean", () => {
			const prop = json(true);
			conversionTestValue(prop.value, "boolean", true);
		});
		
		describe("JsonValue: null", () => {
			const prop = json(null);
			conversionTestValue(prop.value, "null", null);
		});

		describe("JsonArray", () => {
			const og = Linq.range(0, 10, 5).toArray();
			const prop = json(og);
			conversionTestContainer(prop.value, json.JsonArray, "array", og);
		});

		describe("JsonObject", () => {
			const og = {
				number: 5,
				string: "text",
				boolean: true,
				null: null
			};

			const prop = json(og);
			conversionTestContainer(prop.value, json.JsonObject, "object", og);
		});
	});
})