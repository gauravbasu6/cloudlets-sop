require('dotenv').config();
const { Server } = require('socket.io');
const fs = require('fs');

const PORT = process.env.PORT || 3000;

const io = new Server(PORT);

const infinity = Math.pow(10,1000);
const CPUth = 1.5;
const w1 = 0.8;
const w2 = 0.1;
const w3 = 0.1;

let intervals = [];
let clients = {};
let dataQueue = [];
let taskQueue = [];
let clientDataReceiveCounter = 0;
let clientTaskRecieveCounter = 0;
let clientTaskQueueCounter = 0;

const checkLowStorageUsageClients = () => {
    let lowStorageUsageClients = [];
    for (const clientId in clients) {
        const ratio = clients[clientId].storageRatio;
        if (ratio != null) lowStorageUsageClients.push(ratio);
    }
    return lowStorageUsageClients;
};

const checkLowCPUUsageClients = () => {
    let lowCPUUsageClients = [];
    for (const clientId in clients) {
        const ratio = clients[clientId].storageRatio_cpu;
        if (ratio != null) lowCPUUsageClients.push(ratio);
    }
    return lowCPUUsageClients;
};

io.on('connection', socket => {
    console.log('user connected', socket.id);
    clients[socket.id] = {};

    socket.on('storage_info', data => {
        if (data.state_mem === 'HIG') {
            console.log('HIG storage usage in', socket.id);
            if (checkLowStorageUsageClients().length > 0)
                socket.emit('high_storage_send_data');
        } else if (dataQueue.length !== 0) {
            const queuedData = dataQueue[0].data;
            const queuedFromClient = dataQueue[0].fromClient;
            console.log(
                `LOW/MID storage usage in ${socket.id}, sending queued data of ${queuedFromClient}`
            );
            socket.emit('receive_data', queuedData);
            dataQueue = dataQueue.slice(1);
        }
        clients[socket.id] = {
            storageState: data.state_mem,
            storageRatio: data.ratio_mem,
            storageState_cpu: data.state_cpu,
            storageRatio_cpu: data.ratio_cpu,
            socket: socket,
            NP: data.NP,
            NC: data.NC,
            NF: data.NF,
            TP: data.TP,
            TC: data.TC,
            TF: data.TF,

        };
    });


    socket.on('cpu_info', data => {
        if (data.state_cpu === 'HIG' || data.state_mem === 'HIG') {
            console.log('HIG Resource usage in', socket.id);//make one function for storage_info and cpu_info (HIGH Priority)
            if (checkLowCPUUsageClients().length > 0)
                socket.emit('high_cpu_send_task');
        } else if (taskQueue.length !== 0 && !(data.state_cpu=='HIG' && data.state_mem=='HIG')) {
            const queuedTask = taskQueue[0].data;
            const queuedFromClient = taskQueue[0].fromClient;
            const NF = taskQueue[0].NF;
            const TF = taskQueue[0].TF;
            console.log(
                `LOW/MID Resource usage in ${socket.id}, sending queued task of ${queuedFromClient}`
            );
            socket.emit('receive_task',{ data: queuedTask,
                                        NF: NF,
                                        TF: TF
            });
            taskQueue = taskQueue.slice(1);
        }
        clients[socket.id] = {
            storageState_cpu: data.state_cpu,
            storageRatio_cpu: data.ratio_cpu,
            storageState: data.state_mem,
            storageRatio: data.ratio_mem,
            socket: socket,
            NP: data.NP,
            NC: data.NC,
            NF: data.NF,
            TP: data.TP,
            TC: data.TC,
            TF: data.TF,
        };
    });




    socket.on('high_storage_send_data', data => {
        // console.log('receive count:', ++clientReceiveCounter);
        clientDataReceiveCounter++;

        let lowestStorageClient = null;
        let lowestStorageRatio = 1;
        for (const clientId in clients) {
            const ratio = clients[clientId].storageRatio;
            if (ratio != null && ratio < lowestStorageRatio) {
                lowestStorageRatio = ratio;
                lowestStorageClient = clientId;
            }
        }

        if (lowestStorageClient === null) {
            console.log(
                'Error: no information on client storage available. Adding data to data queue.'
            );
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


    socket.on('high_cpu_send_task', data => {
        // console.log('receive count:', ++clientDataReceiveCounter);

        let lowestcpuClient = null;
        let lowestcpuN = infinity;
        for (const clientId in clients) {
            const cpuN = w1*clients[clientId].TP/clients[clientId].NP + w2*clients[clientId].TC/clients[clientId].NC + w3*clients[clientId].TP/clients[clientId].NP; 
            if (cpuN != null && cpuN < lowestcpuN) {
                lowestcpuN = cpuN;
                lowestcpuClient = clientId;
            }
        }
            console.log(lowestcpuN)
        if (lowestcpuClient === null) {
            console.log(
                'Error: no information on client resource usage available. Adding task to data queue.'
            );
            taskQueue.push({
                data: data.filename,
                fromClient: socket.id,
                NF: data.NF,
                TF: data.TF
            });
        } else if (lowestcpuN >= CPUth) {
            clientTaskQueueCounter++;
            console.log(
                'Error: no client capable of taking task. Adding task to data queue.'
            );
            taskQueue.push({
                data: data.filname,
                fromClient: socket.id,
                NF: data.NF,
                TF: data.TF
            });
        } else {
        clientTaskRecieveCounter++;
            console.log(
                'Transferring task from',
                socket.id,
                'to',
                lowestcpuClient
            );
            clients[lowestcpuClient].socket.emit('receive_task', {data: data.filename,
                NF: data.NF,
                TF: data.TF
            });
        }
    });
});

process.on('exit', () => {
    intervals.forEach(interval => clearInterval(interval));
});

// testing interval for process
setTimeout(() => {
    console.log('received data count:', clientDataReceiveCounter);
    console.log('receive tasks from other clients:',clientTaskRecieveCounter);
    console.log('tasks added to queue:',clientTaskQueueCounter );
    io.close();
    process.exit();
}, 60 * 1000);
