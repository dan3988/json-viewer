import Linq from "@daniel.pickett/linq-js";
import json from "../src/json.js";

function conversionTestCommon<T extends json.JsonToken>(value: json.JsonToken, clazz: Constructor<T>, type: keyof json.JsonTokenTypeMap, subtype: keyof json.JsonTokenSubTypeMap): asserts value is T {
	it(`Returns an instance of ${clazz.name} when calling json() with a ${type}`, () => expect(value).instanceOf(clazz));
	it(`Has the correct type`, () => expect(value.type).eq(type));
	it(`Has the correct subtype`, () => expect(value.subtype).eq(subtype));
	it(`Returns true when calling is("${type}")`, () => expect(value.is(type)).to.be.true);
	it(`Returns true when calling is("${subtype}")`, () => expect(value.is(subtype)).to.be.true);
}

function conversionTestValue(value: json.JsonToken, subtype: keyof json.JsonTokenSubTypeMap, expected: any): asserts value is json.JsonValue {
	conversionTestCommon(value, json.JsonValue, "value", subtype);
	it(`Has a value equal to the parameter passed into json() for the property "value"`, () => expect(value.value).eq(expected));
	it(`Has a value equal to the parameter passed into json() for the property "proxy"`, () => expect(value.proxy).eq(expected));
	it(`Returns a value equal to the parameter passed into json() when calling toJSON()`, () => expect(value.toJSON()).eq(expected));
	it(`Returns a value equal to the stringified parameter passed into json() when calling toString()`, () => expect(value.toString()).eq(JSON.stringify(expected)));
}

function conversionTestContainer<T extends json.JsonContainer>(value: json.JsonToken, clazz: Constructor<T>, subtype: keyof json.JsonTokenSubTypeMap, expected: any): asserts value is T {
	conversionTestCommon(value, clazz, "container", subtype);
	it("Returns a value that is deeply equal to the value passed into json() when calling toJSON()", () => expect(value.toJSON()).deep.eq(expected));
	it("Returns the stringified value passed into json() when calling toString()", () => expect(value.toString()).eq(JSON.stringify(expected)));
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