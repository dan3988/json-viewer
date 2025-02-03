import type preferences from './preferences-lite';
import json from './schemes.json' with { type: 'json' };
import Color from 'color';

export namespace schemes {
	type SetKey = "primary" | "tertiary";
	type SetColor = 'text' | 'background' | 'border';

	export type ColorScheme = preferences.lite.CustomColorScheme;
	export type ColorSchemeSet = preferences.lite.CustomColorSchemeSet;
	export type ColorSchemeSetColors = preferences.lite.CustomColorSchemeSetColors;

	export const presets = json satisfies Dict<ColorScheme>;

	type PresetId = keyof typeof presets;

	export const ids: PresetId[] = Object.keys(presets) as any;

	interface SchemeEntry {
		id: string;
		name: string;
		dark: boolean;
	}

	interface PresetSchemeEntry extends SchemeEntry {
		id: PresetId;
	}

	interface PresetSchemeEntries {
		all: PresetSchemeEntry[];
		light: PresetSchemeEntry[];
		dark: PresetSchemeEntry[];
	}

	function makeEntry(id: PresetId): PresetSchemeEntry {
		const { name, dark } = presets[id];
		return { id, name, dark };
	}

	const all: PresetSchemeEntry[] = ids.map(makeEntry).sort((x, y) => x.name.localeCompare(y.name));
	const light: PresetSchemeEntry[] = [];
	const dark: PresetSchemeEntry[] = [];

	for (const entry of all)
		(entry.dark ? dark : light).push(entry);

	Object.freeze(ids);
	Object.freeze(all);
	Object.freeze(light);
	Object.freeze(dark);

	export const entries: PresetSchemeEntries = Object.freeze({ all, light, dark });

	export function getCustomEntries(customSchemes: Dict<ColorScheme>, darkOnly: boolean) {
		const result: SchemeEntry[] = [];

		for (const [id, { name, dark }] of Object.entries(customSchemes)) {
			if (dark === darkOnly)
				result.push({ id, name, dark })
		}

		return result.sort((x, y) => x.name.localeCompare(y.name));
	}

	export function compileCss(scheme: ColorScheme) {
		//const builder = new TextCssBuilder('\t');
		const builder = new TextCssBuilder();
		builder.rule('.scheme', builder => {
			const key = Color(scheme.key);
			const keyword = Color(scheme.keyword);
			const str = Color(scheme.str);
			const num = Color(scheme.num);
			const text = Color(scheme.text);
			const background = Color(scheme.background);
			builder
				.color('jv-key-fg', key)
				.color('jv-keywd-fg', keyword)
				.color('jv-str-fg', str)
				.color('jv-num-fg', num)
				.color('jv-body-text', text)
				.color('jv-body-bg', background);
	
			compileSet(builder, 'jv-tertiary', scheme.tertiary, text);
			compileSet(builder, 'jv-primary', scheme.primary, text);
	
			for (let i = 0; i < scheme.indents.length; i++)
				builder.color(`jv-indent-${i}`, Color(scheme.indents[i]));
		});

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
}

export default schemes;
