// preferences shared between the frontend and background script
import p from "./preferences-core.js";
import schemes from "./schemes.js";

export namespace preferences {
	export type Preference<T = any, K extends string = string> = p.Preference<T, K>;

	export namespace lite {
		export type Key = typeof values[number]['key'];

		const colorSchema = p.types.tuple<schemes.ColorValues>(p.types.number, p.types.number, p.types.number);

		const colorSetSchema = p.types.object({
			text: p.types.nullable(colorSchema),
			background: colorSchema,
			border: p.types.nullable(colorSchema),
			lightnessMod: p.types.nullable('number'),
			saturationMod: p.types.nullable('number'),
		});

		const colorSchemeValuesType = p.types.object({
			key: colorSchema,
			keyword: colorSchema,
			str: colorSchema,
			num: colorSchema,
			background: colorSchema,
			text: colorSchema,
			tertiary: colorSetSchema,
			primary: colorSetSchema,
			indents: p.types.list(colorSchema),
		});

		const colorSchemeType = p.types.object({
			name: p.types.string,
			light: p.types.nullable(colorSchemeValuesType),
			dark: p.types.nullable(colorSchemeValuesType),
		});

		export type CustomColorScheme = p.types.ValueOf<typeof colorSchemeType>;
		export type CustomColorSchemeSet = p.types.ValueOf<typeof colorSetSchema>;
		export type CustomColorSchemeValues = p.types.ValueOf<typeof colorSchemeValuesType>;

		export const values = [
			p.Preference.nullable("darkMode", p.types.bool, false),
			p.Preference.list("mimes", p.types.string, false, ["application/json", "text/json", "text/plain"]),
			p.Preference.string("scheme", false, "default"),
			p.Preference.list("whitelist", p.types.string, false, []),
			p.Preference.list("blacklist", p.types.string, false, []),
			p.Preference.boolean("enabled", false, true),
			p.Preference.int("indentCount", false, 1),
			p.Preference.string("indentChar", false, "\t"),
			p.Preference.boolean("useHistory", false, true),
			p.Preference.enum("menuAlign", p.types.string, ["r", "l"], false, "r"),
			p.Preference.string("background", false, ""),
			p.Preference.boolean("useWebRequest", false, false),
			p.Preference.dictionary("customSchemes", colorSchemeType, false)
		] as const;

		export const manager = new p.PreferencesManager(values);
		export type Bag = p.ValuesOf<typeof manager>;
	}
}

export default preferences;