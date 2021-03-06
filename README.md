# Medic Mobile

These instructions should help you get setup to run or develop on Medic Mobile.
For latest changes and release announcements see the [change log](Changes.md).

## Overview

Medic Mobile combines messaging, data collection, and analytics for health workers and health systems in hard-to-reach areas with or without internet connectivity.

The `medic-webapp` repository is the core application in the Medic Mobile stack. When health workers submit data using text messages (SMS), our mobile or our SIM applications, the web app confirms data submission, generates unique IDs, and schedules automated reminder messages based on user defined configurations. All the information submitted by mobile users can be viewed, filtered, verified, and exported using the reports tab in the web application. 

The web app is fully responsive with a mobile first design and supports any written language. It can be installed locally, as part of a vm (see [medic-os](https://github.com/medic/medic-os)), or in the cloud.

More information about Medic Mobile tools: www.medicmobile.org/tools

## Dependencies

You will need to install the following:

### Node and CouchDB

Assuming you have [Nodejs](http://nodejs.org), [CouchDB](http://couchdb.apache.org), and [couchdb-lucene](https://github.com/rnewson/couchdb-lucene).

### Kanso

[Kanso](http://kan.so) is required to build and deploy.

```
npm install kanso -g
```

Create a `.kansorc` file with your credentials, eg:

```
exports.env = {
  default: {
    db: "http://admin:pass@localhost:5984/medic",
    overrides: {loglevel:"debug"}
  }
};
```

### Grunt

[Grunt](http://gruntjs.com) is required to build.

```
npm install grunt-cli -g
```

## Develop

### Build

```
git clone --recursive https://github.com/medic/medic-webapp
cd medic-webapp
npm install
```

### Push the couchapp

```
grunt dev
```

Or you can watch and automatically update the app on changes

```
grunt watch
```

### Start medic-sentinel

```
cd sentinel
export COUCH_URL=http://admin:pass@localhost:5984/medic
node ./server.js
```

### Configure lucene

Add the following to couchdb httpd_global_handlers 
```
_fti = {couch_httpd_proxy, handle_proxy_req, <<"http://127.0.0.1:5985">>}
```

Update `<lucene_home>/conf/couchdb-lucene.ini` so the URL has credentials, eg:

```
url=http://foo:bar@localhost:5984/
```

Start lucene: `<lucene_home>/bin/run`

You should now see a welcome message at 

```
http://localhost:5985
```

### Try it out

Navigate your browser to:

```
http://localhost:5984/medic/_design/medic/_rewrite/
```


### Loading Data

Loading your form definitions in the settings interface is suported but you can
also do that from command line.

```
node scripts/load_forms.js
```

To bulk load messages from a CSV file run:

```
node scripts/load_messages.js
```

Use curl to submit a single message:

```
curl -i -u gateway:123qwe \
    --data-urlencode 'message=Test One two' \
    --data-urlencode 'from=+13125551212' \
    --data-urlencode 'sent_timestamp=1403965605868' \
    -X POST \
    http://medic.local/medic/_design/medic/_rewrite/add
```


## Deploy to Market

When deploying to market include the sentinel package in the couchapp so
[gardener](https://github.com/garden20/gardener) can manage the process.

First clone the repo recursively so you get both submodules `json-forms` and
`sentinel`, then change directories:

```
git clone --recursive https://github.com/medic/medic-webapp
cd medic-webapp
```

Then edit `kanso.json` and add `"kanso-gardener":null` to the end of the list of dependencies.  You can use your editor but
[jsontool](https://github.com/trentm/json) has an edit mode that works to:

```
cat kanso.json |json -e 'dependencies["kanso-gardener"] = null;' > new.json
mv new.json kanso.json
```

Finally push to the Medic [Garden
Market](https://github.com/garden20/garden-market) run:

```
kanso push http://staging.dev.medicmobile.org/markets-alpha/upload
```

## Configure

Dashboard is required to load Medic Mobile. To install Dashboard
1) git clone https://github.com/garden20/dashboard
2) cd dashboard
3) kanso push $COUCH_URL
4) change the couch db configuration secure_rewrites to false.


See [Medic Sentinel](https://github.com/medic/medic-sentinel) for more information.

## Tests

Tests are run in browser, you can run them manually if you browse to `/test`
after a push.  To run them from commandline you will need to install
[phantomjs](http://phantomjs.org/).

```
npm install phantomjs -g
grunt test
```

## Help

Join our [Google Group](https://groups.google.com/forum/#!forum/medic-developers) or file an issue on Github.

## Build Status

Builds brought to you courtesy of [Travis CI](https://travis-ci.org/medic/medic-webapp).

Develop      | Testing       | Master
------------ | ------------- | ------------
[![Build Status](https://travis-ci.org/medic/medic-webapp.png?branch=develop)](https://travis-ci.org/medic/medic-webapp/branches) | [![Build Status](https://travis-ci.org/medic/medic-webapp.png?branch=testing)](https://travis-ci.org/medic/medic-webapp/branches) | [![Build Status](https://travis-ci.org/medic/medic-webapp.png?branch=master)](https://travis-ci.org/medic/medic-webapp/branches)


## License & Copyright

Copyright 2013 Medic Mobile, 501(c)(3)  <hello@medicmobile.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
