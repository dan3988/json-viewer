import json from './schemes.json';
import Color from 'color';

export namespace schemes {
	export type ColorValues = [h: number, s: number, l: number];

	export interface ColorSchemeValues {
		key: ColorValues;
		keyword: ColorValues;
		str: ColorValues;
		num: ColorValues;
		text: ColorValues;
		background: ColorValues;
		tertiary: ColorSet;
		primary: ColorSet;
		indents: ColorValues[];
	}

	export interface ColorSet {
		text?: ColorValues;
		background?: ColorValues;
		border?: ColorValues;
		lightnessMod?: number;
		saturationMod?: number;
	}

	export interface ColorScheme {
		name: string;
		light?: ColorSchemeValues;
		dark?: ColorSchemeValues;
	}

	export const presets = json as any as { [P in keyof typeof json]: ColorScheme };

	export function getIndentCount(scheme: ColorScheme, darkMode: boolean) {
		const { indents } = scheme[darkMode ? 'dark' : 'light'] ?? scheme.light ?? scheme.dark!;
		return indents.length;
	}

	export function compileCss({ light, dark }: ColorScheme) {
		//const builder = new TextCssBuilder('\t');
		const builder = new TextCssBuilder();
		if (light && dark) {
			compileValues(builder, 'light', light);
			compileValues(builder, 'dark', dark);
		} else if (light) {
			compileValues(builder, 'light', light, true);
		} else if (dark) {
			compileValues(builder, 'dark', dark, true);
		}

		return builder.toString();
	}
}

export default schemes;

abstract class CssBuilder {
	abstract rule(selector: string | string[], build: (builder: CssRuleBuilder) => void): this;

	abstract toString(): string;
}

interface CssRuleBuilder {
	prop(key: string, value: any): this;
	variable(key: string, value: any): this;
	color(key: string, value: Color): this;
}

class TextCssBuilder extends CssBuilder {
	static readonly #RuleBuilder = class implements CssRuleBuilder {
		readonly #owner: TextCssBuilder;

		constructor(owner: TextCssBuilder) {
			this.#owner = owner;
		}
	
		prop(key: string, value: any) {
			this.#owner.#line(key, ':', value, ';');
			return this;
		}
		
		variable(key: string, value: any) {
			this.#owner.#line('--', key, ':', value, ';');
			return this;
		}
		
		color(key: string, color: Color) {
			const [r, g, b] = color.unitArray();
			this.#owner.#line('--', key, '-rgb:', Math.trunc(r * 255), ',', Math.trunc(g * 255), ',', Math.trunc(b * 255), ';');
			return this;
		}
	}

	readonly #parts: any[] = [];
	readonly #indent: null | string;
	readonly #newLine: string;

	constructor(indent: null | string = null) {
		super();
		this.#indent = indent;
		this.#newLine = indent == null ? '' : '\n';
	}

	#line(...values: any[]) {
		this.#indent && this.#parts.push('\n', this.#indent);
		this.#parts.push(...values);
	}

	rule(selectors: string | string[], build: (builder: CssRuleBuilder) => void) {
		if (Array.isArray(selectors)) {
			if (selectors.length === 0)
				throw new TypeError('Must provide at least 1 rule selector.');

			for (let i = 0; ;) {
				const selector = selectors[i];
				if (++i < selectors.length) {
					this.#parts.push(selector, ',', this.#newLine);
				} else {
					selectors = selector;
					break;
				}
			}
		}

		this.#parts.push(selectors, ' {');
		const builder = new TextCssBuilder.#RuleBuilder(this);
		build(builder);
		this.#parts.push(this.#newLine, '}', this.#newLine, this.#newLine);
		return this;
	}

	
	toString(): string {
		return this.#parts.join('');
	}
}

function parseColor([h, s, l]: schemes.ColorValues) {
	return Color.hsl(h * 360, s * 100, l * 100);
}

function compileVariables(builder: CssRuleBuilder, values: schemes.ColorSchemeValues) {
	const key = parseColor(values.key);
	const keyword = parseColor(values.keyword);
	const str = parseColor(values.str);
	const num = parseColor(values.num);
	const text = parseColor(values.text);
	const background = parseColor(values.background);
	builder
		.color('jv-key-fg', key)
		.color('jv-keywd-fg', keyword)
		.color('jv-str-fg', str)
		.color('jv-num-fg', num)
		.color('jv-body-text', text)
		.color('jv-body-bg', background);

	compileSet(builder, 'jv-tertiary', values.tertiary);
	compileSet(builder, 'jv-primary', values.primary);

	for (let i = 0; i < values.indents.length; i++)
		builder.color(`jv-indent-${i}`, parseColor(values.indents[i]));
}

function applyModifier(h: number, s: number, l: number, set: schemes.ColorSet, factor = 1) {
	const { lightnessMod = 0, saturationMod = 0 } = set;
	return parseColor([h, s + (factor * saturationMod), l + (factor * lightnessMod)]);
}

function writeColor(builder: CssRuleBuilder, prefix: string, suffix: string, key: 'text' | 'background' | 'border', set: schemes.ColorSet) {
	const value = set[key];
	if (value) {
		const [h, s, l] = value;
		const color = parseColor(value);
		builder
			.color(`${prefix}-${suffix}`, color)
			.color(`${prefix}-hover-${suffix}`, applyModifier(h, s, l, set, 2))
			.color(`${prefix}-active-${suffix}`, applyModifier(h, s, l, set))
			.color(`${prefix}-disabled-${suffix}`, color);
	}
}

function compileSet(builder: CssRuleBuilder, prefix: string, set: schemes.ColorSet) {
	writeColor(builder, prefix, 'text', 'text', set);
	writeColor(builder, prefix, 'bg', 'background', set);
	writeColor(builder, prefix, 'border', 'border', set);
}

function compileValues(builder: CssBuilder, theme: string, values: schemes.ColorSchemeValues, forceColorScheme = false) {
	const themeSelector = forceColorScheme ? '[data-bs-theme]' : `[data-bs-theme="${theme}"]`;
	const selectors = [ `${themeSelector}.scheme`, `${themeSelector} .scheme` ];
	builder.rule(selectors, b => {
		if (forceColorScheme)
			b.prop('color-scheme', theme);

		compileVariables(b, values);
	});

	for (let i = 0; i < values.indents.length; i++) {
		builder.rule([ `${themeSelector}.scheme .json-indent[data-indent="${i}"]`, `${themeSelector} .scheme .json-indent[data-indent="${i}"]` ], b => {
			b.variable('jv-indent', `var(--jv-indent-${i}-rgb)`);
		});
	}
}
