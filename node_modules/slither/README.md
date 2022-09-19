# 🐍 slither

slither is a utility for testing simple IO-based programs.  It's perfect for algorithmic competitions like Codeforces or TopCoder, or for testing anything else where the only effects you care about are input and output.

## Installation

```
$ npm install -g slither
```

## Usage

```
# Wherever you want to use slither...
$ slither init

# Add a new testset
$ slither addset

# Add some tests to your testset
$ slither addtest [testset-name]

# Run the tests
$ slither test [testset-name]

# Helpful options:
#   -t, --tests [tests]   only run the specified tests
#   -i, --inspect         open the test inspector after testing


# Other commands: edittest, cattest
```

## Templates

Custom set templates can be used by creating a JSON file in `~/.slither_templates`.  Default templates:

```json
{
	"java": {
		"limits": {
			"timeout": 4000,
			"memory": 64
		},
		"scripts": {
			"compile": "javac {name}.java",
			"run": "java -Xmx512M -Xss64M -DONLINE_JUDGE=false -Duser.language=en -Duser.region=US -Duser.variant=US {name}",
			"cleanup": "ls | grep -e '{name}.*\\.class' | xargs rm"
		}
	},
	"python": {
		"limits": {
			"timeout": 8000,
			"memory": 64
		},
		"scripts": {
			"run": "python {name}.py"
		}
	},
	"js": {
		"limits": {
			"timeout": 2000,
			"memory": 64
		},
		"scripts": {
			"run": "node {name}.js"
		}
	}
}
```