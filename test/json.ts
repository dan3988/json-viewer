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
	it("Has a valid linked structure", () => testLinks(value));
}

function testLinks(value: json.JsonContainer) {
	if (value.count === 0) {
		expect(value.first).null("\"first\" should be null on an empty container");
		expect(value.last).null("\"last\" should be null on an empty container");
	} else if (value.count === 1) {
		expect(value.first).eq(value.last, "\"first\" should be equal to \"last\" on a container with one property");
		expect(value.first.previous).null("property should have no siblings on a container with one property");
		expect(value.first.next).null("property should have no siblings on a container with one property");
	} else {
		let last: json.JsonProperty | null = null;
		let current = value.first;
		let count = 0;
		do {
			expect(current.parent).eq(value, "child property's parent does not match");
			expect(current.previous).eq(last, "property's previous sibling does not match");
			expect(value.getProperty(current.key)).eq(current, "getProperty() returned the wrong value");

			count++;
			last = current;
			current = last.next;
		} while (current != null)

		expect(value.last).eq(last, "containers last property does not match actual last property")
		expect(value.count).eq(count, "containers property count does not match");
	}
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