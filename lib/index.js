var cluster = require('cluster')
  , os = require('os')
  , fs = require('fs')
  , path = require('path')
  , http = require('http')
  , _ = require('lodash')
  , util = require('./util')
  , basename = path.basename;

// Starts either a server or client depending on whether this is a master or
// worker cluster process
exports = module.exports = function(options) {
    var port = options.port || process.env.PORT || 3000;
    var hostname = options.hostname || process.env.NODE_HOSTNAME || undefined;

    if(!options.phantomBasePort) {
        options.phantomBasePort = process.env.PHANTOM_CLUSTER_BASE_PORT || 12300;
    }

    var server = require('./server');
    options.isMaster = cluster.isMaster;
    options.worker = cluster.worker;
    server.init(options);

    if(cluster.isMaster) {

        for (var i = 0; i < (options.workers || os.cpus().length); i += 1) {
            util.log('starting worker thread #' + i);
            cluster.fork();
        }

        cluster.on('exit', function (worker, code, signal) {
            util.log('worker ' + worker.id + ' died, restarting! (pid: '+worker.process.pid+', signal: '+(signal || code)+')');
            try {
               //not happy with this... but when phantomjs is hanging, it can't exit any normal way
               util.log('pkilling phantomjs');
               require('child_process').spawn('pkill', ['phantomjs']);
           } catch(e) {
               util.log('Error killing phantomjs from javascript infinite loop:', e);
           }
            cluster.fork();
        });
    } else {
        var httpServer = http.createServer(_.bind(server.onRequest, server));

        httpServer.listen(port, hostname, function () {
            util.log('Server running on port ' + port);
        });
    }

    return server;
};

fs.readdirSync(__dirname + '/plugins').forEach(function(filename){
    if (!/\.js$/.test(filename)) return;
    var name = basename(filename, '.js');
    function load(){ return require('./plugins/' + name); }
    Object.defineProperty(exports, name, {value: load});
});
