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
	it(`Has the correct value for the property "value"`, () => expect(value.value).eq(expected));
	it(`Has the correct value for the property "proxy"`, () => expect(value.proxy).eq(expected));
	it(`Returns the correct value when calling toJSON()`, () => expect(value.toJSON()).eq(expected));
	it(`Returns the correct text when calling toString()`, () => expect(value.toString()).eq(JSON.stringify(expected)));
}

function conversionTestContainer<T extends json.JsonContainer>(value: json.JsonToken, clazz: Constructor<T>, subtype: keyof json.JsonTokenSubTypeMap, expected: any): asserts value is T {
	conversionTestCommon(value, clazz, "container", subtype);
	it(`Has the correct value for the property "proxy"`, () => expect(value.proxy).deep.eq(expected));
	it("Returns the correct value when calling toJSON()", () => expect(value.toJSON()).deep.eq(expected));
	it("Returns the correct text when calling toString()", () => expect(value.toString()).eq(JSON.stringify(expected)));
	it("Has a valid linked structure", () => testLinks(value));
}


function testProp<T extends string | number>(parent: json.JsonContainer<T>, key: T, callback: (value: json.JsonToken) => void) {
	const prop = parent.getProperty(key);
	it(`Has the property ${JSON.stringify(key)}`, () => expect(prop, `property ${JSON.stringify(key)} was not found`).to.exist);
	const value = parent.get(key);

	it("Has the correct key", () => expect(prop.key).eq(key));
	it("Has the correct value", () => expect(prop.value).eq(value));
	
	callback(value);
};

function testLinks(value: json.JsonContainer) {
	if (value.count === 0) {
		expect(value.first, "\"first\" should be null on an empty container").null;
		expect(value.last, "\"last\" should be null on an empty container").null;
	} else if (value.count === 1) {
		expect(value.first).eq(value.last, "\"first\" should be equal to \"last\" on a container with one property");
		expect(value.first.previous, "property should have no siblings on a container with one property").null;
		expect(value.first.next, "property should have no siblings on a container with one property").null;
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
			testProp(prop.value, 0, v => conversionTestValue(v, "number", 0));
			testProp(prop.value, 1, v => conversionTestValue(v, "number", 5));
			testProp(prop.value, 2, v => conversionTestValue(v, "number", 10));
			testProp(prop.value, 3, v => conversionTestValue(v, "number", 15));
			testProp(prop.value, 4, v => conversionTestValue(v, "number", 20));
			testProp(prop.value, 5, v => conversionTestValue(v, "number", 25));
			testProp(prop.value, 6, v => conversionTestValue(v, "number", 30));
			testProp(prop.value, 7, v => conversionTestValue(v, "number", 35));
			testProp(prop.value, 8, v => conversionTestValue(v, "number", 40));
			testProp(prop.value, 9, v => conversionTestValue(v, "number", 45));
		});

		describe("JsonArray: empty", () => conversionTestContainer(json([]).value, json.JsonArray, "array", []));

		describe("JsonObject", () => {
			const og = {
				number: 5,
				string: "text",
				boolean: true,
				null: null
			};

			const prop = json(og);
			conversionTestContainer(prop.value, json.JsonObject, "object", og);
			testProp(prop.value, "number", v => conversionTestValue(v, "number", 5));
			testProp(prop.value, "string", v => conversionTestValue(v, "string", "text"));
			testProp(prop.value, "boolean", v => conversionTestValue(v, "boolean", true));
			testProp(prop.value, "null", v => conversionTestValue(v, "null", null));
		});
		
		describe("JsonObject: empty", () => conversionTestContainer(json({}).value, json.JsonObject, "object", {}));
	});
})