// preferences shared between the frontend and background script
import p from "./preferences-core.js";

export namespace preferences {
	export namespace lite {
		export const values = [
			p.Preference.nullable("darkMode", p.types.bool, false),
			p.Preference.list("mimes", p.types.string, false, ["application/json"]),
			p.Preference.string("scheme", false, "default"),
			p.Preference.list("whitelist", p.types.string, false, []),
			p.Preference.list("blacklist", p.types.string, false, []),
			p.Preference.boolean("enabled", false, true),
			p.Preference.int("indentCount", false, 1),
			p.Preference.string("indentChar", false, "\t"),
			p.Preference.boolean("useHistory", false, true),
			p.Preference.enum("menuAlign", p.types.string, ["r", "l"], false, "r"),
			p.Preference.string("background", false, ""),
			p.Preference.boolean("useWebRequest", false, false)
		] as const;

		export const manager = new p.PreferencesManager(values);
		export type Bag = p.ValuesOf<typeof manager>;
	}
}

export default preferences;