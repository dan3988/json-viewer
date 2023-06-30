import schemes from "./schemes.json";

const _modes = {
	auto: [null, "Light/Dark"] as const,
	light: [false, "Light Only"] as const,
	dark: [true, "Dark Only"] as const
}

export type SchemesType = typeof schemes;
export type Scheme = Expand<SchemesType[keyof SchemesType]>;

type KnownModes = typeof _modes;
type ModeTypes = KnownModes & Dict<readonly [null | boolean, string]>;

export function getValue(scheme: string, userPref: null | boolean) {
	const schemeValue = (schemes as Dict<Scheme>)[scheme] ?? schemes.default;
	return getValueByMode(schemeValue.mode, userPref);
}

export function getValueByMode(mode: string, userPref: null | boolean): null | boolean {
	return modes[mode][0] ?? userPref;
}

export const modes: ModeTypes = _modes;
export default modes;