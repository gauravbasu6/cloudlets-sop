require('dotenv').config();
const { Server } = require('socket.io');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

const io = new Server(PORT);

let intervals = [];
let clients = {};
let dataQueue = [];
let clientReceiveCounter = 0;


const checkLowStorageUsageClients = () => {
    let lowStorageUsageClients = [];
    for (const clientId in clients) {
        const ratio = clients[clientId].storageRatio;
        if (ratio != null) lowStorageUsageClients.push(ratio);
    }//for each client if ratio exists, push the ratio to lowStorageUsageClients
    return lowStorageUsageClients;
};

io.on('connection', socket => {
    console.log('user connected', socket.id);
    clients[socket.id] = {}; /*appends an object identified by connected 
                                user-id to clients[] */
                                
    socket.on('storage_info', data => {//Register a new handler for the storage_info event.
        if (data.state === 'HIG') {
            console.log('HIG storage usage in', socket.id); 
            if (checkLowStorageUsageClients().length > 0)
                socket.emit('high_storage_send_data');//Emits the 'high_storage_send_data' event to the socket (which sends file out of the client to data queue).
        } else if (dataQueue.length !== 0) {//This happens only if data state is LOW OR MID, i.e., client can take up more load.
            const queuedData = dataQueue[0].data;
            const queuedFromClient = dataQueue[0].fromClient;
            console.log(
                `LOW/MID storage usage in ${socket.id}, sending queued data of ${queuedFromClient}`
            );
            socket.emit('receive_data', queuedData);//emits 'receive_data' event
            dataQueue = dataQueue.slice(1);//remove the data from data queue (as it has been sent to a client with free space)
        }
        clients[socket.id] = {//update socket data
            storageState: data.state,
            storageRatio: data.ratio,
            socket: socket,
        };
    });
    socket.on('high_storage_send_data', data => {
        // console.log('receive count:', ++clientReceiveCounter);
        clientReceiveCounter++;

        let lowestStorageClient = null;//initializing lowestStorageClient
        let lowestStorageRatio = 1;
        for (const clientId in clients) {
            const ratio = clients[clientId].storageRatio;
            if (ratio != null && ratio < lowestStorageRatio) {
                lowestStorageRatio = ratio;
                lowestStorageClient = clientId;
            }
        }//Loop to find out the client with most free space on it

        if (lowestStorageClient === null) {
            console.log(
                'Error: no information on client storage available. Adding data to data queue.'
            );//basic error handling
            dataQueue.push({
                data: data,
                fromClient: socket.id,
            });
        } else if (clients[lowestStorageClient].storageState === 'HIG') {
            console.log(
                'Error: no client with LOW or MID storage available. Adding data to data queue.'
            );
            dataQueue.push({
                data: data,
                fromClient: socket.id,
            });
        } else {
            console.log(
                'Transferring files from',
                socket.id,
                'to',
                lowestStorageClient
            );
            clients[lowestStorageClient].socket.emit('receive_data', data);
        }
    });
});

process.on('exit', () => {
    intervals.forEach(interval => clearInterval(interval));
});

// testing interval for process
setTimeout(() => {
    console.log('receive count:', clientReceiveCounter);
    io.close();
    process.exit();
}, 60 * 1000);
