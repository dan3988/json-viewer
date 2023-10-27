export namespace time {
	export const MILLIS_PER_SECOND = 1000;
	export const MILLIS_PER_MINUTE = MILLIS_PER_SECOND * 60;
	export const MILLIS_PER_HOUR = MILLIS_PER_MINUTE * 60;

	function divRem(left: number, right: number): [quotient: number, remainder: number] {
		const quotient = Math.trunc(left / right);
		return [quotient, left - (quotient * right)];
	}

	function addDurationPart(parts: (number | string)[], name: string, dur: number, quotient: number) {
		const [v, remainder] = divRem(dur, quotient);
		if (v)
			parts.push(v, name, " ");

		return remainder;
	}

	export function durationToString(dur: number) {
		let parts: (number | string)[] = [];
		dur = addDurationPart(parts, "h", dur, MILLIS_PER_HOUR);
		dur = addDurationPart(parts, "m", dur, MILLIS_PER_MINUTE);
		dur = addDurationPart(parts, "s", dur, MILLIS_PER_SECOND);
		dur = addDurationPart(parts, "ms", dur, 1);

		parts.pop();

		return parts.join("");
	}
}

export default time;
