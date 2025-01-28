import type preferences from './preferences-lite';
import json from './schemes.json' with { type: 'json' };
import Color from 'color';

export namespace schemes {
	type SetKey = "primary" | "tertiary";
	type SetColor = 'text' | 'background' | 'border';

	interface JsonColorScheme {
		name: string;
		light?: JsonColorSchemeValues;
		dark?: JsonColorSchemeValues
	}

	type JsonColorSchemeValues = Expand<Omit<ColorSchemeValues, SetKey> & Record<SetKey, JsonColorSchemeSet>>;
	type JsonColorSchemeSet = { [P in keyof ColorSchemeSet]: TupleJson<ColorSchemeSet[P]> };
	type TupleJson<T> = T extends readonly any[] ? T[number][] : T;

	export type ColorScheme = preferences.lite.CustomColorScheme;
	export type ColorSchemeValues = preferences.lite.CustomColorSchemeValues;
	export type ColorSchemeSet = preferences.lite.CustomColorSchemeSet;
	export type ColorSchemeSetColors = preferences.lite.CustomColorSchemeSetColors;

	export const presets = (json satisfies Dict<JsonColorScheme>) as any as Dict<ColorScheme>;

	type SchemeGroup = [name: string, schemes: SchemeReference[]];
	type SchemeReference = [id: string, name: string];

	export const groupedPresets: SchemeGroup[] = [
		['Auto', []],
		['Light', []],
		['Dark', []],
	];
	
	for (const [key, value] of Object.entries(presets)) {
		const index = (value as any).light ? (value.dark ? 0 : 1) : 2;
		groupedPresets[index][1].push([key, value.name]);
	}

	for (const [, list] of groupedPresets)
		list.sort(([, x], [, y]) => x.localeCompare(y));
	
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

	function compileVariables(builder: CssRuleBuilder, values: ColorSchemeValues) {
		const key = Color(values.key);
		const keyword = Color(values.keyword);
		const str = Color(values.str);
		const num = Color(values.num);
		const text = Color(values.text);
		const background = Color(values.background);
		builder
			.color('jv-key-fg', key)
			.color('jv-keywd-fg', keyword)
			.color('jv-str-fg', str)
			.color('jv-num-fg', num)
			.color('jv-body-text', text)
			.color('jv-body-bg', background);

		compileSet(builder, 'jv-tertiary', values.tertiary, text);
		compileSet(builder, 'jv-primary', values.primary, text);

		for (let i = 0; i < values.indents.length; i++)
			builder.color(`jv-indent-${i}`, Color(values.indents[i]));
	}

	function writeColor(builder: CssRuleBuilder, prefix: string, suffix: string, key: SetColor, set: ColorSchemeSet, fallback?: Color): void;
	function writeColor<K extends SetColor>(builder: CssRuleBuilder, prefix: string, suffix: string, key: K, set: ColorSchemeSet, fallback: Exclude<SetColor, K>): void;
	function writeColor(builder: CssRuleBuilder, prefix: string, suffix: string, key: SetColor, set: ColorSchemeSet, fallback?: Color | SetColor) {
		let value = set[key] ?? (typeof fallback === 'string' && set[fallback]);
		let def: Color, hov: Color, act: Color;
		if (value) {
			def = Color(value.def);
			hov = value.hov ? Color(value.hov) : def;
			act = value.act ? Color(value.act) : def;
		} else if (fallback instanceof Color) {
			def = hov = act = fallback;
		} else {
			return;
		}
		
		builder
			.color(`${prefix}-${suffix}`, def)
			.color(`${prefix}-hover-${suffix}`, hov)
			.color(`${prefix}-active-${suffix}`, act)
			.color(`${prefix}-disabled-${suffix}`, def);
	}

	function compileSet(builder: CssRuleBuilder, prefix: string, set: ColorSchemeSet, textFallback: Color) {
		writeColor(builder, prefix, 'text', 'text', set, textFallback);
		writeColor(builder, prefix, 'bg', 'background', set);
		writeColor(builder, prefix, 'border', 'border', set, 'background');
	}

	function compileValues(builder: CssBuilder, theme: string, values: ColorSchemeValues, forceColorScheme = false) {
		const themeSelector = forceColorScheme ? '[data-bs-theme]' : `[data-bs-theme="${theme}"]`;
		const selectors = [ `${themeSelector}.scheme`, `${themeSelector} .scheme` ];
		builder.rule(selectors, b => {
			if (forceColorScheme)
				b.prop('color-scheme', theme);

			compileVariables(b, values);
		});
	}
}

export default schemes;
