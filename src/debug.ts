
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

	export function text(text: ComponentChild): TextComponent;
	export function text(text: TemplateStringsArray, ...rest: ComponentChild[]): TextComponent;
	export function text(text: ComponentChild | TemplateStringsArray, ...rest: ComponentChild[]) {
		return new TextComponent().add(text as any, ...rest);
	}

	export function properties(values: Dict, preview = false) {
		const result = new ListComponent();
		for (const [key, value] of Object.entries(values))
			result.addRow`${key}: ${object(value, preview)}`;

		return result;
	}

	export function list(...children: ComponentChild[]): ListComponent;
	export function list(text: TemplateStringsArray, ...rest: ComponentChild[]): ListComponent;
	export function list(...args: any) {
		const list = new ListComponent();
		ListComponent.prototype.addRow.apply(list, args);
		return list;
	}

	export function column(...children: ComponentChild[]) {
		const result = new ColumnComponent();
		children.forEach(ContainerComponent.prototype.add, result);
		return result;
	}

	export function row(...children: ComponentChild[]) {
		const result = new RowComponent();
		children.forEach(ContainerComponent.prototype.add, result);
		return result;
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

	function setIfDefined(css: Dict<string>, key: string, value: undefined | string) {
		if (value === undefined) {
			delete css[key];
		} else {
			css[key] = value;
		}
	}

	abstract class ElementComponent<C extends ComponentChild> implements Component {
		readonly #tag;
		readonly #children: C[] = [];
		readonly #css: Dict<string> = {};

		constructor(tag: string) {
			this.#tag = tag;
		}

		protected __append(child: C) {
			this.#children.push(child);
			return this;
		}

		color(value: string) {
			return this.css('color', value);
		}

		font(value: string | Font) {
			if (typeof value === 'string') {
				this.#css.font = value;
			} else {
				setIfDefined(this.#css, 'font-family', value.family);
				setIfDefined(this.#css, 'font-size', value.size);
				setIfDefined(this.#css, 'font-style', value.style);
				setIfDefined(this.#css, 'font-weight', value.weight);
			}

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

	export abstract class ContainerComponent extends ElementComponent<ComponentChild> {
		constructor(tag: string) {
			super(tag);
		}

		add(text: ComponentChild): this;
		add(text: TemplateStringsArray, ...rest: ComponentChild[]): this;
		add(text: ComponentChild | TemplateStringsArray, ...rest: ComponentChild[]) {
			if (Array.isArray(text)) {
				for (let i = 0; ; i++) {
					const str = text[i];
					str && this.__append(str);

					if (i === rest.length)
						break;

					this.__append(rest[i]);
				}
			} else {
				this.__append(text as string);
			}

			return this;
		}
	}

	export class RowComponent extends ContainerComponent {
		constructor() {
			super('div');
			this.css('display', 'flex');
			this.css('flex-direction', 'row');
		}
	}

	export class ColumnComponent extends ContainerComponent {
		constructor() {
			super('div');
			this.css('display', 'flex');
			this.css('flex-direction', 'column');
		}
	}

	export class TextComponent extends ContainerComponent {
		constructor(child?: ComponentChild) {
			super('span');
			child && this.__append(child);
		}
	}

	export class ListComponent extends ElementComponent<ListItemComponent> {
		constructor() {
			super('ol');
			this.css('list-style', 'none');
			this.css('padding', '0');
			this.css('margin', '0');
		}

		addRow(...children: ComponentChild[]): ListItemComponent;
		addRow(text: TemplateStringsArray, ...rest: ComponentChild[]): ListItemComponent;
		addRow(...args: any[]) {
			let children: ComponentChild[];
			if (Array.isArray(args[0])) {
				const v = text.apply(undefined, args as any);
				children = [v];
			} else {
				children = args;
			}

			const child = new ListItemComponent(children);
			this.__append(child);
			return child;
		}
	}

	class ListItemComponent extends ElementComponent<ComponentChild> {
		constructor(children: ComponentChild[]) {
			super('li');
			children.forEach(this.__append, this);
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