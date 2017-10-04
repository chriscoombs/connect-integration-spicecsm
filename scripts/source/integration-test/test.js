/*
 * Tests the creation of the Lambda function defined by exports.handler
 * in this file.
 *
 */

var send = function(event, context, responseStatus, responseData, physicalResourceId) {

  var responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  });

  console.log("Response body:\n", responseBody);

  var https = require("https");
  var url = require("url");

  var parsedUrl = url.parse(event.ResponseURL);
  var options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "content-type": "",
      "content-length": responseBody.length
    }
  };

  var request = https.request(options, function(response) {
    console.log("Status code: " + response.statusCode);
    console.log("Status message: " + response.statusMessage);
    context.done();
  });

  request.on("error", function(error) {
    console.log("send(..) failed executing https.request(..): " + error);
    context.done();
  });

  request.write(responseBody);
  request.end();
}

exports.quickstart = function(event,context) {

  console.log(event); // cloud watch

  if (event.RequestType == 'Create') {

    try {

      var subdomain = null;
      if (event.ResourceProperties && event.ResourceProperties.SpiceCSMSubdomain)
        subdomain = event.ResourceProperties.SpiceCSMSubdomain;

      var variables = {
        subdomain: subdomain
      };

      var querystring = require('querystring');
      var http = require('https');

      var postData = querystring.stringify(variables);

      var options = {
        hostname: 'corporate.spicecsm.com',
        port: 443,
        path: '/abstracted/Frictionless/aws/quickstart/CheckActiveSubdomain.php',
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

          console.log(dat); // cloud watch

          /*
           * d: {
           *   subdomain: boolean
           *   ping: boolean 
           * }
           *
           */
          var d = JSON.parse(dat);
          if (d.subdomain && d.ping) { // user has a spice instance and the automated reader is active
            send(event,context,"SUCCESS",{SpiceCSMSubdomain: d.subdomain});

          } else if (d.subdomain && !d.ping) {
            // the automated reader is down, an email was generated and sent to spice support
            send(event,context,"SUCCESS",{SpiceCSMSubdomain: d.subdomain});

          } else if (!d.subdomain) { // subdomain does not have a spice instance or does not have access to the automated reader
            var err = 'You have not purchased a SpiceCSM Automation Suite product. Please purchase one from the AWS Marketplace.';
            console.log(err);
            send(event,context,"FAILED",{SpiceCSMSubdomain: err}); // complete failure
          }

        });
      });

      req.on('error', function(e) {
        var results = {
          lambdaResult: 'Error',
          errorMessage: 'Problem with request: ' + e.message
        };
        send(event,context,"FAILED",{SpiceCSMSubdomain: results.errorMessage});
      });

      req.write(postData);
      req.end();

    } catch(e) {
      console.log('JavaScript Error: '+e.message);
      send(event,context,"FAILED",{SpiceCSMSubdomain: "JavaScript Error: "+e.message});
    }

  } else if (event.RequestType == 'Update') {
    console.log('The validation function is not configured to handle the Update request type');
    send(event,context,"SUCCESS",{SpiceCSMSubdomain: false});
  } else if (event.RequestType == 'Delete') {
    console.log('The validation function is not configured to handle the Delete request type');
    send(event,context,"SUCCESS",{SpiceCSMSubdomain: false});
  }
 
};
