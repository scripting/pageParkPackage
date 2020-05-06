var whenstart = new Date ();
console.log (new Date ().toLocaleString () + ": " + noderunner.unixShellCommand ("pwd"));
localStorage.runShellScript = {
	when: new Date ().toLocaleString (),
	howLongSecs: noderunner.utils.secondsSince (whenstart)
	};
