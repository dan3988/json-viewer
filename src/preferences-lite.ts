// preferences shared between the frontend and background script
import p from "./preferences-core.js";

export namespace preferences {
	export import core = p.core;

	export namespace lite {
		export type Key = typeof values[number]['key'];

		const setColors = p.core.types.object(
			{
				def: p.core.types.string,
				act: p.core.types.string,
				hov: p.core.types.string,
			},
			['act', 'hov']
		);

		const colorSet = p.core.types.object(
			{
				background: setColors,
				border: setColors,
				text: setColors,
			},
			['border', 'text']
		);

		const colorSchemeType = p.core.types.object({
			name: p.core.types.string,
			dark: p.core.types.bool,
			key: p.core.types.string,
			keyword: p.core.types.string,
			str: p.core.types.string,
			num: p.core.types.string,
			background: p.core.types.string,
			text: p.core.types.string,
			tertiary: colorSet,
			primary: colorSet,
			indents: p.core.types.list('string'),
		});

		export type CustomColorSchemeSetColors = p.core.types.ValueOf<typeof setColors>;
		export type CustomColorScheme = p.core.types.ValueOf<typeof colorSchemeType>;
		export type CustomColorSchemeSet = p.core.types.ValueOf<typeof colorSet>;

		export const values = [
			p.core.Preference.nullable("darkMode", p.core.types.bool),
			p.core.Preference.list("mimes", p.core.types.string, ["application/json", "text/json", "text/plain"]),
			p.core.Preference.string("schemeLight", "default_light"),
			p.core.Preference.string("schemeDark", "default_dark"),
			p.core.Preference.list("whitelist", p.core.types.string),
			p.core.Preference.list("blacklist", p.core.types.string),
			p.core.Preference.boolean("enabled", true),
			p.core.Preference.int("indentCount", 1),
			p.core.Preference.string("indentChar", "\t"),
			p.core.Preference.boolean("useHistory", true),
			p.core.Preference.enum("menuAlign", p.core.types.string, ["r", "l"], "r"),
			p.core.Preference.string("background", ""),
			p.core.Preference.boolean("useWebRequest", false),
			p.core.Preference.dictionary("customSchemes", colorSchemeType)
		] as const;

		export const manager = new p.core.PreferencesManager(values);
		export type Bag = p.core.ValuesOf<typeof manager>;
	}
}

export default preferences;