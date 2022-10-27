require('dotenv').config();
const io = require('socket.io-client');
const diskUsage = require('check-disk-space').default;
const fs = require('fs');

const SERVER = process.env.SERVER;
const PORT =  process.env.PORT || 3000; 

/*******************************************************/
/* There are 3 storageSpaceStates :
    1) LOW - If free space ratio <= 0.4,
    2) MID - If free space ratio <= 0.8 but > 0.4
    3) HIG - If free space ratio > 0.8
*/
let storageSpaceState = 'LOW';
const THRESHOLD0 = 0.4;
const THRESHOLD1 = 0.8;
/*******************************************/
const getRatio = diskSpace => {
    // return { ratio: diskSpace.free / diskSpace.size }; // use this for production; actually gets the ratio from fs
    const randNum = Math.random(); // for testing purposes; (sending a random 
    return { ratio: randNum }; // for testing purposes;     value between 0 and 1)
};
const sendStorageStatusUpdate = () => {
    diskUsage(process.env.DISKPATH).then(diskSpace => { // object returned by diskUsage() is sent to getRatio() to finally return reqd free space ratio
        const ratio = getRatio(diskSpace).ratio; //accessing 'ratio' value of returned object
        const storageInfo = {
            ...diskSpace,
            ratio: ratio,
        }; //appending ratio to the diskSpace object

        if (ratio <= THRESHOLD0) {
            storageSpaceState = 'LOW';
            socket.emit('storage_info', {
                ...storageInfo,
                state: storageSpaceState,
            });
        } else if (THRESHOLD0 < ratio && ratio <= THRESHOLD1) {
            storageSpaceState = 'MID';
            socket.emit('storage_info', {
                ...storageInfo,
                state: storageSpaceState,
            }); 
        } else {
            storageSpaceState = 'HIG';
            socket.emit('storage_info', {
                ...storageInfo,
                state: storageSpaceState,
            });//emit('event-name',{args})
        }
        //https://socket.io/docs/v4/client-api/#socketemiteventname-args - docs for socket.emit() func
    });
};


const socket = io(SERVER + PORT); // wants to access a specific port of the server. Not sure how the + works for env vars.
// connect event being triggered
socket.on('connect', () => {
    console.log(socket.id);
    sendStorageStatusUpdate();
});

// storage-info event triggered
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

setInterval(() => {
    sendStorageStatusUpdate();
}, process.env.DISKPOLLINTERVAL); 
//DISKPOLLINTERVAL will tell setInterval() how often to check if the clients have HIG, MED or LOW disk space.
