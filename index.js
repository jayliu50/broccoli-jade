'use strict';
var fs = require('fs');
var Filter = require('broccoli-filter');
var jade = require('jade');
var mkdirp = require('mkdirp');
var path = require('path');

function JadeFilter(inputTree, options) {
	if (!(this instanceof JadeFilter)) {
		return new JadeFilter(inputTree, options);
	}

	Filter.call(this, inputTree);
	this.options = options || {};
	this.dependencyMap = {};
	this.compileRepo = {};
}

JadeFilter.prototype = Object.create(Filter.prototype);
JadeFilter.prototype.constructor = JadeFilter;

JadeFilter.prototype.extensions = ['jade'];
JadeFilter.prototype.targetExtension = 'html';

JadeFilter.prototype.writeIntoFile =
	function writeIntoFile(outputPath, outputString, encoding) {
		fs.writeFileSync(outputPath, outputString, {
			encoding: encoding
		});
		// try {
		//   fs.stat(outputPath
		//   , function(err, stats) {
		//     if (err) { // doesn't exist
		//     } else {
		//       fs.unlink(outputPath);
		//       console.warn("deleted file " + outputPath)
		//     }

		//     fs.writeFileSync(outputPath, outputString, {
		//       encoding: encoding
		//     });

		//   });
		// }
		// catch (e) {
		//   fs.writeFileSync(outputPath, outputString, {
		//     encoding: encoding
		//   });
		// }
	};

JadeFilter.prototype.processFile =
	function processFile(srcDir, destDir, relativePath) {
		var self = this;
		var inputEncoding = this.inputEncoding;
		var outputEncoding = this.outputEncoding;
		if (inputEncoding === void 0) inputEncoding = 'utf8';
		if (outputEncoding === void 0) outputEncoding = 'utf8';
		var contents = fs.readFileSync(
			srcDir + '/' + relativePath, {
				encoding: inputEncoding
			});

		function handleDependencies(currentFile, visited) {
			if (!visited.hasOwnProperty(currentFile) && self.dependencyMap[currentFile]) {
				// console.log("currentFile " + currentFile);
				// console.log("visited %j", visited);
				// console.log("depss " + Object.keys(self.dependencyMap) || "none");
				for (var i = 0; i < self.dependencyMap[currentFile].length; i++) {
					var depFileShort = self.dependencyMap[currentFile][i];
					var depFile = destDir + '/' + self.getDestFilePath(depFileShort.substr(self.options.basedir.length + 1));
					// depFileShort = self.options.basedir + "/" + depFileShort;
					// var depFile = self.dependencyMap[currentFile][i];
					console.log("rendering dependency: " + depFileShort);


					try {
						// var depOutput = jade.renderFile(depFileShort, self.options);
						// var depOutput = jade.compileFile(depFileShort, self.options)(self.options.data)
						var depOutput = self.compileRepo[depFileShort](self.options.data);
					} catch (e) {
						// should probably do something about it
						console.error(e);
					}

					// var destFile = depFile.substr(0, depFile.length - self.targetExtension.length) + self.extensions[0];
					var destFile = depFile;
					// console.log("putting back into " + destFile)
					// console.log("i think I'm working on " + depFileShort);
					// console.log("putting into " + destFile + "\n" + depOutput + "\n\n");
					//
					self.writeIntoFile(destFile, depOutput, self.encoding);

					visited[currentFile] = true;
					handleDependencies(self.dependencyMap[currentFile][i], visited);
				}
			}
		}


		return Promise.resolve(this.processString(contents, relativePath, srcDir)).
			then(function asyncOutputFilteredFile(outputString) {
				var outputPath = self.getDestFilePath(relativePath);
				if (outputPath == null) {
					throw new Error('canProcessFile("' + relativePath + '") is true, but getDestFilePath("' + relativePath + '") is null');
				}
				outputPath = destDir + '/' + outputPath;
				mkdirp.sync(path.dirname(outputPath));
				self.writeIntoFile(outputPath, outputString, self.encoding);
				var currentFile = self.options.basedir + '/' + relativePath;
				handleDependencies(currentFile, {});

			});
	};


JadeFilter.prototype.processString = function(contents, relativePath, srcDir) {
	this.options.filename = this.options.filename || (this.options.resolvePath || srcDir) + '/' + relativePath;
	var fn = jade.compile(contents, this.options);
	var dependencies = fn.dependencies;

	var currentFile = this.options.basedir + '/' + relativePath;

	for (var i = dependencies.length - 1; i >= 0; i--) {

		if (!this.dependencyMap[dependencies[i]]) {
			this.dependencyMap[dependencies[i]] = [];
		}

		var thisMap = this.dependencyMap[dependencies[i]];

		if (thisMap[thisMap.length - 1] !== currentFile) // crude way of checking for duplicates
			thisMap.push(currentFile);
	}

	this.compileRepo[currentFile] = fn;

	// console.log(currentFile + ": " + dependencies);
	// console.log("Dependencies: %j", this.dependencyMap);

	return fn(this.options.data);
};

module.exports = JadeFilter;
