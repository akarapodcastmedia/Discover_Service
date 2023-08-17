const Queue = require('bull');
const tasker = async (task) => {
    const mailQueue = new Queue('podcast_automated_generate','redis://cache.akarahub.tech:6379');
    await mailQueue.add(task);
    // process the queue
    await mailQueue.process(async(job,done)=>{
        console.log("task is done by redis");
   })
}
// create the interface function for calling this queue process
const  starterQueue =  async (task) => {
    tasker(task).then(res => console.log(res)).catch(e=> console.log(e));
}
// module.export 
module.exports={
    starterQueue
}