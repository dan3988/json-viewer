// preferences shared between the frontend and background script
import p from "./preferences-core.js";
import schemes from "./schemes.js";

export namespace preferences {
	export import core = p.core;

	export namespace lite {
		export type Key = typeof values[number]['key'];

		const colorSchema = p.core.types.tuple<schemes.ColorValues>(p.core.types.number, p.core.types.number, p.core.types.number);

		const colorSetSchema = p.core.types.object({
			text: p.core.types.nullable(colorSchema),
			background: colorSchema,
			border: p.core.types.nullable(colorSchema),
			lightnessMod: p.core.types.nullable('number'),
			saturationMod: p.core.types.nullable('number'),
		});

		const colorSchemeValuesType = p.core.types.object({
			key: colorSchema,
			keyword: colorSchema,
			str: colorSchema,
			num: colorSchema,
			background: colorSchema,
			text: colorSchema,
			tertiary: colorSetSchema,
			primary: colorSetSchema,
			indents: p.core.types.list(colorSchema),
		});

		const colorSchemeType = p.core.types.object({
			name: p.core.types.string,
			light: p.core.types.nullable(colorSchemeValuesType),
			dark: p.core.types.nullable(colorSchemeValuesType),
		});

		export type CustomColorScheme = p.core.types.ValueOf<typeof colorSchemeType>;
		export type CustomColorSchemeSet = p.core.types.ValueOf<typeof colorSetSchema>;
		export type CustomColorSchemeValues = p.core.types.ValueOf<typeof colorSchemeValuesType>;

		export const values = [
			p.core.Preference.nullable("darkMode", p.core.types.bool, false),
			p.core.Preference.list("mimes", p.core.types.string, false, ["application/json", "text/json", "text/plain"]),
			p.core.Preference.string("scheme", false, "default"),
			p.core.Preference.list("whitelist", p.core.types.string, false, []),
			p.core.Preference.list("blacklist", p.core.types.string, false, []),
			p.core.Preference.boolean("enabled", false, true),
			p.core.Preference.int("indentCount", false, 1),
			p.core.Preference.string("indentChar", false, "\t"),
			p.core.Preference.boolean("useHistory", false, true),
			p.core.Preference.enum("menuAlign", p.core.types.string, ["r", "l"], false, "r"),
			p.core.Preference.string("background", false, ""),
			p.core.Preference.boolean("useWebRequest", false, false),
			p.core.Preference.dictionary("customSchemes", colorSchemeType, false)
		] as const;

		export const manager = new p.core.PreferencesManager(values);
		export type Bag = p.core.ValuesOf<typeof manager>;
	}
}

export default preferences;