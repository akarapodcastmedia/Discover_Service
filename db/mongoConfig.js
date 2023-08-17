
const mongoose = require("mongoose");
module.exports = () => {
    // connect to the mongod instance to start the mongodb database server
    mongoose.connect(process.env.db_connection_string,{useNewUrlParser: true});
    // if get the result object from the connection 
    const isConnected = mongoose.connection;
    isConnected.on("error",()=> console.log("connection fail"));
    isConnected.on("open",()=>console.log("connection success"));
    // end of the configuration connection db
}