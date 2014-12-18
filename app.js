var fs = require('fs');
var async = require('async');
var cheerio = require('cheerio');
var request = require('request');

var configPath = process.argv[2] || 'config.json';
var queryArray = [];

async.series([
  loadConfig,
  initQueries
]);

function loadConfig(callback){
  var fileData;
  fs.readFile(configPath, function(err, data){
    if(err){
      console.error('failed to read config file');
      process.exit();
    }
    var parsedData = JSON.parse(data);
    for(var rep=0;rep<parsedData.length;rep++){
      var tempPage = {
        name: parsedData[rep].name,
        url: parsedData[rep].url,
        interval: parsedData[rep].interval,
        errorInterval: parsedData[rep].errorInterval,
        email: parsedData[rep].email,
        sms: parsedData[rep].sms,
        startTime: new Date()
      };
      queryArray.push(tempPage);
    }

    callback();
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
  }

  console.log(query);
  console.log(err);
  console.log((resp ? resp.statusCode : 'no response'));

}

function handleError(query, err, resp){
  console.log('error: ' + err);
}