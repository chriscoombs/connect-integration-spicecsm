/*
 * Test Event:
 *  {
 *    "Details": {
 *      "Parameters": {
 *        "processid: "ping"
 *      }
 *    }
 *  }
 *
 *  Successful Ping Result:
 *  {
 *    "status": "active",
 *    "lambdaResult": "Success"
 *  }
 *
 *  Failed Ping Result:
 *  {
 *    "status": "inactive",
 *    "lambdaResult: "Error"
 *  }
 *
 */

exports.handler = (event, context, returnToFlow) => {

  if (event.ResourceProperties) { // cloud formation ?
    var response = require('cfn-response');
    response.send(event,context,response.SUCCESS,{Value: 'success'}); // tell cloud formation that the function is created ?
    return;
  }

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

      if (params.processid == 'ping' && res.statusCode == 200) { // a successful response from the automated reader ping
        var results = {
          status: 'active',
          lambdaResult: 'Success'
        };
        return returnToFlow(null,results);

      } else if (params.processid == 'ping') { // a failed response from the automated reader ping
        var results = {
          status: 'inactive',
          lambdaResult: "Error",
          errorMessage: 'The Automated Reader is inactive.'
        };
        return returnToFlow(null,results);
      }

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
