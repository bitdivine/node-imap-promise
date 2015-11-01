var Promise = require('bluebird'),
    Imap    = require('imap'),
    fs      = require('fs'),
    util    = require('util'),
    base64  = require('base64-stream');

module.exports=ImapPromises;

util.inherits(ImapPromises,Imap);
function ImapPromises(account_details){Imap.call(this,account_details);}

ImapPromises.prototype.connectAsync = connectAsync;
ImapPromises.prototype.openBoxAsync = openBoxAsync;
ImapPromises.prototype.getMailAsync = getMailAsync;
ImapPromises.prototype.collectEmail = collectEmail;
ImapPromises.prototype.findAttachments = findAttachments;
ImapPromises.prototype.downloadAttachment = downloadAttachment;

////////// Connect && open mailbox: //////////////////
function connectAsync(){
	imap = this;
	return new Promise(function(yay,nay){
		imap.on('ready',yay);
		imap.connect();
	});
}
function openBoxAsync(name,readOnly){
	var imap = this;
	return new Promise(function(yay,nay){
		imap.openBox(name,readOnly,function(err,mailbox){if(err)nay(err);else yay(mailbox);});
	});
}
///////// Assemble message from a thousand tiny shards: ///////////////////
function getMailAsync(request,process){return collect_events(request,"message","error","end",process||collectEmail);}
function collect_events(thing,good,bad,end,munch){ // Collect a sequence of events, munching them as you go if you wish.
	return new Promise(function(yay,nay){
		var ans = [];
		thing.on(good,function(){var args = [].slice.call(arguments);ans.push(munch?munch.apply(null,args):args);});
		if (bad) thing.on(bad,nay);
		thing.on(end, function(){Promise.all(ans).then(yay);});
	});
}
function collectEmail(msg,seq){
	return Promise.props(
	{ seq:	// Message sequence number:
		seq
	, body:	// An array of body parts:
		collect_events(msg,"body","error","end", collectBody)
	, attributes: collect_events(msg,"attributes","error","end")
		// There is only one attributes field
		.then(function(x){return (x&&x.length)?x[0][0]:null;})
	});
}
function collectBody(stream,info){
	return Promise.props(
	{ data: collect_events(stream,"data","error","end")
		.then(function(bits){return bits.map(function(c){return c.toString('utf8');}).join('');})
	, info: info
	});
}
// The attachment handling is mostly due to "devotis": https://github.com/mscdex/node-imap/issues/407
function findAttachments(msg){return (msg.attributes&&msg.attributes.struct)?findAttachmentParts(msg.attributes.struct):[];}
function findAttachmentParts(struct, attachments) { // https://github.com/mscdex/node-imap/issues/407
  attachments = attachments ||  [];
  for (var i = 0, len = struct.length, r; i < len; ++i) {
    if (Array.isArray(struct[i])) {
      findAttachmentParts(struct[i], attachments);
    } else {
      if (struct[i].disposition && ['INLINE', 'ATTACHMENT'].indexOf(struct[i].disposition.type) > -1) {
        attachments.push(struct[i]);
      }
    }
  }
  return attachments;
}
function downloadAttachment(imap,email_uid,attachment,filename){
	filename = filename || attachment.params.name;
	var encoding = attachment.encoding;
	var request = imap.fetch(email_uid , {
            bodies: [attachment.partID],
            struct: true
          });
	return collect_events(request,'message','error','end',
		function (msg, seqno) {
		var prefix = '(#' + seqno + ') ';
		return collect_events(msg,'body','err','end',
			function(stream, info) {
			//Create a write stream so that we can stream the attachment to file;
			console.log(prefix + 'Streaming this attachment to file', filename, info);
			var writeStream = fs.createWriteStream(filename);
			writeStream.on('finish', function() {
				console.log(prefix + 'Done writing to file %s', filename);
			});
			if (encoding === 'BASE64') {
				//the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
				stream.pipe(base64.decode()).pipe(writeStream);
			} else  {
				//here we have none or some other decoding streamed directly to the file which renders it useless probably
				stream.pipe(writeStream);
			}
		});
	});
}


