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
const commander = require('commander');
const option = {"verbose":1, "uniquedomain":2};
Object.freeze(option);

commander
 .arguments('<harInputPath> <harOutputPath> <options>')
 .action(run)
 .parse(process.argv);

function run(harInputPath, harOutputPath, options) {
  const harFileText = fs.readFileSync(harInputPath);
  const harFile = JSON.parse(harFileText);

  let flatEntries = [];
  let modus = (options == "d")? option.uniquedomain : option.verbose;

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
      flatEntries.forEach( (harEntry, index) =>{
        if (index==0)return;
        //console.log(harEntry[3]); 
        let domain = (new URL(harEntry[3]));
        let domainString = domain.hostname;
        //console.log(harEntry[3]+ ", "+domainString+", "+typeof(domainString));
        if (!formattedEntries.some(r => r.includes(domainString))) formattedEntries.push([domainString]);
      });
      //console.log(formattedEntries);
    }
    else formattedEntries = [...flatEntries];

    stringify(formattedEntries, function(err, output) {
      console.log(output);
      fs.writeFile(harOutputPath, output, function (err) {
        if (err) return console.log(err);
      });
    });
  } else {
    console.error('Invalid HAR file!');
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

