require("dotenv").config();
const express = require("express");
const route  = express.Router();
const db = require("../db/mongoConfig");
const {podcastModel} = require("../db/schema");
const multer  = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const {getProfile,deleteProfile,updateProfile, uploadProfile,ListPodcastByPodcaster,ListAllPodcaster, DeletePodcaster, DisbanPodcaster, BanPodcaster } = require("../storage.config/s3");
db();
// get podcaster profile
route.get("/get/profile",async (req,res)=>{
    // get a profile of a particular podcaster
    const result = await getProfile(req.emit);
    return res.json(result);
})
// delete podcaster profile
route.post("/delete/profile",async (req,res)=>{
    if(req.body.podcaster_id != null){
        const result = await deleteProfile(null,req.body.podcaster_id);
        return res.json(result);
    }else{
        const result = await deleteProfile(req.email,null);
        return res.json(result);
    }
})
// upload podcaster profile 
route.post("/upload/profile",upload.single('profile'),async(req,res)=>{
    const email = req.email;    // email of the user who upload the podcast
    //console.log(`username : ${username} --- role : ${role} ----- email : ${email} ---- user : ${user}`);
    // upload profile to s3 
    const result = await uploadProfile(req.file,email,()=> require('crypto').randomBytes(32).toString('hex'),req.body.file_type);
    return res.json(result);
});
// change profile 
route.post("/update/profile",upload.single('profile'),async(req,res)=>{
    const email = req.email;
    const result = await updateProfile(req.file,email,()=> require('crypto').randomBytes(32).toString('hex'),req.body.file_type);
    return res.json(result);
})
route.post('/ban/banpodcaster',async(req,res)=>{
    const podcaster_id = req.body.podcaster_id;
    const result = await BanPodcaster(podcaster_id);
    return res.json({
        error : false,
        message : result
    })
});
route.get('/list/all/listallpodcaster',async(req,res)=>{
    // get all podcaster 
    const result = await ListAllPodcaster();
    return res.json({
        error : false,
        message : "Request success",
        data : result
    });
});
route.post('/ban/podcaster/unbanpodcaster',async(req,res)=>{
    const podcaster_id = req.body.podcaster_id;
    const result = await DisbanPodcaster(podcaster_id);
    return res.json({
        error : false,
        message : result
    })
});
route.post('/delete/deletepodcaster',async(req,res)=>{
    const podcaster_id = req.body.podcaster_id;
    const result = await DeletePodcaster(podcaster_id);
    return res.json({
        error : false,
        message : result
    })
});
route.post('/list/podcaster/podcastofpodcaster',async (req,res)=>{
    const podcaster_id = req.body.id;
    console.log(req.body.id)
    const result = await ListPodcastByPodcaster(podcaster_id);
    // response to client 
    return res.json({
        error : true,
        message : "Request success",
        data : result
    })
})
module.exports = route;