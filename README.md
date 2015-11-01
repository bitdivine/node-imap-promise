imap-promise
============

This is (node-imap)[https://github.com/mscdex/node-imap] with a promise API.  There is a (demo)[demo.js].


## Installation:
    npm install imap-promise

## Usage:

	var IPromise = require('imap-promise');
	var myMostPrivateDetails = {user:'me@myhome.com',password:'fiddle',host:'mail.myhome.com'};
	var imap = new IPromise(myMostPrivateDetails);
	imap.connectAsync()
	.then(function(){console.log('connected');})
	.then(function(){return imap.openBoxAsync('INBOX',true);})
	.then(function(box){
		// Panda wants his first 3 emails:
		// Emails are numbered.  See: https://github.com/mscdex/node-imap#api
		return imap.getMailAsync('1:3', {
			bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
			struct: true
		}), function(message){
			// For each e-mail:
			return imap.collectEmailAsync(message);
		});
	})
	.then(function(messages){
		console.log(JSON.stringify(messages,null,2));
	})
	.catch(function(error){console.error("Oops:", error.message);})
	.then(process.exit.bind(process,0));

