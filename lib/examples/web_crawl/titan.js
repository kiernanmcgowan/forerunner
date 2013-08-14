#!/usr/bin/env node

// example - titan web crawl

var titan = require('../../../index').titan;

// basic set up
titan.start({}, function() {
  var createJob = function(url) {
    titan.assignJob('link_scrape', {url: url}, function(err, status) {

    });
  };

  titan.preJob('link_scrape', function(id, data) {
    console.log('queued: ' + data.url);
  });

  titan.postJob('link_scrape', function(id, data) {
    console.log('link_scrape is done: ' + id);
    console.log(data);
    for (var i = 0; i < data.length; i++) {
      createJob(data[i]);
    }
  });

  createJob('http://news.ycombinator.com');

});