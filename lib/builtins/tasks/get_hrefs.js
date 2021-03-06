// builtins - links on webpage
// builtin worker that grabs all links from a url

var request = require('request');
var cheerio = require('cheerio');
var _ = require('underscore');
var url = require('url');
var robots = require('robots');
var robotParser = new robots.RobotsParser();

module.exports = function(id, data, callback) {
  // check robots txt first
  var parsedURL = url.parse(data.url);
  var robotsURL = url.resolve(url.format({
    protocol: 'http',
    hostname: parsedURL.hostname
  }), 'robots.txt');
  console.log('fetching robots: ' + robotsURL);

  robotParser.setUrl(robotsURL, function(parser, success) {
    var completedRequest = false;
    // if the parser did not load the url thats fine, it wont error if we ask it
    var crawlDelay = 0;
    if (typeof parser.defaultEntry === 'object' && parser.defaultEntry.crawl_delay) {
      crawlDelay = parser.defaultEntry.crawl_delay;
    }
    if (typeof crawlDelay === 'string') {
      try {
        crawlDelay = parseInt(crawlDelay);
      } catch (err) {
        crawlDelay = null;
      }
    }
    if (typeof crawlDelay !== 'number') {
      console.warn('badly formatted crawl delay for url: ' + data.url);
      crawlDelay = 0;
    }
    // debounce and respect the robots.txt
    setTimeout(function() {
      console.log('requesting url: ' + data.url);
      if (!data.timeout) {
        data.timeout = 0;
      }
      request({url: data.url, timeout: data.timeout}, function(err, response, body) {
        completedRequest = true;
        if (err) {
          callback(err);
        } else {
          var $ = cheerio.load(body);
          var links = $('a[href]');
          var out = [];
          var counter = 0;
          if ($(links).length == 0) {
            return callback(null, {links: out, url: data.url});
          }
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
                out = _.uniq(out);
                // finally add on the crawl delay if exists
                var returnedObject = {links: out, url: data.url};

                callback(null, returnedObject);
              }
            });
          });
        }
      });
    }, crawlDelay * 1000);

  });
};