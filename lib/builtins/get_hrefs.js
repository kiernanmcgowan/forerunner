// builtins - links on webpage
// builtin worker that grabs all links from a url

var request = require('request');
var cheerio = require('cheerio');
var url = require('url');

module.exports = function(id, type, data, callback) {
  request(data.url, function(err, response, body) {
    if (err) {
      callback(err);
    } else {
      console.log(data.url);
      var $ = cheerio.load(body);
      var links = $('a[href]');
      var out = [];
      $(links).each(function(i, l) {
        var link = $(l).attr('href');
        // make it absolute
        out.push(url.resolve(data.url, link));
      });
      callback(null, out);
    }
  });
};