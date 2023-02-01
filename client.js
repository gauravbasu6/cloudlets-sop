require('dotenv').config();
const io = require('socket.io-client');
const diskUsage = require('check-disk-space').default;
const fs = require('fs');

const SERVER = process.env.SERVER;
const PORT = process.env.PORT || 3000;

let storageSpaceState_mem = 'LOW';
let storageSpaceState_cpu = 'LOW';
let numberOfTasks = Array(3).fill(0);
let timeOfTasks = Array(3).fill(100000);
const THRESHOLD0_mem = 0.4;
const THRESHOLD1_mem = 0.8;
const THRESHOLD0_cpu = 0.2;//added cpu lower threshold
const THRESHOLD1_cpu = 0.9;//added cpu higher threshold

const task_data = () =>{
    const randnum = Math.floor(Math.random()*2); //for testing purposes, in deployment this variable is user defined where he tells if it is data or a task
    return randnum;// 0 for task 1 for data
}

const getNfTf = () =>{
    const randnumTf = Math.floor(Math.random()*10);
    const randnumNf = Math.random()*5;
    return{
            NF: randnumNf,
            TF: randnumTf
    };
}

const taskParameters = (NF,TF) =>{
    timeOfTasks[0] = timeOfTasks[1];
    numberOfTasks[0] = numberOfTasks[1];
    timeOfTasks[1] = timeOfTasks[2];
    numberOfTasks[1] = numberOfTasks[2];
    timeOfTasks[2] = NF;
    numberOfTasks[2] = TF;

}


const getRatio = diskSpace => {
    // return { ratio_mem: diskSpace.free / diskSpace.size }; // use this for production
    const randNum_mem = Math.random(); // for testing purposes
    const randNum_cpu = (Math.random()*0.9);
    return { ratio_mem: randNum_mem,
            ratio_cpu: randNum_cpu }; //added a cpu load evaluator
};// make another function that actually calculates CPU load (Med Priority)
const sendStorageStatusUpdate = () => {
    diskUsage(process.env.DISKPATH).then(diskSpace => {
        const ratio_mem = getRatio(diskSpace).ratio_mem;
        const ratio_cpu = getRatio(diskSpace).ratio_cpu;
       

        if (ratio_mem <= THRESHOLD0_mem) {
            storageSpaceState_mem = 'LOW';
        } else if (THRESHOLD0_mem < ratio_mem && ratio_mem <= THRESHOLD1_mem) {
            storageSpaceState_mem = 'MID';
        } else {
            storageSpaceState_mem = 'HIG';
        }

        
        if (ratio_cpu <= THRESHOLD0_cpu) {
            storageSpaceState_cpu = 'LOW';
        } else if (THRESHOLD0_cpu < ratio_cpu && ratio_cpu <= THRESHOLD1_cpu) {
            storageSpaceState_cpu = 'MID';
        } else {
            storageSpaceState_cpu = 'HIG';
        }

        const storageInfo = {
            ...diskSpace,
            ratio_mem: ratio_mem,
            ratio_cpu: ratio_cpu
        }

        const task_or_data = task_data();
        if(task_or_data){
        socket.emit('storage_info', {
            ...storageInfo,
            state_mem: storageSpaceState_mem,
            state_cpu: storageSpaceState_cpu,
            NP:timeOfTasks[0],
            NC:timeOfTasks[1],
            NF:timeOfTasks[2],
            TP:numberOfTasks[0],
            TC:numberOfTasks[1],
            TF:numberOfTasks[2]
        })}

        else{
        //NF = getNfTf().NF;
        //TF = getNfTf().TF;
        //taskParameters(NF,TF)
        socket.emit('cpu_info', {
            ...storageInfo,
            state_mem: storageSpaceState_mem,
            state_cpu: storageSpaceState_cpu,
            NP:timeOfTasks[0],
            NC:timeOfTasks[1],
            NF:timeOfTasks[2],
            TP:numberOfTasks[0],
            TC:numberOfTasks[1],
            TF:numberOfTasks[2]
        })}


    });
};


/* const sendCPUStatusUpdate = () => {
    diskUsage(process.env.DISKPATH).then(diskSpace => {
        const ratio_cpu = getRatio(diskSpace).ratio_cpu;
       
        
        const storageInfo = {
            ...diskSpace,
            ratio_cpu: ratio_cpu,
            
        };

        if (ratio_cpu <= THRESHOLD0_cpu) {
            storageSpaceState_cpu = 'LOW';
            socket.emit('cpu_info', {
                ...storageInfo,
                state_cpu: storageSpaceState_cpu,
            });
        } else if (THRESHOLD0_cpu < ratio_cpu && ratio_cpu <= THRESHOLD1_cpu) {
            storageSpaceState_cpu = 'MID';
            socket.emit('cpu_info', {
                ...storageInfo,
                state_cpu: storageSpaceState_cpu,
            });
        } else {
            storageSpaceState_cpu = 'HIG';
            socket.emit('cpu_info', {
                ...storageInfo,
                state_cpu: storageSpaceState_cpu,
            });
        }

    });
}; */





const socket = io(SERVER + PORT);
socket.on('connect', () => {
    console.log(socket.id);
    sendStorageStatusUpdate();
    //sendCPUStatusUpdate();
});

socket.on('storage_info', () => {
    console.log('received storage request');
    diskUsage(process.env.DISKPATH).then(diskSpace => {
        socket.emit('storage_info', {
            ...diskSpace,
            ...getRatio(diskSpace),
        });
    });
});

socket.on('high_storage_send_data', () => {
    // console.log('server requesting data');
    const fileName = 'sent-big-dummy-data.txt';
    // fs.readFile('./assets/dummy-data.txt', (err, buff) => {
    //     if (err) {
    //         console.log('file not found');
    //         return;
    //     }
    //     console.log('Data read successful');
    //     socket.emit('high_storage_send_data', {
    //         fileName: fileName,
    //         data: buff,
    //     });
    // });
    socket.emit('high_storage_send_data', {
        fileName: fileName,
        data: 'buff',
    });
});


socket.on('high_cpu_send_task', () => {  // make sure that the file is actually being transferred (LOW priority)
   
    NF = getNfTf().NF;
    TF = getNfTf().TF;
        
    const fileName = 'a.out';
    socket.emit('high_cpu_send_task', {
        fileName: fileName,
        NF: NF,
        TF: TF
    });
});



socket.on('receive_data', data => {
    console.log(`saving data to file`, data.fileName);
    // fs.writeFile(
    //     __dirname + `/${data.fileName}`,
    //     new Buffer.from(data.data),
    //     err => {
    //         if (err) {
    //             console.log('Error in writing file');
    //             return;
    //         }

    //         console.log('Successfully saved file.', data.fileName);
    //     }
    // );
});



socket.on('receive_task', data => {
    taskParameters(data.NF,data.TF);
    console.log(`adding task for execution`, data.data);
});

setInterval(() => {
    sendStorageStatusUpdate();
    //sendCPUStatusUpdate();
}, process.env.DISKPOLLINTERVAL);
