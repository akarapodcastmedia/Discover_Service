require("dotenv").config();
const express = require("express");
const route  = express.Router();
const db = require("../db/mongoConfig");
const {podcastModel, categoryModel} = require("../db/schema");
const { ListAllCategory ,ListPodcastByCategory, DeleteCategory, UpdateCategory} = require("../storage.config/s3");
const { redisClientCache } = require("../db/redisConnect");

db();
//==========================================
// create category
//==========================================
route.post('/createcategory',async(req,res)=>{
    // create the category
    const categoryName = req.body.data.category;
    // insert to database
    const insert = new categoryModel({
        categoryType : categoryName
    });
    // //save the data to the db
    await insert.save();
    //response to the user
    return res.json({
        error : false,
        message : `${categoryName} was created successfully`
    })
});
//================================
// list all the category type
//================================
route.get('/list/all/categorylistall',async(req,res)=>{
    // return the available category to the user 
    const category = await ListAllCategory();
    // response to the user 
    await redisClientCache.setEx("category",10000,JSON.stringify(category));
    return res.json({
        error : false,
        message : `Request Ok`,
        data : category
    })
})
//======================================
// list all podcast in a specic category
//======================================
route.post('/list/podcastincategory',async(req,res)=>{
    // return the available category to the user 
    const category = await ListPodcastByCategory(req.body.categoryName);
    // response to the user 
    return res.json({
        error : false,
        message : `Request Ok`,
        data : category
    })
})
// ===============================
// update datagory
//=================================
route.post('/updatecategory',async(req,res)=>{
    // get the updated category from the client 
    const category_id  = req.body.category_id;
    const category_name = req.body.category_name;
    const result = await UpdateCategory(category_id,category_name);
    return res.json({
        error : false,
        message : result
    })
});
//==================================
// delete category 
//==================================
route.post('/deletecategory',async(req,res)=>{
    const category_id = req.body.category_id;
    const result = await DeleteCategory(category_id);
    return res.json({
        error : false,
        message : result
    }) 
    
});
module.exports = route;