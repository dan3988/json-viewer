import themes from "./json-themes.json";

const _modes = {
	auto: [null, "Auto"] as const,
	light: [false, "Light Only"] as const,
	dark: [true, "Dark Only"] as const
}

export type ThemesType = typeof themes;
export type Scheme = Expand<ThemesType[keyof ThemesType]>;

type KnownModes = typeof _modes;
type ModeTypes = KnownModes & Dict<readonly [null | boolean, string]>;

export function getValue(scheme: string, userPref: null | boolean) {
	const schemeValue = (themes as Dict<Scheme>)[scheme] ?? themes.default;
	return getValueByMode(schemeValue.mode, userPref);
}

export function getValueByMode(mode: string, userPref: null | boolean): null | boolean {
	return modes[mode][0] ?? userPref;
}

export const modes: ModeTypes = _modes;
export default modes;