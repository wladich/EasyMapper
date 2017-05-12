This repo is deprecated, source code of site nakarte.tk is now at http://github.com/wladich/nakarte

EasyMapper
==========
http://nakarte.tk

Web site/application for viewing web maps, printing, working with gps tracks

This is refactored and rewritten version of https://github.com/wladich/leaflet-print which was planned to be a leaflet plugin but became a complex in-browser appliction.

Getting started
---------------
```bash
$ git clone https://github.com/wladich/EasyMapper.git
$ git clone https://gist.github.com/8df9c0de0e6d49bc42d643d3799f578e.git
$ git clone https://gist.github.com/7723a73c8347ce470630.git
$ cd EasyMapper
$ virtualenv -p python2.7 .env
$ . .env/bin/activate
$ pip install cssmin PyYAML Unipath
$ echo -e "#!/bin/sh\npython `dirname $PWD`/8df9c0de0e6d49bc42d643d3799f578e/make_js_app.py \$@" > .env/bin/make-js-app
$ echo -e "#!/bin/sh\npython `dirname $PWD`/7723a73c8347ce470630/css-embed-urls.py \$@" > .env/bin/css-embed-urls
$ chmod +x .env/bin/make-js-app .env/bin/css-embed-urls
$ npm install uglify-js
$ export PATH=$PATH:$PWD/node_modules/uglify-js/bin
$ make-js-app
$ cp src/images/favicon.ico build/production/
$ cd build/production
$ python -m SimpleHTTPServer 8000
```
