'use strict'

const WebSocket = require('ws');
const port = process.argv2 || 2990;
const { uuid } = require('uuidv4');
const wss = new WebSocket.Server({
    port: port  
})

const msgHistory = [];
let connectedClients = {}

wss && console.log('listening on: ' + port )

wss.on('connection', onConnection);



function onConnection(ws, req) {
    const clientId = req.url.split('=')[1]
    if(Object.keys(connectedClients).includes(clientId)) {
        ws.send(JSON.stringify(new Message(
            'error',
            new Date(),
            'Server',
            'user-already-exist',
        )))
        ws.close()
        return;
    }
    connectedClients[clientId] = ws;
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.on('message', (data) => {
        const { type, message, user, directTo } = JSON.parse(data);
        if(!type) {
            ws.send(JSON.stringify(new Message(type, new Date(), 'Server', 'Wrong message type. Accepted "text"')))
            return;
        }
        const msg = new Message(type, new Date(), user, message)
        if(!directTo){
            msgHistory.push(msg);
            broadcast(wss, msg)
        } else {
            let msg = JSON.stringify(new Message('text', new Date(), user, message, directTo))
            connectedClients[directTo] && connectedClients[directTo].send(msg)
            ws.send(msg)
        }
    })
    const interval = setInterval(function ping() {
        wss.clients.forEach(function each(ws) {
            if (ws.isAlive === false) return ws.terminate();
            
            ws.isAlive = false;
            ws.ping(noop);
        });
    }, 30000);
    ws.on('close', ()=> {
        clearInterval(interval);
        delete connectedClients[clientId]
        broadcast(wss, {"type": 'retrieve', "message": msgHistory, "clients": Object.keys(connectedClients)})
    })
    broadcast(wss, {"type": 'retrieve', "message": msgHistory, "clients": Object.keys(connectedClients)})
}



class Message {
    constructor(type, time, user, message, directTo = null) {
        this.type = type,
        this.date = time
        this.user = user,
        this.message = message
        this.directTo = directTo;
        this.uuid = uuid()
    }
}

function noop() {}
function heartbeat() {
    this.isAlive = true;
}

function broadcast(wss, msg) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(msg))
        }
    });
}