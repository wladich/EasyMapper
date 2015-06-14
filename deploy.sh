#!/bin/bash
set -x
set -e
make-js-app
cp src/images/favicon.ico build/production/
rsync --delete -v -r build/production/ root@nakarte.tk:/var/www/easymapper
