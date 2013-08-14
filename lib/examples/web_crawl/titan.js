#!/usr/bin/env node

// example - titan web crawl

var titan = require('../../../index').titan;

// basic set up
titan.start({}, function() {
  titan.postJob('link_scrape', function(id, data) {
    console.log('link_scrape is done: ' + id);
    console.log(data);
  });
  titan.assignJob('link_scrape', {url: 'http://news.ycombinator.com'}, function(err, status) {

  });
});