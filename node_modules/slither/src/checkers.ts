interface CheckerInput {
	input: string;
	expected: string;
	actual: string;
}

interface CheckerOutput {
	ok: boolean;
	display: {
		expected: string;
		actual: string;
	};
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const WHITE = "\x1b[39m";
const GRAY = "\x1b[90m";
const BOLD = "\x1b[1m";
const CLEAR = "\x1b[0m";

const DEBUG_LINE_DELIM = "#";

function leftPad(str: string, length: number) {
	while (str.length < length) {
		str = " " + str;
	}
	return str;
}

function matchLines(expected: string, actual: string, compareLines: (expected: string, actual: string) => CheckerOutput): CheckerOutput {
	let expectedLines = expected.split(/\n/g);
	let actualLines = actual.split(/\n/g);

	while (expectedLines[expectedLines.length - 1] == "") {
		expectedLines.pop();
	}

	while (actualLines[actualLines.length - 1] == "") {
		actualLines.pop();
	}

	let displayExpected = "";
	let displayActual = "";

	let padLength = Math.max(expectedLines.length.toString().length, actualLines.length.toString().length);

	let i = 0;
	let j = 0;

	let ok = true;

	while (i < expectedLines.length && j < actualLines.length) {
		if (actualLines[j].charAt(0) === DEBUG_LINE_DELIM) {
			displayExpected += "\n";
			displayActual += `${GRAY}${leftPad(`${j+1}`, padLength)} ${actualLines[j]}${CLEAR}\n`;
			j++;
			continue;
		}

		let outcome = compareLines(expectedLines[i], actualLines[j]);

		ok = ok && outcome.ok;
		displayExpected += `${GRAY}${leftPad(`${i+1}`, padLength)} ${outcome.display.expected}${CLEAR}\n`;
		displayActual += `${GRAY}${leftPad(`${j+1}`, padLength)} ${outcome.display.actual}${CLEAR}\n`;

		i++;
		j++;
	}

	while (i < expectedLines.length) {
		ok = false;
		displayExpected += `${GRAY}${leftPad(`${i+1}`, padLength)}${RED} ${expectedLines[i]}${CLEAR}\n`;
		i++;
	}

	while (j < actualLines.length) {
		ok = false;
		displayActual += `${GRAY}${leftPad(`${j+1}`, padLength)}${RED} ${actualLines[j]}${CLEAR}\n`;
		j++;
	}

	return {
		ok,
		display: {
			expected: displayExpected,
			actual: displayActual
		}
	};
}

function matchTokens(expected: string, actual: string, compareTokens: (expected: string, actual: string) => CheckerOutput): CheckerOutput {
	let expectedTokens = expected.split(/(\s+)/g);
	let actualTokens = actual.split(/(\s+)/g);

	let displayExpected = "";
	let displayActual = "";

	let i = 0;
	let j = 0;

	let ok = true;

	while (i < expectedTokens.length && j < actualTokens.length) {
		if (expectedTokens[i].match(/\s+/g)) {
			displayExpected += expectedTokens[i];
			i++;
			continue;
		}

		if (actualTokens[j].match(/\s+/g)) {
			displayActual += actualTokens[j];
			j++;
			continue;
		}

		let outcome = compareTokens(expectedTokens[i], actualTokens[j]);

		ok = ok && outcome.ok;
		displayExpected += `${outcome.display.expected}${CLEAR}`;
		displayActual += `${outcome.display.actual}${CLEAR}`;

		i++;
		j++;
	}

	while (i < expectedTokens.length) {
		ok = false;
		displayExpected += `${RED}${expectedTokens[i]}${CLEAR}`;
		i++;
	}

	while (j < actualTokens.length) {
		ok = false;
		displayActual += `${RED}${actualTokens[j]}${CLEAR}`;
		j++;
	}

	return {
		ok,
		display: {
			expected: displayExpected,
			actual: displayActual
		}
	};
}

export default {
	"lines": (options, { input, expected, actual }) => {
		return Promise.resolve(matchLines(expected, actual, (expected: string, actual: string) => {
			if (expected === actual) {
				return {
					ok: true,
					display: {
						expected: `${GREEN}${expected}${CLEAR}`,
						actual: `${GREEN}${actual}${CLEAR}`
					}
				};
			} else {
				return {
					ok: false,
					display: {
						expected: `${RED}${expected}${CLEAR}`,
						actual: `${RED}${actual}${CLEAR}`
					}
				};
			}
		}));
	},
	"abs-rel": (options, { input, expected, actual }) => {
		let error = Math.pow(10, -options.amount);
		return Promise.resolve(
			matchLines(expected, actual, (expected: string, actual: string) =>
				matchTokens(expected, actual, (expected: string, actual: string) => {
					let exp = parseFloat(expected);
					let act = parseFloat(actual);

					if (Math.abs(exp - act) <= Math.max(error * 0.1, error * exp * 0.1)) {
						return {
							ok: true,
							display: {
								expected: `${GREEN}${expected}${CLEAR}`,
								actual: `${GREEN}${actual}${CLEAR}`
							}
						};
					} else if (Math.abs(exp - act) <= Math.max(error, error * exp)) {
						return {
							ok: true,
							display: {
								expected: `${YELLOW}${expected}${CLEAR}`,
								actual: `${YELLOW}${actual}${CLEAR}`
							}
						};
					} else {
						return {
							ok: false,
							display: {
								expected: `${RED}${expected}${CLEAR}`,
								actual: `${RED}${actual}${CLEAR}`
							}
						};
					}
				})
			)
		);
	}
} as { [key: string]: (options: any, inp: CheckerInput) => Promise<CheckerOutput> };