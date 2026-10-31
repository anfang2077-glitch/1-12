'use strict';

const crypto = require('crypto');

/** 为每个请求生成 requestId，写入响应头便于排错 */
function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const value =
    typeof incoming === 'string' && incoming.trim() !== '' && incoming.length <= 100
      ? incoming.trim()
      : crypto.randomUUID();
  req.requestId = value;
  res.setHeader('X-Request-Id', value);
  next();
}

module.exports = { requestId };
