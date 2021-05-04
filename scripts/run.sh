#!/bin/bash

set -e

SCR_PATH=${PWD}/scripts
cat .env > ${SCR_PATH}/config.sh
chmod 777 ${SCR_PATH}/config.sh
source ${SCR_PATH}/config.sh
source ${SCR_PATH}/utils.sh

if [[ "$(docker images -q nodejs 2> /dev/null)" == "" ]]; then
  logerror "nodejs image not found...building..."
  docker build -t nodejs .
fi

docker-compose up -d

while true
do
  log "check"
  STATUS=$(curl -i "http://localhost:8088/healthcheck" | grep HTTP/ | awk {'print $2'})
  log ${STATUS}
  if [[ -z "$STATUS" ]]
    then
        logerror ":( Not done yet..."
  elif [[ $STATUS -eq 200 ]]
    then
        log "Got 200! ksqlDB running...!!"
        break
  else
        logerror "Got $STATUS :( Not done yet..."
  fi
  log "sleeping for 20 sec....."
  sleep 20
done
log "creating request topic..."
timeout 60 docker exec broker kafka-topics --create --topic rq-topic --bootstrap-server broker:9092 --replication-factor 1 --partitions 1
log "response topic is auto-created..."

log "creating ksqldb streams...."
curl -X POST -H "Content-Type: application/vnd.ksql.v1+json" -H "Accept: application/vnd.ksql.v1+json" -d @./ksql/statements.json http://localhost:8088/ksql
log "streams created...."
docker stop nodejs
docker start nodejs


while true
do
  IS_RUNNING=`docker-compose ps -q nodejs`
  if [[ "$IS_RUNNING" != "" ]]; then
      log "All services running..."
      break
  else
      logerror "Nodejs not running yet..."
  fi
  log "sleeping for 10 sec....."
  sleep 10
done


log "******************  open index.html page (under 'client' folder) in a browser.... ******************"