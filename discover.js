
require("dotenv").config();
const express = require("express");
const discover = express();
const cors    = require("cors");
const cookieParser = require("cookie-parser");
// check some middleware 
discover.use(cookieParser());
discover.use(express.json());
discover.use(cors());
discover.use(express.urlencoded({extended : true}));
const route = require("./routing/podcastRoute");
const route2 = require("./routing/categoryRoute");
const route3 = require("./routing/podcaster");
const {TokenValidator} = require('./middleware/middleware');


//=====================================================
// configure podcast route middleware forwarding
//-----------------------------------------------------
discover.use("/discover/podcast",TokenValidator,route);

//=====================================================
//configure category route middleware forwarding
//-----------------------------------------------------
discover.use("/discover/category",TokenValidator,route2);

//=====================================================
// configure podcasterCategory middleware forwarding
//-----------------------------------------------------
discover.use("/discover/podcaster",TokenValidator,route3);

// gateway port server
discover.listen(4000,()=>console.log("discover is being run on port : ",4000));