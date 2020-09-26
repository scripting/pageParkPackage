var myProductName = "pageParkPackage", myVersion = "0.4.38";   

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
exports.startPersistentApps = startPersistentApps; //7/4/20 by DW
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
	defaultMaxRestarts: 1000000,
	defaultSilent: true
	};
var environment = { //supplied by the shell
	};

var nextPortToAllocate;

var localStorage = {
	};

const whenStart = new Date (); //6/25/20 by DW

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
	function getForeverInfoAboutApp (f, callback) { //6/13/20 by DW
		forever.list (false, function (err, list) {
			if (err) {
				callback (err);
				}
			else {
				var flfound = false;
				list.forEach (function (foreverItem) {
					if (foreverItem.file == f) {
						callback (undefined, foreverItem);
						flfound = true;
						}
					});
				if (!flfound) {
					callback ({"message": "The app wasn't found."});
					}
				}
			});
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
							newItem.ctHits = ourItem.stats.ctHits;
							newItem.whenLastHit = ourItem.stats.whenLastHit;
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
	function findAppWithDomain (domain, flBumpHitCount) {
		var now = new Date ();
		flBumpHitCount = (flBumpHitCount === undefined) ? true : flBumpHitCount; //6/27/20 by DW
		domain = utils.stringLower (domain);
		for (var x in appInfo) {
			var item = appInfo [x];
			if (item.stats.domain !== undefined) {
				const flmatch = utils.endsWith (domain, item.stats.domain);
				if (flmatch) { //7/15/20 by DW -- if (utils.stringLower (item.stats.domain) == domain) {
					if (flBumpHitCount) {
						item.stats.ctHits++;
						item.stats.whenLastHit = now;
						}
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
			appInfo [f] = true; //make sure it's defined immediately -- 6/25/20 by DW
			var appfolder = folderFromPath (f);
			var options = {
				max: config.defaultMaxRestarts,
				silent: config.defaultSilent,
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
						domain,
						ctHits: 0, whenLastHit: new Date (0)
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
				
				try { //6/21/20 by DW -- move all the forever-related stuff into a try
					var child = new (foreverMonitor.Monitor) (fileFromPath (f), options);
					forever.startServer (child); 
					console.log ("launchAppWithForever: domain == " + domain);
					
					child.on ("stdout", function (linetext) { 
						addToLogFile (f, linetext);
						});
					child.on ("stderr", function (data) { 
						addToLogFile (f, "pagePark on stderr: " + data.toString ());
						});
					child.on ("error", function (err) {
						addToLogFile (f, "pagePark on error: " + utils.trimWhitespace (err.toString ()));
						});
					child.on ("exit", function () {
						addToLogFile (f, "pagePark on exit: f == " + f + "\n");
						});
					child.start ();
					theAppInfo.child = child;
					appInfo [f] = theAppInfo;
					}
				catch (err) {
					console.log ("launchAppWithForever: err.message == " + err.message);
					}
				});
			}
		}
	function getMainFromPackageJson (f, callback) { //5/24/20 by DW
		fs.readFile (f, function (err, jsontext) {
			if (err) {
				console.log ("getMainFromPackageJson: f == " + f + ", err.message == " + err.message);
				callback (undefined); 
				}
			else {
				try {
					var jstruct = JSON.parse (jsontext);
					console.log ("getMainFromPackageJson: f == " + f + ", jstruct.main == " + jstruct.main);
					if (jstruct.main === undefined) {
						console.log ("getMainFromPackageJson: f == " + f + ", jstruct == " + utils.jsonStringify (jstruct));
						}
					callback (jstruct.main); 
					}
				catch (err) {
					console.log ("getMainFromPackageJson: f == " + f + ", err.message == " + err.message);
					callback (undefined); 
					}
				}
			});
		}
	function startPersistentApps (callback) { //search the domains folder for apps that aren't yet running and try to launch them
		const domainsFolder = environment.serverAppFolder + "/" + domainsPath;
		var launchList = new Array ();
		loopOverFolder (domainsFolder, function (folder) {
			if (utils.isFolder (folder)) {
				const domain = fileFromPath (folder);
				if (!findAppWithDomain (domain, false)) { //6/27/20 by DW
					if (folderContains (folder, "package.json")) {
						if (folderContains (folder, "node_modules")) {
							getMainFromPackageJson (folder + "/package.json", function (mainval) {
								if (mainval !== undefined) {
									var appfile = folder + "/" + mainval;
									launchAppWithForever (appfile, domain);
									launchList.push ({appfile});
									}
								});
							}
						}
					}
				}
			});
		if (callback !== undefined) {
			callback (launchList);
			}
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
		getForeverInfoAboutApp (f, function (err, foreverInfo) {
			if (err) {
				callback (err);
				}
			else {
				console.log ("restartApp: f == " + f + ", foreverInfo.pid == " + foreverInfo.pid);
				try {
					process.kill (foreverInfo.pid);
					callback (undefined, foreverInfo.pid.toString ())
					}
				catch (err) {
					console.log ("restartApp: err.message == " + err.message);
					callback (err)
					}
				}
			});
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
