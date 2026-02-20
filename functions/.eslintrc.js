module.exports = {
	env: {
		es6: true,
		node: true,
	},
	parserOptions: {
		ecmaVersion: 2018,
	},
	extends: ['eslint:recommended'],
	rules: {},
	overrides: [
		{
			files: ['**/*.spec.*'],
			env: {
				mocha: true,
			},
			rules: {},
		},
	],
	globals: {},
};
