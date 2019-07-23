require('dotenv').config();

const admin = require('firebase-admin');
const Pusher = require('pusher');
const chalk = require("chalk");
const amqp = require('amqplib');
const { resolve, tap } = require('bluebird');
const { uri, workQueue } = {
    uri: process.env.rabbitUri || 'amqp://localhost',
    workQueue: process.env.workQueue || 'rabbitmq-reminder'
}
const assertQueueOptions = { durable: true }
const consumeQueueOptions = { noAck: false }


const channelsClient = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER,
    encrypted: true
});

const processHeavyTask = msg => resolve(console.log('Message received'))
    .then(() => {
        if (!admin.apps.length) {
            let serviceAccount = require('./config/serviceAccountKey.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${process.env.DATABASE}.firebaseio.com`
            });
        }
        let task = JSON.parse(msg.content.toString());
        let ref = admin.database().ref('/');
        ref.push().set(task);

        channelsClient.trigger(process.env.CHANNEL, process.env.EVENT, {
            "message": "Task has been saved."
        });

        console.log(chalk.green("[Worker] saved task to firebase."));
    });

const assertAndConsumeQueue = (channel) => {
    const ackMsg = msg => resolve(msg)
        .tap(msg => processHeavyTask(msg))
        .then(msg => channel.ack(msg));

    return channel.assertQueue(workQueue, assertQueueOptions)
        .then(() => channel.prefetch(1))
        .then(() => channel.consume(workQueue, ackMsg, consumeQueueOptions));
};

const listenToQueue = () => amqp.connect(uri)
    .then(connection => connection.createChannel())
    .then(channel => assertAndConsumeQueue(channel));

listenToQueue();