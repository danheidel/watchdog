var fs = require('fs');
var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var twilio = require('twilio');
var nodemailer = require('nodemailer');

var emailPath = process.argv[2] || 'email.json';
var configPath = process.argv[3] || 'config.json';
var twilioPath = process.argv[4] || 'twilio.json';
var queryArray = [];
var globalData;
var twilioClient, twilioSID, twilioToken, twilioNumber;
var emailTransporter, emailUser;

console.log(__dirname);

async.series([
  loadEmailData,
  loadTwilioData,
  loadConfig,
  initQueries
]);

function loadEmailData(callback){
  fs.readFile(__dirname + '/' + emailPath, function(err, data){
    if(err){
      console.error('failed to read email configuration file');
      process.exit();
    }
    var parsedData = JSON.parse(data);
    emailUser = parsedData.auth.user;
    var transportOptions = {
      service: parsedData.service,
      auth: {
        user: emailUser,
        pass: parsedData.auth.password
      }
    }
    console.log(transportOptions);
    emailTransporter = nodemailer.createTransport(transportOptions);
    callback();
  })
}

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
    globalData = parsedData.global;
    //send immediate global ping to let recipient know watchdog is running
    sendGlobalPing();
    setInterval(sendGlobalPing, globalData.pingInterval);
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

function sendGlobalPing(){
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
      console.log('sent sms, sid: ' + reply.sid);
      console.log('message sent to: ' + globalData.sms);
      console.log('message sent: ' + reply.dateCreated);
    }
  });
  emailTransporter.sendMail({
      from: 'watchdog process' + emailUser,
      to: globalData.email,
      subject: 'watchdog heartbeat ping from: ' + globalData.instanceName,
      text: 'Ping to let you know the watchdog process is still active'
    }, function(err, info){
    if(err){
      console.error(err);
    } else {
      console.log('email sent ' + info.response);
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
    body: 'error accessing: ' + query.url + ' from: ' + globalData.instanceName
  }, function(err, reply){
    if(err){
      console.error('there was an error');
      console.log(err);
    } else {
      console.log('sent sms, sid: ' + reply.sid);
      console.log('message sent to: ' + query.sms);
      console.log('message sent: ' + reply.dateCreated);
    }
  });
  emailTransporter.sendMail({
    from: 'watchdog process' + emailUser,
    to: query.email,
    subject: 'watchdog error from: ' + globalData.instanceName,
    text: 'watchdog could not access website at: ' + query.url + ' from: ' + globalData.instanceName
  }, function(err, info){
    if(err){
      console.error(err);
    } else {
      console.log('email sent' + info.response);
    }
  })
}
