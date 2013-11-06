// ping.js
// job for a worker
// meant to help debug network connections and the like

module.exports = function(id, data, callback) {
  console.log('PING');
  console.log(JSON.stringify(data, null, 2));
  process.nextTick(function() {
    callback(null, {ack: 'PONG'});
  });
};