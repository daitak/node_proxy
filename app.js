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
var db = redis.createClient(6379,"192.168.56.11");

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
        /*
         var ua = req.headers['user-agent'];
         db.zadd('online', Date.now(), ua, next);
         console.log('add timestamp to redis');
         console.log(req.headers['user-agent']);
         */

        /*
        if (db.exists(req.uri)){
            console.log('return cache');
        }
        else {
        */
            var x = url.parse(req.url);
            var body = [];
            req.on('data', function(data){
                    body.push(data);
                });

            var options = {host: x.hostname, port: x.port || 80, path: x.path,
                method: req.method, headers: req.headers };
            var server_req = http.request(options, function(server_res){
                    res.writeHead(server_res.statusCode, server_res.headers);
                    //server_res.pipe(res);
                    server_res.on('data', function(chunk){
                            res.write(chunk);
                        });
                    server_res.on('end', function(){
                            res.end();
                        });
                });
            if(body.length > 0){
                server_req.write(body.join(''));
            }
            server_req.end();
        /*
        }
        */
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
