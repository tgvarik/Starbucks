const MD5 = require('md5');

module.exports = function(client_key, client_secret, timestamp) {
	const str = `${client_key}${client_secret}${timestamp}`
	return MD5(str);
};