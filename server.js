#!/usr/bin/env node
/**
 * Copyright 2020 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 **/
/**
 * forked and modified by coderwessel
 **/

const fs = require('fs');
const match = require('@menadevs/objectron');
const stringify = require('csv-stringify');
const option = {"verbose":1, "uniquedomain":2};
Object.freeze(option);
const fsroot = ".";
const uploadpath = "/uploads";
const port=3000;


var express =   require("express");
var multer  =   require('multer');
var bodyParser = require('body-parser');
var app       =   express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, `${fsroot}${uploadpath}`);
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + '-' + Date.now());
  }
});
var upload = multer({ storage : storage}).single('harfile');

app.post('/har',function(req,res){
    upload(req,res,function(err) {
        if(err) {
            return res.end(`Error uploading file: ${err}`);
        }
        const uploadedFileName = req.file.filename;
        const uploadedFilePath = `${fsroot}${uploadpath}/${uploadedFileName}`;
        const harFileText = fs.readFileSync(uploadedFilePath);
        console.log(`File is uploaded as ${uploadedFilePath}`);
        const formattedEntries = evaluateHarFileText(harFileText, option.uniquedomain);
        if (formattedEntries != null) stringify(formattedEntries, function(err, output) {
            res.json({csv: output});

          });
          try {
            fs.unlinkSync(uploadedFilePath)
            console.log(`File is deleted: as ${uploadedFilePath}`)
          } catch(err) {
            console.error(`Error deleting file (${uploadedFilePath}): ${err}`);
          }

    });
});

app.get('/',function(req,res){
  res.sendFile('index.html', { root: '.' });
});
 
app.listen(port,function(){
    console.log(`App working on port ${port}`);
});

function evaluateHarFileText(harFileText, modus){
  const harFile = JSON.parse(harFileText);

  let flatEntries = [];
  
  if(harFile.log && harFile.log.entries) {
    harFile.log.entries.forEach((entry, entryIndex) => {
      const currentEntry = evaluateHarEntry(entry);

      if(currentEntry.match) {
        const flatEntry = {
          ...currentEntry.groups,
          ...currentEntry.matches.timings
        };

        if (entryIndex === 0) {
          flatEntries.push(Object.keys(flatEntry));
        }

        flatEntries.push(Object.values(flatEntry));
      }
    });

    let formattedEntries = [];
    if (modus == option.uniquedomain){
      let site = flatEntries[1][3];
      flatEntries.forEach( (harEntry, index) =>{
        if (index==0)return;
        //console.log(harEntry[3]); 
        let domain = (new URL(harEntry[3]));
        let domainString = domain.hostname;
        //console.log(harEntry[3]+ ", "+domainString+", "+typeof(domainString));
        if (!formattedEntries.some(r => r.includes(domainString))) formattedEntries.push([domainString, site]);
      });
      //console.log(formattedEntries);
    }
    else formattedEntries = [...flatEntries];
    return formattedEntries;
  } else {
    console.error('Invalid HAR file!');
    return null;
  }
}

function evaluateHarEntry(harEntry) {
  const baseEntryPattern = {
    pageref: /(?<pageRef>page_\d+)/,
    startedDateTime: /(?<startedDateTime>.*)/,
    request: {
      method: /(?<requestMethod>GET|POST)/,
      url: /(?<requestUrl>https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/,
      httpVersion: /(?<requestHttpVersion>.*)/,
      headersSize: /^(?<requestHeaderSize>\-?(\d+\.?\d*|\d*\.?\d+))$/,
      bodySize: /^(?<requestHeaderSize>\-?(\d+\.?\d*|\d*\.?\d+))$/,
    },
    response: {
      status: /^(?<responseStatus>[0-9]{3})/,
      content: {
        size: /^(?<responseContentSize>\-?(\d+\.?\d*|\d*\.?\d+))$/,
      },
      headers: [
        { name: /content-type/i, value: /(?<responseContentType>.*)/ },
        { name: /content-length/i, value: /(?<responseContentLength>.*)/ },
        { name: /cache-control/i, value: /(?<responseCacheControl>.*)/ },
      ]
    },
    timings: (val) => val,
    time: /^(?<time>\-?(\d+\.?\d*|\d*\.?\d+))$/
  };

  return match(harEntry, baseEntryPattern);
}