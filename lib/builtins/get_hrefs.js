// builtins - links on webpage
// builtin worker that grabs all links from a url

var request = require('request');
var cheerio = require('cheerio');
var url = require('url');
var robots = require('robots');
var robotParser = new robots.RobotsParser();

module.exports = function(id, type, data, callback) {
  // check robots txt first
  var parsedURL = url.parse(data.url);
  var robotsURL = url.resolve(url.format({
    protocol: 'http',
    hostname: parsedURL.hostname
  }), 'robots.txt');

  robotParser.setUrl(robotsURL, function(parser, success) {
    // if the parser did not load the url thats fine, it wont error if we ask it
    request(data.url, function(err, response, body) {
      if (err) {
        callback(err);
      } else {
        console.log(data.url);
        var $ = cheerio.load(body);
        var links = $('a[href]');
        var out = [];
        var counter = 0;
        $(links).each(function(i, l) {
          counter++;
          var link = $(l).attr('href');
          // make it absolute
          var fullURL = url.resolve(data.url, link);
          // now reparse b/c the robots library has a problem with absolute urls
          var parts = url.parse(fullURL);
          parser.canFetch('*', parts.path, function(isOk) {
            counter--;
            if (isOk) {
              out.push(fullURL);
            }

            if (counter <= 0) {
              callback(null, out);
            }
          });
        });
      }
    });
  });
};