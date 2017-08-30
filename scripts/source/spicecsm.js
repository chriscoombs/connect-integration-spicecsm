exports.handler = (event, context, returnToFlow) => {
    var querystring = require('querystring');
    var http = require('https');
    var variables = {};
    var processid;

    if (event.Details && event.Details.Parameters) {
        if (event.Details.Parameters.processid) {
            processid = event.Details.Parameters.processid;
            for (var i in event.Details.Parameters) {
                if (i == 'processid')
                    continue;
                variables[i] = event.Details.Parameters[i];
            }
        } else {
            var results = {
                lambdaResult: 'Error',
                errorMessage: 'The "processid" is not specified as a parameter to the lambda function.'
            };
            return returnToFlow(null, results);
        }
    } else {
        var results = {
            lambdaResult: 'Error',
            errorMessage: 'There were no parameters specified. The "processid" parameter is required.'
        };
        return returnToFlow(null, results);
    }

    var params = {
        returnType: 'plain',
        processid: processid,
        variables: variables
    };
    console.log(params); // for cloud watch
    var postData = querystring.stringify({
        params: JSON.stringify(params)
    });

    var options = {
        hostname: spiceCustomerName + '.spicecsm.com',
        port: 443,
        path: automatedReaderPath,
        method: 'POST',
        agent: false,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    var req = http.request(options, function(res) {
        var dat = '';
        res.on('data', function(data) {
            dat += data;
        });
        res.on('end', function() {
            console.log(dat); // for cloud watch
            var d = JSON.parse(dat);
            var results = {
                log: d.log,
                path: d.path,
                processid: d.processid,
                filename: d.filename,
                filepath: d.filepath,
                lambdaResult: "Success"
            };

            if (d.variables && (d.variables.constructor == Array || d.variables.constructor == Object)) {
                for (var i in d.variables) {
                    if (!results[i])
                        results[i] = d.variables[i];
                }
            }
            returnToFlow(null, results);
        });
    });

    req.on('error', function(e) {
        var results = {
            lambdaResult: 'Error',
            errorMessage: 'Problem with request: ' + e.message
        };
        returnToFlow(null, results);
    });

    req.write(postData);
    req.end();
};
