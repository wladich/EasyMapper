#!/bin/bash
set -x
set -e
make-js-app
cp src/images/favicon.ico build/production/
rsync --delete -v -r --owner --chown=www-data:root --perms --chmod=D500,F400 build/production/ root@time4vps.wladich.tk:/var/www/nakarte

