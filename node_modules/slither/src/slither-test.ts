import * as commander from "commander";
import * as cp from "mz/child_process";
import * as fs from "mz/fs";
import truncate = require("cli-truncate");
import width = require("string-width");
import rusage = require("qrusage");
require("keypress")(process.stdin);

import checkers from "./checkers";

const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const UP = (n: number) => `\x1b[${n}A`;
const DOWN = (n: number) => `\x1b[${n}B`;

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const WHITE = "\x1b[39m";
const PURPLE = "\x1b[35m";
const CYAN = "\x1b[36m";
const GRAY = "\x1b[90m";
const BOLD = "\x1b[1m";
const CLEAR = "\x1b[0m";
const ERASE_SCREEN = "\x1b[2J";
const RESET_CURSOR = "\x1b[0,0H";
const SNEK = "🐍  ";

const OK = "✓";
const WRONG_ANSWER = "✗";
const WAITING = "•";
const RUNNING = "•";
const TIME_LIMIT_EXCEEDED = "t";
const RUNTIME_ERROR = "!";
const MEMORY_LIMIT_EXCEEDED = "m";

function parseTests(val: string) {
	let parts = val.split(",");
	let tests = [];

	for (let part of parts) {
		if (part.indexOf("-") >= 0) { // range
			let [aStr, bStr] = part.split("-");
			let [a, b] = [parseInt(aStr), parseInt(bStr)];

			for (let i = a; i <= b; i++) {
				tests.push(i);
			}
		} else { // single number
			tests.push(parseInt(part));
		}
	}

	return tests;
}

function exit(message: string): any {
	console.error(message);
	process.exit(1);
}

let name: string;

commander
	.arguments("<set>")
	.option("-t, --tests [tests]", "Which tests to run", parseTests)
	.option("-i, --inspect", "Inspect tests after running")
	.option("-r, --raw", "Get raw output from a single test")
	.action((set: string) => {
		name = set;
	})
	.parse(process.argv);

if (name === undefined) {
	console.error(`${RED}Missing test set name.${CLEAR}`);
} else {
	fs.readFile(".slither/config.json")
		.catch(() => exit(`${RED}No Slither configuration found in the current directory.  Run ${WHITE}${BOLD}slither init${RED}${CLEAR}${RED} first.${CLEAR}`))
		.then((data: Buffer) => {
			let config = JSON.parse(data.toString()) as Config;
			let testset: Testset = config[name];

			if (!testset) {
				return Promise.reject(`${RED}No testset with the name "${name}" was found.${CLEAR}`);
			}

			let tests = (commander as any).tests;

			if (Array.isArray(tests)) {
				return { testset, tests };
			} else {
				return getAllTests(name).then((tests) => ({ testset, tests }));
			}
		})
		.catch(exit)
		.then(({ testset, tests }: { testset: Testset, tests: number[] }) => {
			if ((commander as any).raw && tests.length != 1) {
				return Promise.reject(`${BOLD}${RED}Error: -r/--raw can only be used with a single test${CLEAR}${SHOW_CURSOR}`);
			} else if ((commander as any).raw && (commander as any).inspect) {
				return Promise.reject(`${BOLD}${RED}Error: -r/--raw can't be used with -i/--inspect${SHOW_CURSOR}`);
			}
			return Promise.resolve({ testset, tests });
		})
		.catch(exit)
		.then(({ testset, tests }: { testset: Testset, tests: number[] }) => {
			return Promise.all([
				testset,
				tests,
				exec(testset.scripts.compile)
			]) as Promise<[Testset, number[], { stdout: string, stderr: string }]>;
		})
		.catch(({ stderr }: { stderr: string }) => exit(`${BOLD}${RED}Compile error:${CLEAR}\n\n${stderr}${SHOW_CURSOR}`))
		.then(([testset, tests]: [Testset, number[]]) => {
			process.stdout.write(HIDE_CURSOR);

			let prm: Promise<Results> = Promise.resolve({
				results: tests.map((index: number) => ({ index, state: State.WAITING } as IncompleteTestResult))
			});

			for (let i = 0; i < tests.length; i++) {
				prm.then((results) => {
					results.results[i].state = State.RUNNING;
					update(results);
				}).catch((error) => console.error(`${RED}Error: ${error}${CLEAR}`));

				prm = prm.then((results) => {
					return test(results, name, testset, tests[i], i);
				});
			}

			return prm.then((results) => {
				update(results);
				process.stdout.write(DOWN(results.results.length));
				exec(testset.scripts.cleanup);
				return results;
			});
		})
		.then((results: Results) => {
			if ((commander as any).raw) {
				process.stdout.write((results.results[0] as CompleteTestResult).output.actual);
				process.stdout.write(SHOW_CURSOR);
			} else if ((commander as any).inspect) {
				new Inspector(results);
			} else {
				process.stdout.write(SHOW_CURSOR);
			}
		})
		.catch((err: any) => exit(`${RED}Error:${err}${SHOW_CURSOR}${CLEAR}`));
}

function exec(cmd: string, input: string = "", timeout: number = 0): Promise<{ stdout: string, stderr: string, timeout?: boolean }> {
	return new Promise((resolve, reject) => {
		let child = cp.spawn("sh", ["-c", cmd]);

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => stdout += data);
		child.stderr.on("data", (data) => stderr += data);

		child.on("error", (err) => {
			reject({ stdout: "", stderr: "" });
		});

		child.stdin.write(input);
		child.stdin.end();

		let timer: NodeJS.Timer;

		if (timeout !== 0) {
			timer = setTimeout(() => {
				child.kill();
				reject({ stdout: "", stderr: "", timeout: true });
			}, timeout);
		}

		child.on("close", (code) => {
			if (timer) {
				clearTimeout(timer);
			}

			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				reject({ stdout, stderr });
			}
		});
	});
}

function getAllTests(name: string) {
	return fs.readdir(`.slither/${name}`)
		.then((files) => {
			let numbers = files.map((file) => parseInt(file.split(".")[0])).sort((a, b) => a - b);

			let tests = [];

			for (let i = 0; i < numbers.length; i++) {
				if (tests[tests.length - 1] !== numbers[i]) {
					tests.push(numbers[i]);
				}
			}
			return tests;
		});
}

function test(results: Results, name: string, testset: Testset, test: number, idx: number): Promise<Results> {
	let inPrm = fs.readFile(`.slither/${name}/${test}.in`);
	let outPrm = fs.readFile(`.slither/${name}/${test}.out`);
	let filePrm = Promise.all([inPrm, outPrm]);
	let startTime = Date.now();

	filePrm.catch((err) =>
		console.error(`${RED}Input or output file missing for test ${test}.${CLEAR}`));

	return filePrm.then(([inBuf, outBuf]) => {
		let input = inBuf.toString();
		let output = outBuf.toString();

		let testResult = results.results[idx];
		let time = Date.now() - startTime;
		let memory = rusage(rusage.RUSAGE_CHILDREN).maxrss;

		return exec(testset.scripts.run, input, testset.limits.time)
			.then(({ stdout, stderr, timeout }) => {
				return checkers[testset.checker.type](testset.checker.options, { input, expected: output, actual: stdout })
					.then(({ ok, display }) => {
						Object.assign(testResult, {
							time,
							memory,
							state: ok ? State.OK : State.WRONG_ANSWER,
							output: {
								expected: output,
								actual: stdout,
								displayExpected: display.expected,
								displayActual: display.actual
							}
						});
					})
					.then(() => results);
			})
			.catch(({ stdout, stderr, timeout }) => {
				if (timeout) {
					Object.assign(testResult, {
						time: testset.limits.time,
						memory,
						state: State.TIME_LIMIT_EXCEEDED,
						output: { expected: output, actual: stdout }
					});
				} else if (/memory/i.test(stderr)) {
					// cheating for now - any error containing "memory" is out-of-memory
					Object.assign(testResult, {
						time,
						memory,
						state: State.MEMORY_LIMIT_EXCEEDED,
						output: { expected: output, actual: stdout }
					});
				} else {
					Object.assign(testResult, {
						time,
						memory,
						state: State.RUNTIME_ERROR,
						output: { expected: output, actual: stdout, error: stderr }
					});
				}
				return results;
			});
	}).catch((err) => {
		console.error(`${RED}File system error: ${err}`);
		return results;
	});
}

function printTestResult(result: TestResult): void {
	process.stdout.write(BOLD);

	switch (result.state) {
		case State.OK:
			process.stdout.write(`${GREEN}${OK}`);
			break;

		case State.WRONG_ANSWER:
			process.stdout.write(`${RED}${WRONG_ANSWER}`);
			break;

		case State.WAITING:
			process.stdout.write(`${GRAY}${WAITING}`);
			break;

		case State.RUNNING:
			process.stdout.write(`${CLEAR}${WAITING}`);
			break;

		case State.TIME_LIMIT_EXCEEDED:
			process.stdout.write(`${YELLOW}${TIME_LIMIT_EXCEEDED}`);
			break;

		case State.RUNTIME_ERROR:
			process.stdout.write(`${PURPLE}${RUNTIME_ERROR}`);
			break;

		case State.MEMORY_LIMIT_EXCEEDED:
			process.stdout.write(`${CYAN}${MEMORY_LIMIT_EXCEEDED}`);
			break;
	}

	process.stdout.write(" ");
	process.stdout.write(CLEAR);
	process.stdout.write(WHITE);
	process.stdout.write(result.index.toString());
	process.stdout.write(" ");

	switch (result.state) {
		case State.WAITING:
			// do nothing
			break;

		case State.RUNNING:
			process.stdout.write(GRAY);
			process.stdout.write("[ Running ]");
			break;

		default:
			process.stdout.write(GRAY);
			process.stdout.write("[ ");
			process.stdout.write(leftPad(result.time.toFixed(0), 4));
			process.stdout.write(" ms / ");
			process.stdout.write(leftPad((result.memory / 1048576).toFixed(3), 8));
			process.stdout.write(" MB ]");
			break;
	}
}

function update(results: Results): void {
	if ((commander as any).raw) {
		return;
	}

	for (let result of results.results) {
		printTestResult(result);
		process.stdout.write("\n");
	}

	process.stdout.write(CLEAR);
	process.stdout.write(UP(results.results.length));
}

function rightPad(str: string, length: number, padChar: string = " ") {
	while (width(str) < length) {
		str = str + padChar;
	}
	return str;
}

function leftPad(str: string, length: number, padChar: string = " ") {
	while (width(str) < length) {
		str = padChar + str;
	}
	return str;
}

class Inspector {
	private results: Results;
	private index: number;

	public constructor(results: Results) {
		this.results = results;
		this.index = 0;

		this.display();

		process.stdin.on("keypress", (ch: string, key: { name: string, ctrl: boolean, meta: boolean, shift: boolean, sequence: string, code: string }) => {
			if (key && key.ctrl && key.name === "c") {
				process.stdout.write(SHOW_CURSOR);
				process.stdin.pause();
			}

			switch (key.name) {
				case "down":
					this.index = (this.index + 1) % this.results.results.length;
					this.display();
					break;

				case "up":
					this.index = (this.index + this.results.results.length - 1) % this.results.results.length;
					this.display();
					break;

				case "q":
					process.stdout.write(SHOW_CURSOR);
					process.stdin.pause();
			}
		});

		(process.stdin as any).setRawMode(true);
	}

	private display() {
		let current = this.results.results[this.index];
		let cols = (process.stdout as any).columns;

		process.stdout.write(ERASE_SCREEN);
		process.stdout.write(RESET_CURSOR);

		for (let i = 0; i < this.results.results.length; i++) {
			if (this.index == i) {
				process.stdout.write(BLUE);
				process.stdout.write(">> ");
			} else {
				process.stdout.write("   ");
			}
			printTestResult(this.results.results[i]);
			process.stdout.write(CLEAR);
			process.stdout.write("\n");
		}

		process.stdout.write("\n");
		process.stdout.write(rightPad(GRAY, cols, "-"));
		process.stdout.write(`${CLEAR}\n\n${WHITE}${BOLD}Test ${current.index}  •  Verdict: ${CLEAR}`);

		switch (current.state) {
			case State.OK:
				process.stdout.write(`${GREEN}OK${CLEAR}`);
				break;

			case State.WRONG_ANSWER:
				process.stdout.write(`${RED}Wrong answer${CLEAR}`);
				break;

			case State.TIME_LIMIT_EXCEEDED:
				process.stdout.write(`${YELLOW}Time limit exceeded${CLEAR}`);
				break;

			case State.RUNTIME_ERROR:
				process.stdout.write(`${PURPLE}Runtime error${CLEAR}\n${BOLD}${WHITE}\n${RED}${current.output.error}${CLEAR}`);
				break;

			case State.MEMORY_LIMIT_EXCEEDED:
				process.stdout.write(`${CYAN}Memory limit exceeded${CLEAR}`);
				break;
		}

		process.stdout.write("\n\n");

		let expected = "";
		let actual = "";
		let expectedCount = 0;
		let actualCount = 0;

		switch (current.state) {
			case State.OK:
			case State.WRONG_ANSWER:
				expected = (current as CompleteTestResult).output.displayExpected;
				actual = (current as CompleteTestResult).output.displayActual;
				expectedCount = dropTrailingNewlines((current as CompleteTestResult).output.expected.split("\n")).length;
				actualCount = dropTrailingNewlines((current as CompleteTestResult).output.actual.split("\n")).length;
				break;

			case State.MEMORY_LIMIT_EXCEEDED:
			case State.RUNTIME_ERROR:
			case State.TIME_LIMIT_EXCEEDED:
				expected = numberLines(current.output.expected);
				actual = numberLines(current.output.actual);
				expectedCount = dropTrailingNewlines(current.output.expected.split("\n")).length;
				actualCount = dropTrailingNewlines(current.output.actual.split("\n")).length;
				break;
		}

		let size = Math.floor((cols - 3) / 2);

		let expectedLines = expected.split("\n").slice(0, 30);
		let actualLines = actual.split("\n").slice(0, 30);

		expectedLines = formatDisplayLines(expectedLines, size);
		actualLines = formatDisplayLines(actualLines, size);

		let expectedHeader = rightPad(`${BOLD}${WHITE} Expected ${CLEAR}${GRAY}(${expectedCount} lines)${CLEAR}`, size);
		let actualHeader = rightPad(`${BOLD}${WHITE} Actual ${CLEAR}${GRAY}(${actualCount} lines)${CLEAR}`, size);

		process.stdout.write(`${expectedHeader} ${CLEAR}| ${actualHeader}\n`);
		process.stdout.write(`${rightPad("", size, "-")}-+-${rightPad("", size, "-")}\n`);

		for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
			let expected = i < expectedLines.length ? expectedLines[i] : "";
			let actual = i < actualLines.length ? actualLines[i] : "";

			process.stdout.write(`${expected} | ${actual}\n`);
		}
	}
}

function dropTrailingNewlines(lines: string[]): string[] {
	while (lines[lines.length - 1] === "") {
		lines.pop();
	}

	return lines;
}

function numberLines(str: string): string {
	let lines = dropTrailingNewlines(str.split(/\n/g));
	let padWidth = lines.length.toString().length;

	return lines
		.map((l, i) => `${GRAY}${leftPad(`${i+1}`, padWidth)}${CLEAR} ${l}`)
		.join("\n");
}

function formatDisplayLines(lines: string[], size: number): string[] {
	while (lines[lines.length - 1] === "") {
		lines.pop();
	}

	return lines
			.map((l) => rightPad(truncate(l, size), size));
}

process.on('unhandledRejection', (reason: string, promise: string) => console.log(RED, "Unhandled promise rejection (please file a bug):", reason, promise));
