import json from "../src/json.js";

const path = [];

function conversionTestCommon<T extends json.Node>(value: json.Node, clazz: Constructor<T>, type: json.NodeType, subtype: json.NodeSubType): asserts value is T {
	it(`Is an instance of ${clazz.name}`, () => expect(value).instanceOf(clazz));
	it(`Has the correct type`, () => expect(value.type).eq(type));
	it(`Has the correct subtype`, () => expect(value.subtype).eq(subtype));
}

export function conversionTestValue(value: json.Node, subtype: json.ValueTypeOf, expected: any): asserts value is json.Value {
	conversionTestCommon(value, json.Value, "value", subtype);
	it(`Returns true when calling isValue()`, () => expect(value.isValue()).to.be.true);
	it(`Returns false when calling isContainer()`, () => expect(value.isContainer()).to.be.false);
	it(`Returns false when calling isObject()`, () => expect(value.isObject()).to.be.false);
	it(`Returns false when calling isArray()`, () => expect(value.isArray()).to.be.false);
	it(`Has the correct value for the property "value"`, () => expect(value.value).eq(expected));
	it(`Returns the correct value when calling toJSON()`, () => expect(value.toJSON()).eq(expected));
	it(`Returns the correct value when calling toRaw()`, () => expect(value.toRaw()).eq(expected));
	it(`Returns the correct text when calling toString()`, () => expect(value.toString()).eq(JSON.stringify(expected)));
}

function conversionTestContainer<T extends json.Container>(value: json.Node, clazz: Constructor<T>, subtype: json.ContainerType, expected: any, testType: VoidFunction): asserts value is T {
	conversionTestCommon(value, clazz, "container", subtype);
	it(`Returns false when calling isValue()`, () => expect(value.isValue()).to.be.false);
	it(`Returns true when calling isContainer()`, () => expect(value.isContainer()).to.be.true);
	testType();
	it(`Has the correct value for the property "value"`, () => expect(value.value).to.be.deep.eq(expected));
	it(`Returns the correct value when calling toJSON()`, () => expect(value.toJSON()).to.be.deep.eq(expected));
	it(`Returns the correct value when calling toRaw()`, () => expect(value.toRaw()).to.be.deep.eq(expected));
	it(`Returns the correct text when calling toString()`, () => expect(value.toString()).eq(JSON.stringify(expected)));
}

export function conversionTestArray(value: json.Node, expected: any[]): asserts value is json.Array {
	conversionTestContainer(value, json.Array, "array", expected, () => {
		it(`Returns false when calling isObject()`, () => expect(value.isObject()).to.be.false);
		it(`Returns true when calling isArray()`, () => expect(value.isArray()).to.be.true);
	});
}

export function conversionTestObject(value: json.Node, expected: object): asserts value is json.Object {
	conversionTestContainer(value, json.Object, "object", expected, () => {
		it(`Returns true when calling isObject()`, () => expect(value.isObject()).to.be.true);
		it(`Returns false when calling isArray()`, () => expect(value.isArray()).to.be.false);
	});
}

export function testProp<T extends string | number>(parent: json.Container<T>, key: T, callback?: (value: json.Node) => void) {
	path.push(key);
	try {
		const prefix = "Property \"/" + path.join("/") + "\"";
		describe(prefix, () => {
			const prop = parent.get(key);
			it(`Exists`, () => expect(prop, `property ${JSON.stringify(key)} was not found`).to.exist);
			const value = parent.get(key);
		
			it(`Has the correct key`, () => expect(prop.key).eq(key));
			it(`Has the correct value`, () => expect(prop.value).eq(value.value));
			
			callback(value);
		});
	} finally {
		path.pop();
	}
}

export function validateLinks(value: json.Node) {
	if (value.count === 0) {
		expect(value.first, "\"first\" should be null on an empty container").to.be.null;
		expect(value.last, "\"last\" should be null on an empty container").to.be.null;
	} else if (value.count === 1) {
		expect(value.first).eq(value.last, "\"first\" should be equal to \"last\" on a container with one property");
		expect(value.first.previous, "property should have no siblings on a container with one property").to.be.null;
		expect(value.first.next, "property should have no siblings on a container with one property").to.be.null;
	} else {
		let last: json.Node | null = null;
		let current = value.first;
		let count = 0;
		do {
			expect(current.parent).eq(value, "child property's parent does not match");
			expect(current.previous).eq(last, "property's previous sibling does not match");
			expect(value.get(current.key)).eq(current, "getProperty() returned the wrong value");

			count++;
			last = current;
			current = last.next;
		} while (current != null)

		expect(value.last).eq(last, "containers last property does not match actual last property")
		expect(value.count).eq(count, "containers property count does not match");
	}
}

export function testLinks(value: json.Node) {
	it("Has a valid linked structure", () => validateLinks(value));
}
