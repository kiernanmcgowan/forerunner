// builtins - links on webpage
// builtin worker that grabs all links from a url

module.exports = function(titanLocation) {
  if (!titanLocation) {
    console.log('no titanLocation set, defaulting to localhost:21211');
    titanLocation = 'http://localhost:21211';
  }

  var worker = require('../worker');

  worker.registerJobHandler('link_scrape', function(id, data) {
    console.log(id);
    console.log(data);
    worker.finished(id, {links: []});
  });

  worker.start(titanLocation);
};