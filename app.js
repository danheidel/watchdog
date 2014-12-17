var fs = require('fs');
var async = require('async');
var cheerio = require('cheerio');
var request = require('request');

var configPath = process.argv[2] || 'config.json';
var queryArray = [];

async.series([loadConfig]);

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
        email: parsedData[rep].email,
        sms: parsedData[rep].sms
      };
      queryArray.add(tempPage);
    }

    callback();
  });

}

function queryPage(pageData, callback){

}