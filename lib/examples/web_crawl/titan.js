#!/usr/bin/env node

// example - titan web crawl

var titan = require('../../../index').titan;

// basic set up
titan.start({}, function() {
  titan.assignJob('link_scrape', {url: 'http://news.ycombinator.com'}, function(err, status) {
    console.log('job added results');
    console.log(err);
    console.log(status);
  });
});