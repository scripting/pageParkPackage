var myProductName = "pageParkPackage", myVersion = "0.4.0";   

const fs = require ("fs"); 
const utils = require ("daveutils");
const requireFromString = require ("require-from-string");
const filesystem = require ("davefilesystem"); 
const childProcess = require ("child_process");

exports.runScript = runScript;

function readJsonFile (path, callback) {
	filesystem.sureFilePath (path, function () {
		fs.readFile (path, function (err, data) {
			var theObject = undefined;
			if (err) {
				}
			else {
				try {
					theObject = JSON.parse (data);
					}
				catch (err) {
					console.log ("readJsonFile: err.message == " + err.message);
					}
				}
			callback (theObject);
			});
		});
	}
function writeJsonFile (path, data) {
	filesystem.sureFilePath (path, function () {
		fs.writeFile (path, utils.jsonStringify (data), function (err) {
			});
		});
	}
function runScript (f) {
	var noderunner = { //functions called-scripts can use to access functionality within noderunner
		utils, //scripts have access to all of utils
		unixShellCommand: function (theCommand) {
			return (childProcess.execSync (theCommand));
			}
		};
	var leftcode = "module.exports = function (localStorage, noderunner) {", rightcode = "}";
	fs.readFile (f, function (err, moduletext) {
		if (err) {
			console.log ("runScript: err.message == " + err.message);
			}
		else {
			var code = leftcode + moduletext.toString () + rightcode;
			requireFromString (code) (localStorage, noderunner);
			}
		});
	}
function loopOverFolder (nameSubFolder, fileCallback) {
	var folder = config.nameScriptsFolder + "/" + nameSubFolder + "/";
	filesystem.sureFilePath (folder + "x", function () {
		fs.readdir (folder, function (err, theListOfFiles) {
			theListOfFiles.forEach (function (f) {
				if (utils.endsWith (f, ".js")) {
					runScript (folder + f);
					if (fileCallback !== undefined) {
						fileCallback (f);
						}
					}
				});
			});
		});
	}
