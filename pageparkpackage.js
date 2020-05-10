var myProductName = "pageParkPackage", myVersion = "0.4.7";   

const fs = require ("fs"); 
const utils = require ("daveutils");
const requireFromString = require ("require-from-string");
const filesystem = require ("davefilesystem"); 
const childProcess = require ("child_process");

exports.runJavaScriptCode = runJavaScriptCode;
exports.loopOverFolder = loopOverFolder;
exports.start = start;

const nameEverySecondFolder = "everySecond";
const nameEveryMinuteFolder = "everyMinute";
const nameEveryHourFolder = "everyHour";
const nameOvernightFolder = "overnight";

var config = {
	minuteToRunHourlyScripts: 0,
	hourToRunOvernightScripts: 0, 
	scriptsFolderPath: "prefs/scripts/",
	localStoragePath: "prefs/localStorage.json"
	};

var localStorage = {
	};
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

function runJavaScriptCode (f, options) { //5/9/20 by DW
	const system = { //tools that are available to all script code
		unixShellCommand: function (theCommand) {
			return (childProcess.execSync (theCommand));
			}
		};
	if (options === undefined) {
		options = new Object ();
		}
	var leftcode = "module.exports = function (options, localStorage, system) {", rightcode = "}";
	fs.readFile (f, function (err, scripttext) {
		if (err) {
			console.log ("runJavaScriptCode: err.message == " + err.message);
			}
		else {
			try {
				var code = leftcode + scripttext.toString () + rightcode;
				requireFromString (code) (options, localStorage, system);
				}
			catch (err) {
				console.log ("runJavaScriptCode: err.message == " + err.message);
				}
			}
		});
	}
function loopOverFolder (nameSubFolder, fileCallback) {
	var folder = config.scriptsFolderPath + nameSubFolder + "/";
	filesystem.sureFilePath (folder + "x", function () {
		fs.readdir (folder, function (err, theListOfFiles) {
			if (err) {
				console.log ("loopOverFolder: err.message == " + err.message);
				}
			else {
				theListOfFiles.forEach (function (f) {
					if (utils.endsWith (f, ".js")) {
						runJavaScriptCode (folder + f);
						if (fileCallback !== undefined) {
							fileCallback (f);
							}
						}
					});
				}
			});
		});
	}

function start (options, callback) {
	function initFolders () {
		function doFolder (name) {
			filesystem.sureFilePath (config.scriptsFolderPath + name + "/x");
			}
		doFolder (nameEverySecondFolder);
		doFolder (nameEveryMinuteFolder);
		doFolder (nameEveryHourFolder);
		doFolder (nameOvernightFolder);
		}
	function initLocalStorage (callback) {
		readJsonFile (config.localStoragePath, function (theData) {
			if (theData !== undefined) {
				for (var x in theData) {
					localStorage [x] = theData [x];
					}
				}
			callback ();
			});
		}
	function everySecond () {
		loopOverFolder (nameEverySecondFolder);
		writeJsonFile (config.localStoragePath, localStorage);
		}
	function everyMinute () {
		var now = new Date ();
		if (now.getMinutes () == config.minuteToRunHourlyScripts) {
			everyHour ();
			}
		loopOverFolder (nameEveryMinuteFolder);
		}
	function everyHour () {
		var now = new Date ();
		if (now.getHours () == config.hourToRunOvernightScripts) {
			loopOverFolder (nameOvernightFolder);
			}
		loopOverFolder (nameEveryHourFolder);
		}
	if (options !== undefined) {
		for (var x in options) {
			config [x] = options [x];
			}
		}
	console.log ("\nstarting " + myProductName + " v" + myVersion + ". config == " + utils.jsonStringify (config) + "\n");
	
	if (config.flRunChronologicalScripts) {
		initFolders ();
		setInterval (everySecond, 1000); 
		utils.runEveryMinute (everyMinute);
		}
	
	initLocalStorage (function () {
		if (callback !== undefined) {
			callback ();
			}
		});
	}
