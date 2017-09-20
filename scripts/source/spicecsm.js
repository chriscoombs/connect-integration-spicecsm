/*
 * Tests the creation of the Lambda function defined by exports.handler
 * in this file.
 *
 */

exports.quickstart = function(event,context) {

  var response = require('cfn-response');

  if (event.RequestType == 'Create') {
   
    /*
     * The following makes a call to the automated reader on the SpiceCSM
     * corporate site. The Automated Process checks to see if the subdomain/customerid
     * has an automation suite product and if it is active.
     *
     */

    var variables = {
      customerid: '',
      subdomain: ''
    };

    var params = {
      returnType: 'plain',
      processid: '8280',
      variables: variables
    };
    
    var postData = querystring.stringify({
      params: JSON.stringify(params)
    });

    var options = {
      hostname: 'corporate.spicecsm.com',
      port: 443,
      path: '/automatedreader',
      method: 'POST',
      agent: false,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    var req = http.request(options, function(res) {
      var dat = '';
      res.on('data', function(data) {
        dat += data;
      });
      res.on('end', function() {

        /*
         * d: {
         *   subdomain: string with subdomain OR boolean false
         *   ping: boolean true if the subdomain's automated reader is active, false otherwise
         * }
         *
         */
        var d = JSON.parse(dat);
        if (d.subdomain && d.ping) { // user has a spice instance and the automated reader is active
          response.send(event,context,response.SUCCESS,{SpiceCSMSubdomain: d.subdomain});
        
        } else if (d.subdomain && !d.ping) {
          // the automated reader is down, an email was generated and sent to spice support
          response.send(event,context,response.SUCCESS,{SpiceCSMSubdomain: d.subdomain});
        
        } else if (!d.subdomain) { // user does not have a spice instance
          var err = 'You have not purchased a SpiceCSM Automation Suite product. Please purchase one from the AWS Marketplace.';
          console.log(str);
          response.send(event,context,response.FAILED,{SpiceCSMSubdomain: str}); // complete failure
        }

      });
    });

    req.on('error', function(e) {
      var results = {
        lambdaResult: 'Error',
        errorMessage: 'Problem with request: ' + e.message
      };
    });

    req.write(postData);
    req.end();

  } else if (event.RequestType == 'Update') {
    console.log('The validation function is not configured to handle the Update request type');
    response.send(event,context,response.FAILED,{SpiceCSMSubdomain: false, AutomatedReaderPath: false});
  } else if (event.RequestType == 'Delete') {
    console.log('The validation function is not configured to handle the Delete request type');
    response.send(event,context,response.FAILED,{SpiceCSMSubdomain: false, AutomatedReaderPath: false});
  }
 
};

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
    hostname: spiceSubdomain + '.spicecsm.com',
    port: 443,
    path: '/automatedreader',
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
