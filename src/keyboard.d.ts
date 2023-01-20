type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type KeysLower = { [P in Letter as `Key${P}`]: Lowercase<P> };
type KeysUpper = { [P in Letter as `Key${P}`]: Uppercase<P> };
type Digits = { [P in Digit as `Digit${P}`]: P }

type Control = "Backspace" | "Delete" | "CapsLock" | "Enter" | "ShiftLeft" | "ShiftRight" | "ControlLeft" | "ControlRight" | "AltLeft" | "AltRight" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
type Misc = "Backquote" | "Minus" | "Equal" | "Tab" | "BracketLeft" | "BracketRight" | "Backslash" | "IntlBackslash" | "Slash" | "SemiColon" | "Quote" | "Comma" | "Period";

export type KeyCode = `Key${Letter}` | `Digit${Digit}` | `Numpad${Digit}` | Control | Misc