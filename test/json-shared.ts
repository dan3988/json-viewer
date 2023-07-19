import json from "../src/json.js";

const path = [];

export function conversionTestCommon<T extends json.JToken>(value: json.JToken, clazz: Constructor<T>, type: keyof json.JTokenTypeMap, subtype: keyof json.JTokenSubTypeMap): asserts value is T {
	it(`Is an instance of ${clazz.name}`, () => expect(value).instanceOf(clazz));
	it(`Has the correct type`, () => expect(value.type).eq(type));
	it(`Has the correct subtype`, () => expect(value.subtype).eq(subtype));
	it(`Returns true when calling is("${type}")`, () => expect(value.is(type)).to.be.true);
	it(`Returns true when calling is("${subtype}")`, () => expect(value.is(subtype)).to.be.true);
}

export function conversionTestValue(value: json.JToken, subtype: keyof json.JTokenSubTypeMap, expected: any): asserts value is json.JValue {
	conversionTestCommon(value, json.JValue, "value", subtype);
	it(`Has the correct value for the property "value"`, () => expect(value.value).eq(expected));
	it(`Has the correct value for the property "proxy"`, () => expect(value.proxy).eq(expected));
	it(`Returns the correct value when calling toJSON()`, () => expect(value.toJSON()).eq(expected));
	it(`Returns the correct text when calling toString()`, () => expect(value.toString()).eq(JSON.stringify(expected)));
}

export function conversionTestContainer<T extends json.JContainer>(value: json.JToken, clazz: Constructor<T>, subtype: keyof json.JTokenSubTypeMap, expected: any): asserts value is T {
	conversionTestCommon(value, clazz, "container", subtype);
	it(`Has the correct value for the property "proxy"`, () => expect(value.proxy).deep.eq(expected));
	it("Returns the correct value when calling toJSON()", () => expect(value.toJSON()).deep.eq(expected));
	it("Returns the correct text when calling toString()", () => expect(value.toString()).eq(JSON.stringify(expected)));
	testLinks(value);
}

export function testProp<T extends string | number>(parent: json.JContainer<T>, key: T, callback?: (value: json.JToken) => void) {
	path.push(key);
	let oldIt = it;
	try {
		// @ts-ignore
		it = (v, fn) => oldIt(prefix + v, fn);

		const prefix = "Property \"$/" + path.join("/") + "\": ";
		const prop = parent.getProperty(key);
		it(`Exists`, () => expect(prop, `property ${JSON.stringify(key)} was not found`).to.exist);
		const value = parent.get(key);
	
		it(`Has the correct key`, () => expect(prop.key).eq(key));
		it(`Has the correct value`, () => expect(prop.value).eq(value));
		
		callback(value);
	} finally {
		it = oldIt;
		path.pop();
	}
}

export function testLinks(value: json.JContainer) {
	it("Has a valid linked structure", () => {
		if (value.count === 0) {
			expect(value.first, "\"first\" should be null on an empty container").to.be.null;
			expect(value.last, "\"last\" should be null on an empty container").to.be.null;
		} else if (value.count === 1) {
			expect(value.first).eq(value.last, "\"first\" should be equal to \"last\" on a container with one property");
			expect(value.first.previous, "property should have no siblings on a container with one property").to.be.null;
			expect(value.first.next, "property should have no siblings on a container with one property").to.be.null;
		} else {
			let last: json.JProperty | null = null;
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
	});
}
