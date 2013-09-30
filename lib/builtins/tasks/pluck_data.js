// buildins - pluck data from a webpage
// buildin task that will pluck data from a webpage based on provided selectors

var request = require('request');
var cheerio = require('cheerio');
var url = require('url');

module.exports = function(id, data, callback) {
  // first make sure that there are actual selectors given
  if (!(data.selectors && typeof data.selectors === 'object')) {
    callback(new Error('Invalid selector object given: ' + data.selectors));
  }
  request(data.url, function(err, response, body) {
    if (err) {
      callback(err);
    } else {
      var $ = cheerio.load(body);
      var out = {};
      var keys = Object.keys(data.selectors);
      for (var i = 0; i < keys.length; i++) {
        out[keys[i]] = $(data.selectors[keys[i]]);
      }
      callback(null, out);
    }
  });
};