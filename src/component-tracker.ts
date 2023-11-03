import type { ComponentConstructorOptions, SvelteComponent } from "svelte";
import type { State } from "./state.js";

type ComponentClass<T, P extends Dict> = new (options: ComponentConstructorOptions<P>) => T;

/**
 * Create a component and update its properties using a {@linkcode State}
 * @param clazz The constructor of the component to instantiate
 * @param target The parent element of the component
 * @param state The state to use to instantiate the component and listen to changes for
 */
export function createComponent<TBag extends Dict, TProps extends Dict, TComponent extends SvelteComponent>(clazz: ComponentClass<TComponent, TProps>, target: HTMLElement, state: State<TBag>): TComponent
/**
 * Create a component and update its properties using a {@linkcode State}
 * @param clazz The constructor of the component to instantiate
 * @param target The parent element of the component
 * @param state The state to use to instantiate the component and listen to changes for
 * @param initial Any extra properties to use when instantiating the component
 * @param onChange Override the change handler of {@linkcode state} to get an object containing the properties to update on the component
 */
export function createComponent<TBag extends Dict, TProps extends Dict, TComponent extends SvelteComponent, T>(clazz: ComponentClass<TComponent, TProps>, target: HTMLElement, state: State<{ [P in Exclude<keyof TProps, keyof T>]: TProps[P] }>, initial: T, onChange?: (values: Partial<TBag>) => Partial<TProps>): TComponent
export function createComponent(clazz: ComponentClass<any, any>, target: HTMLElement, state: State, initial?: any, onChange?: (v: any) => any) {
	const props: any = {};
	for (const key of state.keys)
		props[key] = state.getValue(key);

	if (initial)
		for (const [key, value] of Object.entries(initial))
			props[key] = value;

	const component = new clazz({
		target,
		props
	});

	state.onChange((v: any) => {
		if (!onChange || (v = onChange(v)))
			component.$set(v);
	})

	return component;
}

export default createComponent;