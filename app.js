var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var redis = require('redis');
var http = require('http');
var url = require('url');

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();
var db = redis.createClient(6379,"192.168.56.11", {'return_buffers': true});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// Add Proxy
//
app.use(function(req, res, next){
        db.exists(req.url, function(err, rexists){
                if(rexists == true){
                    db.lrange(req.url, 0, -1, function(err, list){
                            res.writeHead(list[0], JSON.parse(list[1]));
                            res.write(list[2]);
                            res.end();
                            console.log('Responsed cached contents!!!!!');
                        });
                }
                else{
                    var x = url.parse(req.url);
                    var body = [];
                    req.on('data', function(data){
                            body.push(data);
                        });

                    var options = {host: x.hostname, port: x.port || 80, path: x.path,
                        method: req.method, headers: req.headers };
                    var server_req = http.request(options, function(server_res){
                            res.writeHead(server_res.statusCode, server_res.headers);

                            var bufs = [];
                            bufs.totalLength = 0;
                            server_res.on('data', function(chunk){
                                    bufs.push(chunk);
                                    bufs.totalLength += chunk.length;
                                    res.write(chunk);
                                });
                            server_res.on('end', function(){
                                    var data = Buffer.concat(bufs, bufs.totalLength);

                                    if( server_res.statusCode == 200 ){
                                        db.rpush(req.url, server_res.statusCode);
                                        db.rpush(req.url, JSON.stringify(server_res.headers));
                                        db.rpush(req.url, data);
                                        db.expire(req.url, 100);
                                        console.log('Set cache!!!!!');
                                    }
                                    res.end();
                                });


                        });
                    if(body.length > 0){
                        server_req.write(body.join(''));
                    }
                    server_req.end();
                }
            });
    });



app.use('/', routes);
app.use('/users', users);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
