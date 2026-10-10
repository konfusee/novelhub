#!/usr/bin/env bash
# Idempotent: initiates rs0 and creates the NovelHub app user.
set -euo pipefail
cd /opt/novelhub/mongo
set -a; . ./.env; set +a
M="docker exec novelhub_mongo mongosh --quiet -u $MONGO_ROOT_USERNAME -p $MONGO_ROOT_PASSWORD --authenticationDatabase admin"

$M --eval '
try { rs.status(); print("rs already initiated"); }
catch (e) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] }); print("rs initiated"); }
'
for i in $(seq 1 30); do
  if [ "$($M --eval 'db.hello().isWritablePrimary')" = "true" ]; then break; fi
  sleep 2
done
$M --eval "
const admin = db.getSiblingDB('admin');
const roles = [{ role: 'readWrite', db: 'novelhub' }, { role: 'dbAdmin', db: 'novelhub' },
               { role: 'readWrite', db: 'novelhub_test' }, { role: 'dbAdmin', db: 'novelhub_test' }];
if (admin.getUser('$MONGO_APP_USERNAME')) {
  admin.updateUser('$MONGO_APP_USERNAME', { pwd: '$MONGO_APP_PASSWORD', roles });
  print('app user updated');
} else {
  admin.createUser({ user: '$MONGO_APP_USERNAME', pwd: '$MONGO_APP_PASSWORD', roles });
  print('app user created');
}
print('primary=' + db.hello().isWritablePrimary + ' set=' + db.hello().setName);
"
