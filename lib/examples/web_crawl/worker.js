#!/usr/bin/env node

// example - web crawler worker
// simple, just start the web scrape worker

var link_scrape = require('../../../index').worker.link_scrape;
// start the worker
link_scrape();