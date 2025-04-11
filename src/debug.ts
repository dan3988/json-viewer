
export namespace debug {
	export type JsonMarkupArray = [tag: string] | [tag: string, ...elements: any[]] | [tag: string, attributes: object, ...elements: any[]];
	export type JsonMarkup = string | JsonMarkupArray;

	const renderers: DebugRenderer[] = [];
	const formatter = {
		header(obj: unknown) {
			for (const renderer of renderers) {
				if (renderer.canRender(obj)) {
					//console.log({ header: renderer.header(obj).toMarkup() });
					return renderer.header(obj).toMarkup();
				}
			}
		},
		hasBody(obj: unknown) {
			for (const renderer of renderers) {
				if (renderer.canRender(obj)) {
					return renderer.hasBody(obj);
				}
			}
		},
		body(obj: unknown) {
			for (const renderer of renderers) {
				if (renderer.canRender(obj)) {
					//console.log({ body: renderer.body(obj).toMarkup() });
					return renderer.body(obj).toMarkup();
				}
			}
		}
	};

	let registered = false;

	export function register(...values: DebugRenderer[]) {
		if (!registered) {
			((window as any).devtoolsFormatters ??= []).push(formatter);
			registered = true;
		}

		renderers.push(...values);
	}

	export function object(object: any, preview = true) {
		return new ObjectComponent(object, preview);
	}

	export function text(init: ComponentInitOrChildren) {
		return new TextComponent(init);
	}

	export function properties(values: Dict, preview = false) {
		const result = new ListComponent();
		for (const [key, value] of Object.entries(values)) {
			const item = new ListItemComponent()
				.append(new TextComponent(key))
				.append(new TextComponent(': '))
				.append(new ObjectComponent(value, preview));

			result.append(item);
		}

		return result;
	}

	export function list(init?: ComponentInitOrChildren<ListComponentChild>) {
		return new ListComponent(init);
	}

	export function listItem(init?: ComponentInitOrChildren) {
		return new ListItemComponent(init);
	}

	export function panel(init?: ComponentInitOrChildren) {
		return new SimpleComponent('div', init);
	}

	export interface Component {
		toMarkup(): JsonMarkup;
	}

	export type ComponentChild = string | number | boolean | bigint | Component;

	type CssGlobal = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset';
	type CssUnit = 'cm' | 'mm' | 'em' | 'rem' | '%' | 'px' | 'pt' | 'pc';

	type PaddingValue = CssGlobal | '0' | `${number}${CssUnit}`;

	export interface Sides<T> {
		top?: T;
		left?: T;
		bottom?: T;
		right?: T;
	}

	export interface Font {
		family?: string;
		size?: CssGlobal | 'xx-small' | 'x-small' | 'small' | 'medium' | 'large' | 'x-large' | 'xx-large' | 'xxx-large' | 'smaller' | 'larger' | `${number}${CssUnit}`;
		style?: CssGlobal | 'normal' | 'italic' | 'oblique' | `oblique ${number}deg`;
		weight?: CssGlobal | 'normal' | 'bold' | 'bolder' | 'lighter' | `${number}`;
	}

	export interface ComponentInit<C extends ComponentChild = ComponentChild> {
		readonly css?: Dict<string>;
		readonly color?: string;
		readonly font?: string | Font;
		readonly children?: string | C[]
	}

	type ComponentInitOrChildren<C extends ComponentChild = ComponentChild> = string | C[] | ComponentInit<C>;

	function setIfDefined(css: Dict<string>, key: string, value: undefined | string) {
		if (value === undefined) {
			delete css[key];
		} else {
			css[key] = value;
		}
	}

	type StyleKey = Exclude<keyof ComponentInit, 'children'>;

	const initConverters = {
		css: (css, value) => {
			for (let [key, v] of Object.entries(value))
				css[key] = v;
		},
		color: (css, value) => {
			css.color = value;
		},
		font: (css, value) => {
			if (typeof value === 'string') {
				css.font = value;
			} else {
				setIfDefined(css, 'font-family', value.family);
				setIfDefined(css, 'font-size', value.size);
				setIfDefined(css, 'font-style', value.style);
				setIfDefined(css, 'font-weight', value.weight);
			}
		},
	} satisfies { [P in StyleKey]: (css: Dict<string>, value: NonNullable<ComponentInit[P]>) => void };

	abstract class ElementComponent<C extends I, I extends ComponentChild = C> implements Component {
		readonly #tag;
		readonly #children: C[] = [];
		readonly #css: Dict<string> = {};

		constructor(tag: string, init?: ComponentInitOrChildren<I>) {
			this.#tag = tag;

			let children: undefined | string | I[];
			if (init) {
				if (typeof init === 'string') {
					children = init;
				} else if (Array.isArray(init)) {
					children = init;
				} else {
					children = init.children;

					for (const [key, value] of Object.entries(init))
						if (key !== 'children' && value !== undefined)
							initConverters[key as StyleKey](this.#css, value);
				}

				if (children != null) {
					if (typeof children === 'string') {
						this.#children.push(this.wrap(children as I));
					} else {
						for (const child of children)
							this.#children.push(this.wrap(child));
					}
				}
			}
		}

		protected abstract wrap(value: I): C;

		append(...children: C[]) {
			this.#children.push(...children);
			return this;
		}

		css(key: string, value: string) {
			this.#css[key] = value;
			return this;
		}

		toMarkup(): JsonMarkupArray {
			const result: any[] = [ this.#tag ];
			const entries = Object.entries(this.#css);
			if (entries.length) {
				const css: string[] = [];

				for (const [key, value] of entries)
					css.push(key, ':', value, ';');

				result.push({ style: css.join('') });
			}

			for (const child of this.#children)
				result.push(typeof child === 'object' ? child.toMarkup() : String(child));

			return result as any;
		}
	}

	class SimpleComponent extends ElementComponent<ComponentChild> {
		constructor(tag: string, init?: ComponentInitOrChildren) {
			super(tag, init);
		}
		
		protected wrap(value: ComponentChild): ComponentChild {
			return value;
		}
	}

	export class TextComponent extends SimpleComponent {
		constructor(init?: ComponentInitOrChildren) {
			super('span', init);
		}
	}

	export type ListComponentChild = ListItemComponent | string;

	export class ListComponent extends ElementComponent<ListItemComponent, ListComponentChild> {
		constructor(init?: ComponentInitOrChildren<ListComponentChild>) {
			super('ol', init);
			this.css('list-style', 'none');
			this.css('padding', '0');
			this.css('margin', '0');
		}
		
		protected wrap(value: ListComponentChild): ListItemComponent {
			return typeof value === 'string' ? new ListItemComponent([value]) : value;
		}
	}

	export class ListItemComponent extends SimpleComponent {
		constructor(init?: ComponentInitOrChildren) {
			super('li', init);
		}
	}

	class ObjectComponent implements Component {
		readonly #value;
		readonly #preview;

		constructor(value: any, preview: boolean) {
			this.#value = value;
			this.#preview = preview;
		}

		toMarkup(): JsonMarkupArray {
			const object = this.#value;
			const config = { noPreview: !this.#preview };
			return ['object', { object, config }];
		}
	}

	export abstract class DebugRenderer<T = any> {
		abstract canRender(obj: unknown): obj is T;
		abstract header(obj: T): Component;
		abstract hasBody(obj: T): boolean;
		abstract body(obj: T): Component;
	}

	export abstract class ClassRenderer<T extends object = any> extends DebugRenderer<T> {
		readonly #clazz;

		constructor(clazz: abstract new(..._: any[]) => T) {
			super();
			this.#clazz = clazz;
		}

		canRender(obj: unknown): obj is T {
			return obj instanceof this.#clazz;
		}

		hasBody(obj: T): boolean {
			return false;
		}

		body(obj: T): Component {
			throw new TypeError('Object does not have a body');
		}
	}
}

export default debug;