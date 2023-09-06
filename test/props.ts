import { expect } from 'chai';
import { MappedBagBuilder, PropertyBag, ReadOnlyPropertyBag } from '../src/prop.js'; // Update with your module path

function checkEqual<T, K extends keyof T>(bag: ReadOnlyPropertyBag<T>, key: K, value: T[K]) {
	expect(bag.getValue(key)).to.eq(value);
	expect(bag.readables[key].value).to.eq(value);

	if (bag instanceof PropertyBag)
		checkEqual(bag.readOnly, key, value);
}

describe('PropertyBag', () => {
	it('should initialise and update values in PropertyBag', () => {
		const values = {
			name: 'John',
			age: 30,
		};

		const bag = new PropertyBag(values);

		checkEqual(bag, "name", "John");
		checkEqual(bag, "age", 30);

		bag.setValue('name', 'Alice');
		bag.setValue('age', 25);

		checkEqual(bag, "name", "Alice");
		checkEqual(bag, "age", 25);
	});

	it('should initialise and update properties using MappedPropertyBag', () => {
		const values = {
			firstName: 'John',
			lastName: 'Doe',
		};

		const sourceBag = new PropertyBag(values);
		const mappedBag = new MappedBagBuilder(sourceBag)
			.map(["lastName", "firstName"])
			.map(['firstName', 'lastName'], 'full_name', (firstName, lastName) => firstName + " " + lastName)
			.build();
			
		checkEqual(mappedBag, "firstName", "John");
		checkEqual(mappedBag, "lastName", "Doe");
		checkEqual(mappedBag, "full_name", "John Doe");

		sourceBag.setValue("firstName", "Alice");
		sourceBag.setValue("lastName", "Jones");

		checkEqual(mappedBag, "firstName", "Alice");
		checkEqual(mappedBag, "lastName", "Jones");
		checkEqual(mappedBag, "full_name", "Alice Jones");
	});

	it("Should throw an error when trying to add duplicate properties on MappedBagBuilder", () => {
		const values = {
			firstName: 'John',
			lastName: 'Doe',
		};

		const sourceBag = new PropertyBag(values);
		const builder = new MappedBagBuilder(sourceBag)
			.map("firstName", "first_name");

		expect(() => builder.map("lastName", "first_name")).throws();
	})

	it('Should fire events when changing a property', () => {
		const values = {
			firstName: 'John',
			lastName: 'Doe',
		};

		let onChangeCallCount = 0;
		let subscribeCallCount = 0;
		let readOnlySubscribeCallCount = 0;
		
		const bag = new PropertyBag(values);

		bag.onChange(v => {
			onChangeCallCount++;
			expect(v).to.have.keys(["firstName"]);
			expect(v.firstName).to.eq("Alice");
		});

		bag.readables.firstName.subscribe(v => {
			expect(v).to.eq(subscribeCallCount == 0 ? "John" : "Alice");
			subscribeCallCount++;
		});

		bag.readOnly.readables.firstName.subscribe(v => {
			expect(v).to.eq(readOnlySubscribeCallCount == 0 ? "John" : "Alice");
			readOnlySubscribeCallCount++;
		});

		bag.setValue("firstName", "Alice");

		expect(onChangeCallCount).to.eq(1);
		expect(subscribeCallCount).to.eq(2);
		expect(readOnlySubscribeCallCount).to.eq(2);
	});

	it("Should not fire event handler when unsubscribed", () => {
		const values = {
			firstName: 'John',
			lastName: 'Doe',
		};

		let callCount = 0;

		const bag = new PropertyBag(values);
		const unsub = bag.readables.firstName.subscribe(() => {
			callCount++;
		});

		bag.setValue("firstName", "Alice");
		unsub();
		bag.setValue("firstName", "Joe");

		expect(callCount).to.eq(2);
	});
});
