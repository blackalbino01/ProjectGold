import * as fs from "fs";

const DEFAULT_CONFIG: Config = { };

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const WHITE = "\x1b[39m";
const BOLD = "\x1b[1m";
const CLEAR = "\x1b[0m";
const SNEK = "🐍";

fs.mkdir(".slither", () => {
	fs.access(".slither/config.json", fs.constants.F_OK, (err) => {
		if (!err) {
			console.warn(`${YELLOW}Slither config already exists in this directory.  Rerun with ${WHITE}${BOLD}-f${CLEAR}${YELLOW} to reset it.`)
			return;
		}
		fs.writeFile(".slither/config.json", JSON.stringify(DEFAULT_CONFIG, null, "\t"), (err) => {
			if (err) {
				console.error(`${RED}File system error:", err, "${CLEAR}`);
				return;
			}
			console.log(`${GREEN}Initialized Slither in this directory.${CLEAR} ${SNEK}`);
		});
	});
});