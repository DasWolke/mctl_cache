/**
 * Created by Julian on 24.05.2017.
 */
const winston = require('winston');
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    'timestamp': true,
    'colorize': true
});
let express = require('express');
const loader = require('docker-config-loader');
const {promisifyAll} = require('tsubaki');
let config;
try {
    config = loader({secretName: 'secret_name', localPath: './config/main.json'});
} catch (e) {
    winston.error(e);
    winston.error('Failed to require config!');
    process.exit(1);
}
let redis = require('redis');
promisifyAll(redis.RedisClient.prototype);
promisifyAll(redis.Multi.prototype);
let redisClient = redis.createClient();
redisClient.select(config.redis_database);
redisClient.on('error', (err) => {
    console.error(err);
});
let app = express();
let Socket = require('socket.io-client');
let connection = Socket(config.ws_url);
connection.on('new-track', (data) => {
    winston.info(`Received new track [${data.title}]`);
    redisClient.set('mctl_cache_last_song', JSON.stringify(data));
});
connection.on('disconnect', () => {
    console.error('disconnected, trying to reconnect');
});
connection.on('connect', () => {
    winston.info('Connected to origin');
    connection.emit('origin', config.origin);
    connection.emit('last-track');
});
app.get('/', async(req,res) => {
    let track = await redisClient.getAsync('mctl_cache_last_song');
    if (!track) {
        return res.status(404).json({status:404, message:'No song loaded currently'});
    }
    return res.status(200).json({status:200, track, message:'Found song in cache'});
});
app.listen(config.port, config.host);
winston.info(`Server started ${config.host}:${config.port}`);
