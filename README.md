forerunner
===

[![Build Status](https://travis-ci.org/dropdownmenu/forerunner.png?branch=master)](https://travis-ci.org/dropdownmenu/forerunner)

Forerunner is a distributed job queue framework. It consists of a central job queue and a pool of workers that can be configured to take on a wide variety of jobs. Workers can be spun up and down independent of the manager, allowing your platform to meet your specific demands.

```
npm install forerunner
```


Forerunner Overview
---

![Forerunner System Overview](https://raw.githubusercontent.com/dropdownmenu/forerunner/master/img/basic_forerunner.jpg)

Forerunner is made up of four main parts. They are the [manager](https://github.com/dropdownmenu/forerunner/wiki/Manager), [worker](https://github.com/dropdownmenu/forerunner/wiki/Worker), [store](https://github.com/dropdownmenu/forerunner/wiki/Store), and [queue](https://github.com/dropdownmenu/forerunner/wiki/Queue). More detailed information can be found in the [wiki](https://github.com/dropdownmenu/forerunner/wiki).

### Manager

The manager is the centerpiece of forerunner. It is responsible for having a publicly facing API, assigning jobs to workers, and routing jobs between the store and queue.

###  Worker

Worker processes are where the majority of your custom code is going to live.

A worker is a simple process that tries to run a set of predefined tasks (functions) in series for a given job. If all the tasks succeed, then the result of the callback is sent to the manager and the job is marked as complete. Otherwise, if an error is thrown or returned in a callback, then the error is returned to the manager, with the job optionally being re-queued for later processing.

### Store

The store is where the state of all jobs are recorded as they are processed by forerunner. It has a few methods that the manager calls to get or set data, and it is relatively straight forward in function.

Forerunner comes with an in-memory store for testing that should not be used for production. There is an store implementation for [postgres](https://github.com/dropdownmenu/forerunner-postgres-store). You can also build your own custom store. If your store passes the [store test suite](https://github.com/dropdownmenu/forerunner-store-tests), then it will work with the forerunner system.

### Queue

The queue is ephemeral and responsible for managing the order of jobs as they are sent out to workers. Queues can be simple FIFO, random sampled, or weighted against some function that determines importance.

Forerunner comes with an in-memory queue for testing that should not be used for production. There is a FIFO queue implementation for [redis](https://github.com/dropdownmenu/forerunner-redis-queue). You can also build your own custom queue. If your queue passes the [queue test suite](https://github.com/dropdownmenu/forerunner-queue-tests) then it will work with the forerunner system.

Basic Example
---

The forerunner platform is made up of two main pieces, the manager and the worker pool. They always run as different processes.

```
// manager
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

Running both of these scripts will result in the manager telling the worker to execute the `ping` task with a given payload. The job is sent off to the worker which executes the task and returns the results to the manager.


Compositing Jobs
---

Jobs are often complicated and require multiple steps to complete. Workers have the ability to composite jobs from existing jobs to create more complex jobs in a simple manner.

What is powerful about composited jobs is that they are guaranteed to execute in series on a single worker, which makes them very predictable and easy to work with. Composited jobs will fail if any of the steps along the way fail and will return immediately to the manager.

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
  function(id, data, callback) {
    // alter the keys of the returned values to match the targz call
    callback(null, {origin: data.destination, destination: data.tarDestination});
  },
  // execute the 'targz' job handler
  'targz',
  function(id, data, callback) {
    // ... do some custom logic here
    callback(err, newDataFromCustomLogic);
  }
]);

// then register just like you would normally
worker.registerJobHandler('download_and_archive', composedJob);

```

Custom Jobs
---

Jobs can take on many different shapes and sizes and can be created for whatever your specific requirements are.

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

