var redis = require('redis');
var http = require('http');
var url = require('url');

var ONE_DAY = 86400;

var DEFAULTS = {
    expire:   ONE_DAY,
    host:     "127.0.0.1",
    port:     6379,
};

var defaults = function(options, defaults){
    if (typeof defaults !== "object" || typeof options !== "object") return;
    for (var d in defaults){
        if (defaults.hasOwnProperty(d) && !options.hasOwnProperty(d))
            options[d] = defaults[d];
    }
}

var responseFromCache = function(req, res, db){
    db.lrange(req.url, 0, -1, function(err, list){
            if (err) console.log(err);
            res.writeHead(list[0], JSON.parse(list[1]));
            res.write(list[2]);
            res.end();
            console.log('Responsed cached contents!!!!!');
        });
};

var cacheResponse = function(req, res, bufs, db, options){
    var data = Buffer.concat(bufs, bufs.totalLength);
    if( res.statusCode == 200 ){
        db.rpush(req.url, res.statusCode);
        db.rpush(req.url, JSON.stringify(res.headers));
        db.rpush(req.url, data);
        db.expire(req.url, options.expire);
        console.log('Set cache!!!!!');
    }
};

var responseFromWeb = function(req, res, db, options){
    var x = url.parse(req.url);
    var body = [];
    req.on('data', function(data){
            body.push(data);
        });

    var req_options = {host: x.hostname, port: x.port || 80, path: x.path,
        method: req.method, headers: req.headers };
    var server_req = http.request(req_options, function(server_res){
            res.writeHead(server_res.statusCode, server_res.headers);

            var bufs = [];
            bufs.totalLength = 0;
            server_res.on('data', function(chunk){
                    bufs.push(chunk);
                    bufs.totalLength += chunk.length;
                    res.write(chunk);
                });
            server_res.on('end', function(){
                    cacheResponse(req, server_res, bufs, db, options);
                    res.end();
                });
        });
    if(body.length > 0){
        server_req.write(body.join(''));
    }
    server_req.end();
}

exports.proxy = function(options){

	options = (options || {});
	defaults(options, DEFAULTS);

	var db = redis.createClient(options.port,options.host, {'return_buffers': true});
	db.on("error", function(err) {
			console.log(err);
			});

	return function(req, res, next){
		if(req.headers["proxy-request"]){
                        request_line = req.headers["proxy-request"].split(" ");
			req.url = request_line[1];
		}

		db.exists(req.url, function(err, rexists){
			if (err) console.log(err);
			if(rexists == true){
				responseFromCache(req, res, db);
			}
			else{
				responseFromWeb(req, res, db, options);
			}
		});
	};
}
