// server.js
/* 

1. each app instance one topic - replicated logic of kstreams/ksqldb - 1 set of rq/rsp
2. rq same, rsp different
3. all instances one rsp topic - filter at app by corr id
4. app instance listens to particular partition, send partition as part of header
or use correlation id to map to particular partition

chosen 3. here - multiple tabs

*/

const {  CompressionTypes, CompressionCodecs } = require('kafkajs')
const SnappyCodec = require('kafkajs-snappy')
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec

const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8080 })
const { Kafka } = require('kafkajs')
const ip = require('ip')

//const host = process.env.HOST_IP || ip.address()
const host = "broker"

const kafka = new Kafka({
  brokers: ['broker:9092'],
  clientId: 'client-wss',
})

const rspTopic = 'rsp-topic'
const rqTopic = 'rq-topic'
const consumer = kafka.consumer({ 
    groupId: 'client-wss-group' 
})
const producer = kafka.producer()
const runProducerConnect = async () => {
    await producer.connect()
}
runProducerConnect().catch(e => console.error(`[SERVER] [wss/producerconnect] ${e.message}`, e))



var dict = {}


wss.on('connection', ws => {

  ws.on('message', message => {
    var corrId = Date.now()
    dict[corrId] = {}
    dict[corrId]["conn"] = ws
    dict[corrId]["processed"] = "n"
    console.log(`[SERVER] [FIRST] Received message => ${message}`)
    const runProducer = async () => {
        console.log("[SERVER] [FIRST] Sending message to kafka......")
        await producer.send({
            topic: rqTopic,
            messages: [
                {key: corrId.toString(), value: JSON.stringify({ key: corrId.toString(), data: message })}
            ]
        })
    }
    runProducer().catch(e => console.error(`[SERVER] [FIRST] [wss/producer] ${e.message}`, e))
    //dict[corrId]["conn"].send(`From server => message being processed, corrId => ${corrId}`)
  })

})

const runConsumer = async () => {
    await consumer.connect()
    await consumer.subscribe({ topic:rspTopic, fromBeginning: true })
    await consumer.run({
      eachMessage: async ({ topic:rspTopic, partition, message }) => {
        console.log(`[SERVER] [SECOND] Received message from rsp-topic`)
        console.log(`message ---------> ${message}`)
        console.log(JSON.stringify(message))
        var key = message.key.toString()
        var value = message.value.toString()
        console.log(`[SERVER] [SECOND] Key is ${key}, Message is ${value}`)
        // check if key present for this instance
        if (dict[key] !== undefined) {
            dict[key]["conn"].send(`From server => ${value}`)
            delete dict[key]
        }
      },
    })
  }
  runConsumer().catch(e => console.error(`[SERVER] [SECOND] [wss/consumer] ${e.message}`, e))

// this is just to check what keys are still in memory
setInterval(() => {
    console.log("in cache {")
    for (var key in dict) {
        if (dict.hasOwnProperty(key)) {
            console.log(key)
        }
    }
    console.log("}")
}, 5000)

