var PipeStream = require('pipestream');
var util = require('../util');
var config = util.config;

function addErrorEvents(req, res) {
	var clientReq, clientRes;
	req.on('dest', function(_req) {
		clientReq = _req.on('error', abortRes);
	}).on('error', abortReq)
	.on('close', abortReq);
	res.on('src', function(_res) {
		clientRes = _res.on('error', abortRes);
	}).on('error', abortReq);
	
	function abortReq() {
		clientReq && clientReq.abort();
		clientReq = null;
	}
	
	function abortRes() {
		res && res.destroy();
		res = null;
	}
}

function addTransforms(req, res) {
	var reqTextPipeStream, resZipPipeStream, resIconvPipeStream;
	
	req.addTextTransform = function(transform) {
		if (!reqTextPipeStream) {
			reqTextPipeStream = util.getPipeIconvStream(req.headers, true);
			req.add(reqTextPipeStream);
		}
		reqTextPipeStream.add(transform);
		return req;
	};
	
	res.addZipTransform = function(transform) {
		if (!resZipPipeStream) {
			resZipPipeStream = new PipeStream();
			res.add(function(src, next) {
				var pipeZipStream = util.getPipeZipStream(res.headers);
				pipeZipStream.addHead(resZipPipeStream);
				if (resIconvPipeStream) {
					var pipeIconvStream = util.getPipeIconvStream(res.headers);
					pipeIconvStream.add(resIconvPipeStream);
					pipeZipStream.add(pipeIconvStream);
				}
				next(src.pipe(pipeZipStream));
			});
		}
		resZipPipeStream.add(transform);
		return res;
	};
	res.addTextTransform = function(transform) {
		if (!resIconvPipeStream) {
			resIconvPipeStream = new PipeStream();
		}
		resIconvPipeStream.add(transform);
		return res;
	};
}

module.exports = function(req, res, next) {
	PipeStream.wrapSrc(req);
	PipeStream.wrapDest(res);
	addTransforms(req, res);
	addErrorEvents(req, res);
	next();
};