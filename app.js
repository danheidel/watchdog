var fs = require('fs');
var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var twilio = require('twilio');

var configPath = process.argv[2] || 'config.json';
var twilioPath = process.argv[3] || 'twilio.json';
var queryArray = [];
var twilioClient, twilioSID, twilioToken, twilioNumber;

console.log(__dirname);

async.series([
  loadTwilioData,
  loadConfig,
  initQueries
]);

function loadTwilioData(callback){
  fs.readFile(__dirname + '/' + twilioPath, function(err, data){
    if(err){
      console.error('failed to read Twilio config file');
      process.exit();
    }
    var parsedData = JSON.parse(data);
    twilioSID = parsedData.sid;
    twilioToken = parsedData.token;
    twilioNumber = parsedData.number;
    twilioClient = new twilio.RestClient(twilioSID, twilioToken);
    callback();
  });
}

function loadConfig(callback){
  var fileData;
  fs.readFile(__dirname + '/' + configPath, function(err, data){
    if(err){
      console.error('failed to read config file');
      process.exit();
    }
    var parsedData = JSON.parse(data);
    var globalData = parsedData.global;
    //send immediate global ping to let recipient know watchdog is running
    sendGlobalPing(globalData);
    setInterval(sendGlobalPing, globalData.pingInterval, globalData);
    var serverData = parsedData.servers;

    for(var rep=0;rep<serverData.length;rep++){
      var tempPage = {
        name: serverData[rep].name,
        url: serverData[rep].url,
        interval: serverData[rep].interval,
        errorInterval: serverData[rep].errorInterval,
        email: serverData[rep].email,
        sms: serverData[rep].sms
      };
      queryArray.push(tempPage);
    }
    callback();
  });
}

function sendGlobalPing(globalData){
  console.log('sending global ping');
  twilioClient.sms.messages.create({
    to: globalData.sms,
    from: twilioNumber,
    body: 'watchdog ping from: ' + globalData.instanceName
  }, function(err, reply){
    if(err){
      console.error('there was an error');
      console.log(err);
    } else {
      console.log('sent message, sid: ' + reply.sid);
      console.log('message sent to: ' + globalData.sms);
      console.log('message sent: ' + reply.dateCreated);
    }
  });
}

function initQueries(callback){
  for(var rep=0;rep<queryArray.length;rep++){
    request(queryArray[rep].url, queryResponse.bind(null, queryArray[rep]));
  }
  callback();
}

function queryResponse(query, err, resp){
  if(err || resp.statusCode != 200){
    handleError(query, err, resp);
    setTimeout(request, query.errorInterval * 1000, query.url, queryResponse.bind(null, query));
  } else {
    console.log(query.name);
    console.log(err);
    console.log((resp ? resp.statusCode : 'no response'));
    setTimeout(request, query.interval * 1000, query.url, queryResponse.bind(null, query));
  }
}

function handleError(query, err, resp){
  console.log('error: ' + err);
  twilioClient.sms.messages.create({
    to: query.sms,
    from: twilioNumber,
    body: 'error accessing: ' + query.url
  }, function(err, reply){
    if(err){
      console.error('there was an error');
      console.log(err);
    } else {
      console.log('sent message, sid: ' + reply.sid);
      console.log('message sent to: ' + query.sms);
      console.log('message sent: ' + reply.dateCreated);
    }
  })
}
