type Config = { [key: string]: Testset };

interface Testset {
	name: string;
	limits: {
		time: number;
		memory: number;
	};
	io: {
		input: string;
		output: string;
	};
	scripts: {
		compile: string;
		run: string;
		cleanup: string;
	};
	checker: {
		type: string;
		options: any;
	}
}

interface Results {
	results: TestResult[];
}

type TestResult =
	  IncompleteTestResult
	| StoppedTestResult
	| CrashedTestResult
	| CompleteTestResult;

interface IncompleteTestResult {
	index: number;
	state: State.WAITING | State.RUNNING;
}

interface StoppedTestResult {
	index: number;
	state: State.TIME_LIMIT_EXCEEDED | State.MEMORY_LIMIT_EXCEEDED;
	time: number;
	memory: number;
	output: {
		expected: string;
		actual: string;
	}
}

interface CrashedTestResult {
	index: number;
	state: State.RUNTIME_ERROR;
	time: number;
	memory: number;
	output: {
		expected: string;
		actual: string;
		error: string;
	}
}

interface CompleteTestResult {
	index: number;
	state: State.OK | State.WRONG_ANSWER;
	time: number;
	memory: number;
	output: {
		expected: string;
		actual: string;
		displayExpected: string;
		displayActual: string;
	}
}

declare const enum State {
	WAITING = "waiting",
	RUNNING = "running",
	OK = "ok",
	WRONG_ANSWER = "wrong_answer",
	TIME_LIMIT_EXCEEDED = "time_limit_exceeded",
	MEMORY_LIMIT_EXCEEDED = "memory_limit_exceeded",
	RUNTIME_ERROR = "runtime_error"
}