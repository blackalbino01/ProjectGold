#! /bin/zsh

tsc;

for file in bin/*.js
do
	sed -i '1i #! /usr/bin/env node' "$file";
	chmod +x "$file";
	mv -- "$file" "${file%.js}";
done