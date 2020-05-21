var myProductName = "pageParkPackage", myVersion = "0.4.24";   

const fs = require ("fs"); 
const utils = require ("daveutils");
const requireFromString = require ("require-from-string");
const filesystem = require ("davefilesystem"); 
const childProcess = require ("child_process");
const foreverMonitor = require ("forever-monitor");
const forever = require ("forever");

exports.runJavaScriptCode = runJavaScriptCode;
exports.loopOverFolder = loopOverFolder;
exports.findAppWithDomain = findAppWithDomain;
exports.start = start;

const domainsPath = "domains/";

const nameEverySecondFolder = "everySecond";
const nameEveryMinuteFolder = "everyMinute";
const nameEveryHourFolder = "everyHour";
const nameOvernightFolder = "overnight";
const namePersistentFolder = "persistent";
const nameConfigFile = "config.json";

var config = {
	minuteToRunHourlyScripts: 0,
	hourToRunOvernightScripts: 0, 
	scriptsFolderPath: "prefs/scripts/",
	localStoragePath: "prefs/localStorage.json",
	portToStartAllocating: 1670,
	maxLogFileSize: 1024 * 100,
	};
var environment = { //supplied by the shell
	};

var nextPortToAllocate;

var localStorage = {
	};

function fileFromPath (f) {
	return (utils.stringLastField (f, "/"));
	}
function folderFromPath (f) {
	var folder = utils.stringPopLastField (f, "/") + "/";
	return (folder);
	}
function folderContains (folder, fname) { //5/18/20 by DW
	if (!utils.endsWith (folder, "/")) {
		folder += "/";
		}
	try {
		fs.statSync (folder + fname);
		return (true);
		}
	catch (err) {
		return (false);
		}
	}
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
function loopOverFolder (folder, fileCallback) {
	if (!utils.endsWith (folder, "/")) {
		folder += "/";
		}
	filesystem.sureFilePath (folder + "x", function () {
		fs.readdir (folder, function (err, theListOfFiles) {
			if (err) {
				console.log ("loopOverFolder: err.message == " + err.message);
				}
			else {
				theListOfFiles.forEach (function (fname) {
					fileCallback (folder + fname);
					});
				}
			});
		});
	}
function runScriptsInFolder (nameSubFolder) {
	const subfolder = config.scriptsFolderPath + nameSubFolder + "/";
	loopOverFolder (subfolder, function (f) {
		if (utils.endsWith (f, ".js")) {
			runJavaScriptCode (f);
			}
		});
	}


//persistent scripts 
	var appInfo = { //each sub-object starts with a config and stats sub-object, name of subobject is full path to app .js file
		};
	
	function addToLogFile (appFile, linetext) { 
		var f = environment.dataFolder + "logs/" + utils.stringPopExtension (fileFromPath (appFile)) + ".txt";
		utils.sureFilePath (f, function () {
			fs.readFile (f, function (err, filetext) {
				if (err) {
					filetext = "";
					}
				filetext = filetext.toString () + linetext.toString ();
				if (filetext.length > config.maxLogFileSize) {
					filetext = utils.stringDelete (filetext, 1, filetext.length - config.maxLogFileSize);
					}
				fs.writeFile (f, filetext, function (err) {
					if (err) {
						console.log ("addToLogFile: err.message == " + err.message + ", f == " + f); //10/19/19 by DW  
						}
					});
				});
			});
		}
	function getAppsFolder () {
		const folder = config.scriptsFolderPath + namePersistentFolder + "/";
		return (folder);
		}
	function findAppWithDomain (domain) {
		domain = utils.stringLower (domain);
		for (var x in appInfo) {
			var item = appInfo [x];
			if (item.stats.domain !== undefined) {
				if (utils.stringLower (item.stats.domain) == domain) {
					return (item.stats.port);
					}
				}
			}
		return (undefined);
		}
	function readAppConfigFile (f, callback) { 
		var fconfig = folderFromPath (f) + nameConfigFile;
		readJsonFile (fconfig, function (appconfig) {
			console.log ("readAppConfigFile: appconfig == " + utils.jsonStringify (appconfig));
			callback (appconfig);
			});
		}
	function launchAppWithForever (f, domain) {
		var appfolder = folderFromPath (f);
		var options = {
			max: 3,
			silent: true,
			sourceDir: appfolder,
			cwd: appfolder,
			env: {
				PORT: nextPortToAllocate++
				},
			args: []
			};
		readAppConfigFile (f, function (theConfig) {
			if (theConfig !== undefined) {
				if (theConfig.forever !== undefined) {
					try {
						for (var x in theConfig.forever) {
							options [x] = theConfig.forever [x];
							}
						}
					catch (err) {
						console.log ("launchAppWithForever: config.forever must be an object.");
						}
					}
				appInfo [f] = {
					config: theConfig,
					stats: {
						appfile: f,
						port: options.env.PORT,
						domain
						}
					};
				}
			var child = new (foreverMonitor.Monitor) (fileFromPath (f), options);
			forever.startServer (child); 
			child.on ('exit', function () {
				console.log (f + " has exited after " + options.max + " restarts.");
				});
			child.on ("error", function (err) {
				console.log (utils.trimWhitespace (err.toString ()));
				});
			child.on ("stdout", function (linetext) { 
				addToLogFile (f, linetext);
				});
			child.on ("stderr", function (data) { 
				console.log (data.toString ());
				});
			child.start ();
			});
		}
	function startPersistentApps () {
		const domainsFolder = environment.serverAppFolder + "/" + domainsPath;
		console.log ("startPersistentApps: domainsFolder == " + domainsFolder);
		loopOverFolder (domainsFolder, function (folder) {
			if (utils.isFolder (folder)) {
				const domain = fileFromPath (folder);
				if (folderContains (folder, "package.json")) {
					if (folderContains (folder, "node_modules")) {
						console.log ("startPersistentApps: folder == " + folder + ", domain == " + domain);
						loopOverFolder (folder, function (f) {
							if (utils.endsWith (f, ".js")) {
								launchAppWithForever (f, domain);
								}
							});
						}
					}
				}
			});
		}

function initChronologicFolders () {
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
	runScriptsInFolder (nameEverySecondFolder);
	writeJsonFile (config.localStoragePath, localStorage);
	}
function everyMinute () {
	var now = new Date ();
	if (now.getMinutes () == config.minuteToRunHourlyScripts) {
		everyHour ();
		}
	runScriptsInFolder (nameEveryMinuteFolder);
	}
function everyHour () {
	var now = new Date ();
	if (now.getHours () == config.hourToRunOvernightScripts) {
		runScriptsInFolder (nameOvernightFolder);
		}
	runScriptsInFolder (nameEveryHourFolder);
	}

function start (env, options, callback) {
	if (env !== undefined) {
		for (var x in env) {
			environment [x] = env [x];
			}
		}
	if (options !== undefined) {
		for (var x in options) {
			config [x] = options [x];
			}
		}
	nextPortToAllocate = config.portToStartAllocating;
	console.log ("\n" + myProductName + " v" + myVersion + ". config == " + utils.jsonStringify (config) + "\n");
	
	if (config.flRunChronologicalScripts) {
		initChronologicFolders ();
		setInterval (everySecond, 1000); 
		utils.runEveryMinute (everyMinute);
		}
	if (config.flRunChronologicalScripts) {
		initChronologicFolders ();
		setInterval (everySecond, 1000); 
		utils.runEveryMinute (everyMinute);
		}
	if (config.flRunPersistentScripts) {
		startPersistentApps ();
		}
	
	initLocalStorage (function () {
		if (callback !== undefined) {
			callback ();
			}
		});
	}
