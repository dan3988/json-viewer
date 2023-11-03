import { expect } from 'chai';
import { StateController, State, MappedStateBuilder } from '../src/prop.js'; // Update with your module path

function checkEqual<T, K extends keyof T>(state: State<T>, key: K, value: T[K]) {
	expect(state.getValue(key)).to.eq(value);
	expect(state.props[key].value).to.eq(value);

	if (state instanceof StateController)
		checkEqual(state.state, key, value);
}

describe('PropertyBag', () => {
	it('should initialise and update values in PropertyBag', () => {
		const values = {
			name: 'John',
			age: 30,
		};

		const state = new StateController(values);

		checkEqual(state, "name", "John");
		checkEqual(state, "age", 30);

		state.setValue('name', 'Alice');
		state.setValue('age', 25);

		checkEqual(state, "name", "Alice");
		checkEqual(state, "age", 25);
	});

	it('should initialise and update properties using MappedPropertyBag', () => {
		const values = {
			firstName: 'John',
			lastName: 'Doe',
		};

		const sourceState = new StateController(values);
		const mappedState = new MappedStateBuilder(sourceState)
			.map(["lastName", "firstName"])
			.map(['firstName', 'lastName'], 'full_name', (firstName, lastName) => firstName + " " + lastName)
			.build();
			
		checkEqual(mappedState, "firstName", "John");
		checkEqual(mappedState, "lastName", "Doe");
		checkEqual(mappedState, "full_name", "John Doe");

		sourceState.setValue("firstName", "Alice");
		sourceState.setValue("lastName", "Jones");

		checkEqual(mappedState, "firstName", "Alice");
		checkEqual(mappedState, "lastName", "Jones");
		checkEqual(mappedState, "full_name", "Alice Jones");
	});

	it("Should throw an error when trying to add duplicate properties on MappedBagBuilder", () => {
		const values = {
			firstName: 'John',
			lastName: 'Doe',
		};

		const sourceBag = new StateController(values);
		const builder = new MappedStateBuilder(sourceBag)
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
		
		const state = new StateController(values);

		state.onChange(v => {
			onChangeCallCount++;
			expect(v).to.have.keys(["firstName"]);
			expect(v.firstName).to.eq("Alice");
		});

		state.props.firstName.subscribe(v => {
			expect(v).to.eq(subscribeCallCount == 0 ? "John" : "Alice");
			subscribeCallCount++;
		});

		state.state.props.firstName.subscribe(v => {
			expect(v).to.eq(readOnlySubscribeCallCount == 0 ? "John" : "Alice");
			readOnlySubscribeCallCount++;
		});

		state.setValue("firstName", "Alice");

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

		const state = new StateController(values);
		const unsub = state.props.firstName.subscribe(() => {
			callCount++;
		});

		state.setValue("firstName", "Alice");
		unsub();
		state.setValue("firstName", "Joe");

		expect(callCount).to.eq(2);
	});
});
