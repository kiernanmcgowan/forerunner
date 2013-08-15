#!/usr/bin/env node

// example - web crawler worker
// simple, just start the web scrape worker

var worker = require('../../../index').worker;
var fetch_file = require('../../../index').builtin.fetch_file;
var targz = require('../../../index').builtin.targz;

// register a job handler for the scraping
worker.registerJobHandler('fetch_file', fetch_file);
worker.registerJobHandler('targz', targz);

// start the worker
var harbingerLocation = 'http://localhost:21211';
worker.start(harbingerLocation);
