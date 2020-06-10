var myProductName = "pageParkPackage", myVersion = "0.4.27";   

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
exports.getAppInfo = getAppInfo;
exports.stopApp = stopApp;
exports.restartApp = restartApp;
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

//chronologic scripts
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
	function initChronologicFolders () {
		function doFolder (name) {
			filesystem.sureFilePath (config.scriptsFolderPath + name + "/x");
			}
		doFolder (nameEverySecondFolder);
		doFolder (nameEveryMinuteFolder);
		doFolder (nameEveryHourFolder);
		doFolder (nameOvernightFolder);
		}
//persistent scripts 
	var appInfo = { //each sub-object starts with a config and stats sub-object, name of subobject is full path to app .js file
		};
	
	function getLogFile (f) {
		var f = environment.logsFolder + utils.stringPopExtension (fileFromPath (f)) + ".txt";
		return (f);
		}
	function getAppInfo (callback) { //exported, so higher level code has access to info about the currently-running Node apps
		forever.list (false, function (err, list) {
			if (err) {
				callback (err);
				}
			else {
				var info = new Array ();
				list.forEach (function (foreverItem) {
					var newItem = new Object ();
					for (x in appInfo) {
						if (x == foreverItem.file) {
							var ourItem = appInfo [x];
							newItem.domain = ourItem.stats.domain;
							newItem.port = ourItem.stats.port;
							}
						}
					newItem.ctime = foreverItem.ctime;
					newItem.file = foreverItem.file;
					newItem.ctime = foreverItem.ctime;
					newItem.foreverPid = foreverItem.foreverPid;
					newItem.pid = foreverItem.pid;
					newItem.running = foreverItem.running;
					newItem.restarts = foreverItem.restarts;
					newItem.logfile = getLogFile (foreverItem.file);
					info.push (newItem);
					});
				callback (undefined, info);
				}
			});
		}
	function addToLogFile (appFile, linetext) { 
		var f = getLogFile (appFile);
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
		if (appInfo [f] === undefined) { //5/24/20 by DW
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
				var theAppInfo = {
					config: theConfig,
					stats: {
						appfile: f,
						port: options.env.PORT,
						domain
						}
					};
				if (theConfig !== undefined) {
					if (theConfig.forever !== undefined) { //copy elements of config.forever into options, to be transmitted to forever
						try {
							for (var x in theConfig.forever) {
								options [x] = theConfig.forever [x];
								}
							}
						catch (err) {
							console.log ("launchAppWithForever: config.forever must be an object.");
							}
						}
					theAppInfo.config = theConfig;
					}
				var child = new (foreverMonitor.Monitor) (fileFromPath (f), options);
				forever.startServer (child); 
				console.log ("launchAppWithForever: domain == " + domain);
				child.on ('exit', function () {
					console.log ("child.on.exit: " + f + " has exited.");
					});
				child.on ("error", function (err) {
					console.log ("child.on.error: " + utils.trimWhitespace (err.toString ()));
					});
				child.on ("stdout", function (linetext) { 
					addToLogFile (f, linetext);
					console.log ("child.on.stdout: " + utils.trimWhitespace (linetext.toString ()));
					});
				child.on ("stderr", function (data) { 
					console.log ("child.on.stderr: " + data.toString ());
					});
				child.start ();
				theAppInfo.child = child;
				appInfo [f] = theAppInfo;
				});
			}
		}
	function getMainFromPackageJson (f, callback) { //5/24/20 by DW
		fs.readFile (f, function (err, jsontext) {
			if (err) {
				callback (undefined); 
				}
			else {
				try {
					var jstruct = JSON.parse (jsontext);
					callback (jstruct.main); 
					}
				catch (err) {
					callback (undefined); 
					}
				}
			});
		}
	function startPersistentApps () {
		const domainsFolder = environment.serverAppFolder + "/" + domainsPath;
		loopOverFolder (domainsFolder, function (folder) {
			if (utils.isFolder (folder)) {
				const domain = fileFromPath (folder);
				if (folderContains (folder, "package.json")) {
					if (folderContains (folder, "node_modules")) {
						getMainFromPackageJson (folder + "/package.json", function (mainval) {
							if (mainval !== undefined) {
								var appfile = folder + "/" + mainval;
								launchAppWithForever (appfile, domain);
								}
							else {
								loopOverFolder (folder, function (f) {
									if (utils.endsWith (f, ".js")) {
										launchAppWithForever (f, domain);
										}
									});
								}
							});
						}
					}
				}
			});
		}
	function stopApp (f, callback) { //6/3/20 by DW
		console.log ("stopApp: f == " + f);
		for (x in appInfo) {
			if (x == f) {
				var app = appInfo [x];
				var stophandler = app.child.stop ();
				stophandler.on ("stop", function (param) {
					callback (undefined, "The app has exited.");
					});
					
				app.child.on ("error", function (errorMessage) {
					callback ("The app has failed to stop.");
					});
				}
			}
		}
	function restartApp (f, callback) { //6/3/20 by DW
		console.log ("restartApp: f == " + f);
		for (x in appInfo) {
			if (x == f) {
				var app = appInfo [x];
				app.child.start ();
				console.log ("restartApp: app == " + utils.jsonStringify (app));
				callback (undefined, "The app was restarted.")
				}
			}
		}

function everySecond () {
	if (config.flRunChronologicalScripts) {
		runScriptsInFolder (nameEverySecondFolder);
		}
	writeJsonFile (config.localStoragePath, localStorage);
	}
function everyMinute () {
	var now = new Date ();
	if (now.getMinutes () == config.minuteToRunHourlyScripts) {
		everyHour ();
		}
	if (config.flRunChronologicalScripts) {
		runScriptsInFolder (nameEveryMinuteFolder);
		}
	startPersistentApps (); //launch any that aren't already running --5/24/20 by DW
	}
function everyHour () {
	if (config.flRunChronologicalScripts) {
		var now = new Date ();
		if (now.getHours () == config.hourToRunOvernightScripts) {
			runScriptsInFolder (nameOvernightFolder);
			}
		runScriptsInFolder (nameEveryHourFolder);
		}
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
		}
	if (config.flRunPersistentScripts) {
		startPersistentApps ();
		}
	
	setInterval (everySecond, 1000); 
	utils.runEveryMinute (everyMinute);
	
	initLocalStorage (function () {
		if (callback !== undefined) {
			callback ();
			}
		});
	}
