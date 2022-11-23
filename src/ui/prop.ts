export type PropertyChangeHandler<T = any, TSource = unknown> = (this: TSource, evt: PropertyChangeEvent<T, TSource>) => void;

export class PropertyChangeEvent<T = any, TSource = unknown> {
	constructor(
		readonly source: TSource,
		readonly property: PropertyKey,
		readonly oldValue: T,
		readonly newValue: T) { }
}