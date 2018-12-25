const webpack = require("webpack");
const Table = require('cli-table');
function generateOutput(outputOptions, stats) {
	const statsObj = stats.toJson(outputOptions);
	const {version, time, assets, entrypoints, builtAt} = statsObj;
	if (outputOptions.version) {
		console.log(`webpack ${version}`);
		process.exit(0);
	}
	// TODO: colorify
	console.log(`\n> webpack ${version}\n> ${new Date(builtAt).toString()}\n> ∆t ${time}ms\n`);
	let entries = [];

	Object.keys(entrypoints).forEach(entry => {
		entries = entries.concat(entrypoints[entry].assets)
	})
	// TODO: Abstract to own lib
	const table = new Table({
		head: ['', 'Name', 'Size(±)'],
		colWidths: [3, 25, 10],
		style : {compact : true, 'padding-left' : 1}
	});

	assets.forEach(asset => {
		if(entries.includes(asset.name)) {
			const kbSize = `${Math.round(asset.size/1000)} kb`
			const emittedSign = asset.emitted === true ? '✓' : '✗'
			table.push([emittedSign, asset.name, kbSize]);
		}
	})
	console.log(table.toString());
}
function invokeCompilerInstance(compiler, lastHash, options, outputOptions) {
	return compiler.run(function(err, stats) {
		return compilerCallback(compiler, err, stats, lastHash, options, outputOptions)
	});
}

function invokeWatchInstance(compiler, lastHash, options, outputOptions, watchOptions) {
	return compiler.watch(watchOptions, function(err, stats) {
		return compilerCallback(compiler,  err, stats, lastHash, options, outputOptions)
	});
}
function compilerCallback(compiler, err, stats, lastHash, options, outputOptions) {

	const stdout = options.silent
			? {
				write: () => {}
			  } // eslint-disable-line
			: process.stdout;
	if (!outputOptions.watch || err) {
		// Do not keep cache anymore
		compiler.purgeInputFileSystem();
	}
	if (err) {
		lastHash = null;
		console.error(err.stack || err);
		if (err.details) console.error(err.details);
		process.exit(1); // eslint-disable-line
	}
	if (outputOptions.json) {
		stdout.write(JSON.stringify(stats.toJson(outputOptions), null, 2) + "\n");
	} else if (stats.hash !== lastHash) {
		lastHash = stats.hash;
		if (stats.compilation && stats.compilation.errors.length !== 0) {
			const errors = stats.compilation.errors;
			if (errors[0].name === "EntryModuleNotFoundError") {
				process.cliLogger.error("Insufficient number of arguments or no entry found.")
				process.cliLogger.error("Alternatively, run 'webpack(-cli) --help' for usage info.");
			}
		}

		generateOutput(outputOptions, stats);
	}
	if (!outputOptions.watch && stats.hasErrors()) {
		process.exitCode = 2;
	}
}

module.exports = function webpackInstance(opts) {
	const { outputOptions, processingErrors, options } = opts;
	// TODO: fine grained in webpack log
	if(!!outputOptions.colors) {
		require("supports-color").stdout
		outputOptions.colors = true;
	}
	if (outputOptions.help) {
		console.error(outputOptions.help);
		return;
	}

	if (processingErrors.length > 0) {
		throw new Error(result.processingErrors);
	}
	if (process.shouldUseMem) {
		// TODO: use memfs for people to use webpack with fake paths
	}
	let compiler;
	let lastHash = null;

	try {
		compiler = webpack(options);
	} catch (err) {
		if (err.name === "WebpackOptionsValidationError") {
			if (outputOptions.color)
				console.error(`\u001b[1m\u001b[31m${err.message}\u001b[39m\u001b[22m`);
			else console.error(err.message);
			// eslint-disable-next-line no-process-exit
			process.exit(1);
		}
		throw err;
	}

	if (outputOptions.infoVerbosity === "verbose") {
		if (outputOptions.watch) {
			compiler.hooks.watchRun.tap("WebpackInfo", compilation => {
				const compilationName = compilation.name ? compilation.name : "";
				process.cliLogger.info("Compilation " + compilationName + " starting…");
			});
		} else {
			compiler.hooks.beforeRun.tap("WebpackInfo", compilation => {
				const compilationName = compilation.name ? compilation.name : "";
				process.cliLogger.info("Compilation " + compilationName + " starting…");
			});
		}
		compiler.hooks.done.tap("WebpackInfo", compilation => {
			const compilationName = compilation.name ? compilation.name : "";
			process.cliLogger.info("Compilation " + compilationName + " finished");
		});
	}

	if (outputOptions.watch) {
		const watchOptions = outputOptions.watchOptions || {};
		if (watchOptions.stdin) {
			process.stdin.on("end", function(_) {
				process.exit(); // eslint-disable-line
			});
			process.stdin.resume();
		}
		invokeWatchInstance(compiler, lastHash, options, outputOptions, watchOptions);
		if (outputOptions.infoVerbosity !== "none") process.cliLogger.info("watching the files...");
	} else invokeCompilerInstance(compiler, lastHash, options, outputOptions);
	return compiler;
};
