declare module "qrusage" {
	interface RusageResults {
		utime: number;
		stime: number;
		maxrss: number;
		idrss: number;
		ixrss: number;
		isrss: number;
		minflt: number;
		majflt: number;
		nswap: number;
		inblock: number;
		oublock: number;
		msgsnd: number;
		msgrcv: number;
		nsignals: number;
		nvcsw: number;
		nivcsw: number
	}

	const qrusage: {
		(target?: number): RusageResults,
		RUSAGE_CHILDREN: number
	};

	export = qrusage;
}