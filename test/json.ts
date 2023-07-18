import json from "../src/json.js";

function conversionTestCommon<T extends json.JsonToken>(value: json.JsonToken, clazz: Constructor<T>, type: keyof json.JsonTokenTypeMap, subtype: keyof json.JsonTokenSubTypeMap): asserts value is T {
	it(`Return value of json() when called with a ${type} should return an instance of ${clazz.name}`, () => expect(value).instanceOf(clazz));
	it(`Should have the correct type`, () => expect(value.type).eq(type));
	it(`Should have the correct subtype`, () => expect(value.subtype).eq(subtype));
	it(`Should return true when calling is("${type}")`, () => expect(value.is(type)).to.be.true);
	it(`Should return true when calling is("${subtype}")`, () => expect(value.is(subtype)).to.be.true);
}

function conversionTestValue(value: json.JsonValue, expected: any) {
	it("JsonValue.value should be the value passed into json()", () => expect(value.value).eq(expected));
	it("JsonValue.proxy should be the value passed into json()", () => expect(value.proxy).eq(expected));
	it("JsonValue.toJSON() should return the value passed into json()", () => expect(value.toJSON()).eq(expected));
	it("JsonValue.toString() should return the stringified value passed into json()", () => expect(value.toString()).eq(JSON.stringify(expected)));
}

describe("JSON", () => {
	describe("json()", () => {
		describe("JsonValue: string", () => {
			const prop = json("text");
			const { value } = prop;
			
			conversionTestCommon(value, json.JsonValue, "value", "string");
			conversionTestValue(value, "text");
		});

		describe("JsonValue: number", () => {
			const prop = json(5);
			const { value } = prop;

			conversionTestCommon(value, json.JsonValue, "value", "number");
			conversionTestValue(value, 5);
		});
		
		describe("JsonValue: boolean", () => {
			const prop = json(true);
			const { value } = prop;

			conversionTestCommon(value, json.JsonValue, "value", "boolean");
			conversionTestValue(value, true);
		});
		
		describe("JsonValue: null", () => {
			const prop = json(null);
			const { value } = prop;

			conversionTestCommon(value, json.JsonValue, "value", "null");
			conversionTestValue(value, null);
		});
	});
})