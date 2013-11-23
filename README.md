forerunner
===

forerunner is a distributed job queue framework. It consists of a central job queue and a pool of workers that can be configured to take on a wide variety of jobs. Workers can be spun up and down independent of the manager, allowing for your platform to meet your specific demands.

forerunner has a growing set of builtin jobs, the ability to define your own, and the power to composite many jobs together. This flexibility allows for a wide variety of tasks to be undertaken with ease and efficiency.

```
npm install forerunner
```


Basic Example
---

The forerunner platform is made up of two main parts, the manager and the worker pool. They always run as different processes.

```
// manager
var forerunner = require('forerunner').forerunner;

var forerunner = require('forerunner').forerunner;

// basic set up with defaults
// listens on port 2718
forerunner.start();

// post job hook
forerunner.onComplete('ping', function(id, data) {
  console.log('ping\'ed worker with job id: ' + id);
});

// assign a new job to the worker pool
forerunner.assignJob('ping', {foo: 'bar'}, function(err, status) {
  if (err) {
    console.log('failed to add job initial ping job');
  }
});

```


```
// worker
var worker = require('forerunner').worker;
var ping = require('forerunner').builtin.tasks.ping;

worker.registerJobHandler('ping', ping);

// start the worker
var forerunnerLocation = 'http://localhost:2718';
worker.start(forerunnerLocation);
```

Running both of these scripts will results in the manager telling the worker to execute the `get_href` task with a given payload. The job is sent off to the worker which will execute the task and return the results to the manager.


Compositing Jobs
---

Most of the time jobs will be more complicated than simply fetching the links from a web page and will require multiple steps to complete. Workers have the ability to composite job from existing jobs to create increased complexity in a simple manner.

What is powerful about composited jobs is that they are guaranteed to execute in series on a single worker allowing for file manipulation to happen with ease. Composited jobs will fail if any of the steps along the way fail and will return immediately to the manager.

```
// this example will create a new job that will download a set of files
// then tar.gz the result
// and then execute a custom function

var worker = require('forerunner').worker;
// use a builtin task
var fetch = require('forerunner').builtin.fetch;
var targz = require('forerunner').builtin.targz;

// register job handlers as normal
worker.registerJobHandler('fetch', fetch);
worker.registerJobHandler('targz', targz);

// now create a composition
var composedJob = worker.compose([
  // execute the 'fetch' job handler
  'fetch',
  function(id, type, data, callback) {
    // alter the keys of the returned values to match the targz call
    callback(null, {origin: data.destination, destination: data.tarDestination});
  },
  // execute the 'targz' job handler
  'targz',
  function(id, type, data, callback) {
    // ... do some custom logic here
    callback(err, newDataFromCustomLogic);
  }
]);

// then register just like you would normally
worker.registerJobHandler('download_and_archive', composedJob);

```

Custom Jobs
---

Jobs can take on many different shapes and sizes and can be built to what ever your specific tasks require.

A job is a function that has the following pattern:


```
function exampleJob(id, data, callback) {
  // id - the assigned job id
  // data - the job data to work will
  // callback(err, results) - callback to be called when the job is done
  //                        - if err is not falsely then the job will be marked as failed and NO results will be returned to the manager

  // ... Do some mind-bending javascript ...

  callback(null, {results: derp});
}
```


LICENSE
---

<MIT>

Copyright (c) 2013 Kiernan Tim McGowan (dropdownmenu)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

