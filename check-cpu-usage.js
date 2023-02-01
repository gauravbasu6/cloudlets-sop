const os = require('os');
cpu_data_arr = os.cpus();
total_cpu_util = 0; //Average CPU utilization of all cores.

cpu_data_arr.forEach((cpu_data,i)=>{
    console.log((1-cpu_data.times.idle/(cpu_data.times.user+cpu_data.times.nice+cpu_data.times.sys+cpu_data.times.idle+cpu_data.times.irq)));
    /*
        We first find ratio of idle time to total time; then subtract it from one to get "% CPU Usage".
    */
    total_cpu_util += 1-cpu_data.times.idle/(cpu_data.times.user+cpu_data.times.nice+cpu_data.times.sys+cpu_data.times.idle+cpu_data.times.irq); //sum of % CPU usage of all cores
})

avg_cpu_util = total_cpu_util/cpu_data_arr.length //averaged cpu usage
console.log('Avg cpu usage is: ' + avg_cpu_util) 