var IPromise = require('./ImapPromise')
  , Promise  = require('bluebird');

// Panda looks after his password:
var myMostPrivateDetails = require('./private/credentials');

var imap = new IPromise(myMostPrivateDetails);
imap.connectAsync()
.then(function(){console.log('connected');})
.then(function(){return imap.openBoxAsync('INBOX',true);})
.then(function(box){
	// Panda wants his last 3 emails:
	// Emails are numbered.  See: https://github.com/mscdex/node-imap#api
	return imap.getMailAsync(imap.seq.fetch([box.messages.total-3,box.messages.total].map(String).join(':'), {
		bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
		struct: true
	}), function(message){
		// For each e-mail:
		return (imap.collectEmail(message)
			.then(function(msg){
				// Panda also wants to download any pictures of bamboo shoots attached to those e-mails:
				msg.attachments = imap.findAttachments(msg);
				msg.downloads = Promise.all(msg.attachments.map(function(attachment){
					var email_id = msg.attributes.uid;
					var save_as_filename = attachment.params.name;
					return imap.downloadAttachment(email_id, attachment, save_as_filename);
				}));
				return Promise.props(msg);
			})
		);
	});
})
.then(function(messages){
	console.log(JSON.stringify(messages,null,2));
})
.catch(function(error){console.error("Oops:", error.message);})
.then(process.exit.bind(process,0));



