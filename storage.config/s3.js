//*********************************************** */
// Import Dependencies
//*********************************************** */
const randomise= require("crypto");
const { S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { isNull } = require("util");
const {podcastModel,signupModel, categoryModel,podcasterProfileModel} = require('../db/schema');
const {redisClientCache} =require('../db/redisConnect');

//==================================================
// || s3 configuration 
//==================================================
const S3 = new S3Client({
    region :process.env.region,
    credentials : {
        accessKeyId : process.env.access_key,
        secretAccessKey: process.env.secret_key 
    }
})

//==================================================
// upload audio and thumbnail to s3 interface 
//==================================================
async function UploadSrc( Body,user,role,email,FileName_or_Key, FilePlayload_or_Body_audio, FileType_or_ContentType_audio,FilePlayload_or_Body_image,FileType_or_ContentType_image){

    const audioName = FileName_or_Key();
    const imageName = FileName_or_Key();
    const category = await categoryModel.findOne({_id : Body.category});
    const data = await signupModel.findOne({email : email,role:role});
            if(data){
                    if(category){
                        const response_audio = await S3.send(new PutObjectCommand({
                          Bucket : process.env.bucketaudios_name,
                          Key    : audioName,
                          Body   : FilePlayload_or_Body_image,
                          ContentType : FileType_or_ContentType_image
                        }));
                        
                        const response_image = await S3.send(new PutObjectCommand({
                          Bucket : process.env.bucketimages_name,
                          Key    : imageName,
                          Body   : FilePlayload_or_Body_audio,
                          ContentType : FileType_or_ContentType_audio
                        }));  
                        
                        //  get the url of image and audio 
                
                      const imgCommand = new GetObjectCommand({
                        Bucket : process.env.bucketimages_name,
                        Key    : imageName,
                        ContentType : FileType_or_ContentType_image
                      }) ;
                      const audioCommand = new GetObjectCommand({
                        Bucket : process.env.bucketaudios_name,
                        Key    : audioName,
                        ContentType : FileType_or_ContentType_audio
                      })
                      // find url respectively
                      const imgUrl = await getSignedUrl(S3,imgCommand,{expiresIn : 3600});
                      const audioUrl = await getSignedUrl(S3,audioCommand,{expiresIn : 3600});
                      // insert data to database 
                      // find id of the user from data 
                      //console.log(data);
                      const insertPodcast = new podcastModel({
                        podcastCategoryName:category.categoryType,
                        podcastCategoryId : category._id,
                        owner : Body.composer,
                        podcastTitle : Body.title,
                        podcasterId : data._id,
                        audioName : audioName,
                        imageName : imageName,
                        podcastUrl : audioUrl,
                        imageUrl: imgUrl,
                        podcastDescription : Body.description,
            
                    });
                    // save it to db 
                    await insertPodcast.save();
                    // check if has data in cache     
                    const cache_data = await redisClientCache.get("podcasts");
                    if(cache_data != null){
                        let modifier = JSON.parse(cache_data);
                        const podcast = await podcastModel.findOne({podcastTitle : Body.title});
                        modifier.push(podcast);
                        redisClientCache.setEx("podcasts",60*60,JSON.stringify(modifier));
                    }    
                    return "upload success";
              
  
                    }else{
                        return "No this category";
                    }
                }else{
               return "No the owner of this podcast found";
            }
           
            
}
//==================================================
// get all data from database
//==================================================
async function updatePodcast(FileName_or_Key,podcast_id,title,category,description,composer,file_image,file_audio,image_type,audio_type){
  // check     
  if(file_image && file_audio){
      console.log("here")
        // use podcast id to find the podcast need to be updated
        const updatedPodcast = await podcastModel.findOne({_id : podcast_id });
        const previous_imageName = updatedPodcast.imageName;
        const previous_audioName = updatedPodcast.audioName;
        // upload the new podcast to the databse
        const audioName = FileName_or_Key();
        const imageName = FileName_or_Key();
        const response_audio = await S3.send(new PutObjectCommand({
                Bucket : process.env.bucketaudios_name,
                Key    : audioName,
                Body   : file_audio[0].buffer,
                ContentType : audio_type
              }));

        const response_image = await S3.send(new PutObjectCommand({
                Bucket : process.env.bucketimages_name,
                Key    : imageName,
                Body   : file_image[0].buffer,
                ContentType : image_type
              }));  
      // get sign url 
      const imgCommand = new GetObjectCommand({
        Bucket : process.env.bucketimages_name,
        Key    : imageName,
        ContentType : image_type
      }) ;
      const audioCommand = new GetObjectCommand({
        Bucket : process.env.bucketaudios_name,
        Key    : audioName,
        ContentType : audio_type
      })
      // find url respectively
      const imgUrl = await getSignedUrl(S3,imgCommand,{expiresIn : 3600});
      const audioUrl = await getSignedUrl(S3,audioCommand,{expiresIn : 3600});
      const Category = await categoryModel.findOne({_id : category});
      console.log(Category);
      if(Category !=null){
            // update to data 
            const updater = await podcastModel.updateOne({_id : podcast_id},{
              podcastTitle : title,
              owner : composer,
              podcastCategoryName : Category.podcastCategoryName,
              podcastDescription: description,
              imageName : imageName,
              audioName : audioName,
              podcastUrl : audioUrl,
              imageUrl : imgUrl
            });
            // after update to database we need to delete from AWS bucket 
            const delete_audio = new DeleteObjectCommand({
              Bucket : process.env.bucketaudios_name,
              Key    : previous_audioName,
            });
            // send this command to delete image 
            const successOfimageDelete = await S3.send(delete_audio);
            const delete_image = new DeleteObjectCommand({
              Bucket : process.env.bucketimages_name,
              Key    : previous_imageName,
            })
            // send this command to delete audio 
            const successOfaudioDelete = await S3.send(delete_image);

      }else{
        return "there is no sort of this category";
      }
         //==================<< new define cache
      const data_cache = await redisClientCache.get("podcast");
      let meet_condition =0;
      if(data_cache){
          let converter = JSON.parse(data_cache);
          const data_get = await podcastModel.findOne({_id : updatedPodcast._id});
          if(data_get == null) return "there is no type of this podcast";
          converter.map((data)=>{
            if(data._id == updatedPodcast._id){
                converter.splice(meet_condition,1, data_get);
            }
            meet_condition++;
          });
          meet_condition=0;
          // set in to the cache 
          await redisClientCache.setEx("podcast",60*60,JSON.stringify(converter));
      }
      // ==================<< end of new defince cache
      // that's it 
    }else if(file_audio == undefined && file_image){
          // use podcast id to find the podcast need to be updated
        const updatedPodcast = await podcastModel.findOne({_id : podcast_id });
        console.log(updatedPodcast)
        const previous_imageName = updatedPodcast.imageName;
        // upload the new podcast to the databse
        const imageName = FileName_or_Key();
        const response_image = await S3.send(new PutObjectCommand({
                Bucket : process.env.bucketimages_name,
                Key    : imageName,
                Body   : file_image[0].buffer,
                ContentType : image_type
              }));  
      // get sign url 
      const imgCommand = new GetObjectCommand({
        Bucket : process.env.bucketimages_name,
        Key    : imageName,
        ContentType : image_type
      }) ;
      // find url respectively
      const imgUrl = await getSignedUrl(S3,imgCommand,{expiresIn : 3600});
      const Category = await categoryModel.findOne({_id : category});
      if(Category == null){
          // show the user there is no type of this category exist
          return "there is no sort of this category"
      }
      // update to data 
      const updater = await podcastModel.updateOne({_id : podcast_id},{
        podcastTitle : title,
        owner : composer,
        podcastCategoryName : Category.podcastCategoryName,
        podcastDescription: description,
        imageName : imageName,
        imageUrl : imgUrl
      });
      // after update to database we need to delete from AWS bucket 
      const delete_image = new DeleteObjectCommand({
        Bucket : process.env.bucketimages_name,
        Key    : previous_imageName,
      })
      // send this command to delete image 
      const successOfimageDelete = await S3.send(delete_image);
      const data_cache = await redisClientCache.get("podcast");
      let meet_condition=0;
      if(data_cache){
          let converter = JSON.parse(data_cache);
          const data_get = await podcastModel.findOne({_id : updatedPodcast._id});
          console.log("====")
          console.log(data_get);
          if(data_get == null) return "there is no this podcast";
          converter.map((data)=>{
              if(data._id == updatedPodcast._id){
                 converter.splice(meet_condition,1,data_get);
              }
              meet_condition++;
          });
          meet_condition=0;
          // set in to the cache 
          await redisClientCache.setEx("podcast",60*60,JSON.stringify(converter));
      }
      // that's it 
    } else if(file_image == undefined && file_audio){
       // use podcast id to find the podcast need to be updated
       const updatedPodcast = await podcastModel.findOne({_id : podcast_id });
       const previous_audioName = updatedPodcast.audioName;
       // upload the new podcast to the databse
       const audioName = FileName_or_Key();
       const response_audio = await S3.send(new PutObjectCommand({
               Bucket : process.env.bucketaudios_name,
               Key    : audioName,
               Body   : file_audio[0].buffer,
               ContentType : audio_type
             }));
     // get sign url 
     const audioCommand = new GetObjectCommand({
       Bucket : process.env.bucketaudios_name,
       Key    : audioName,
       ContentType : audio_type
     })
     // find url respectively
     const audioUrl = await getSignedUrl(S3,audioCommand,{expiresIn : 3600});
     const Category = await categoryModel.findOne({_id : category});
     if(Category == null){
      // show the user there is no type of this category exist
      return  "there is no sort of this category";
    }
     // update to data 
     const updater = await podcastModel.updateOne({_id : updatedPodcast._id},{
       podcastTitle :title,
       owner:composer,
       podcastCategoryName :Category.podcastCategoryName,
       podcastDescription:description,
       audioName : audioName,
       podcastUrl : audioUrl,
     });
     // after update to database we need to delete from AWS bucket 
     const delete_audio = new DeleteObjectCommand({
      Bucket : process.env.bucketaudios_name,
      Key    : previous_audioName,
    });
     // send this command to delete audio 
     const successOfaudioDelete = await S3.send(delete_audio);
     const data_cache = await redisClientCache.get("podcast");
      if(data_cache){
          let converter = JSON.parse(data_cache);
          const data_get = await podcastModel.findOne({_id : updatedPodcast._id});
          if(data_get == null)  return "there is no this podcast";
          let meet_condition = 0;
          converter.map((data)=>{
              if(data._id == data_get._id){
                converter.splice(meet_condition,1,data_get);
              }   
              meet_condition++;         
          });
          meet_condition = 0
          // set in to the cache 
          await redisClientCache.setEx("podcast",60*60,JSON.stringify(converter));
      }
     // that's it 
    }else{
      // if only update the text 
      const Category = await categoryModel.findOne({_id : category});
      if(Category == null){
        // show the user there is no type of this category exist
        return "there is no sort of this category";
      }
      try{
        const updater = await podcastModel.updateOne({_id : podcast_id},{
          podcastTitle :title,
          owner : composer,
          podcastCategoryName:Category.podcastCategoryName,
          podcastDescription: description,
        });
        const data_cache = await redisClientCache.get("podcast");
        if(data_cache != null){
          let converter = JSON.parse(data_cache);
          const data_get = await podcastModel.findOne({_id : podcast_id});
          
          let meet_condition = 0;
          converter.map((data)=>{
              if(data._id == data_get._id){
                  converter.splice(meet_condition,1,data_get);
              }
              meet_condition++;
          });
          meet_condition = 0;
          
          // set in to the cache 
          await redisClientCache.setEx("podcast",60*60,JSON.stringify(converter));
        }
      }catch(e){
        return e.message;
      }
      
    }
    return "success";
}
//==================================================
// Delete podcas  from database
//==================================================
async function DeletePodcast(podcast_id){
    // use the id to find the data from the database 
    const data = await podcastModel.findOne({_id : podcast_id});
    // check if the data is not empty from the database response
    if(data){
      // ge the podcast image name and podcast name from database
      const deletedPodcastId = data._id;
      const imageName = data.imageName;
      const podcastName = data.audioName;
      // after getting the name of both image and audio and the id of that podcast
      // delete data from database
      const deleted = await podcastModel.deleteOne({_id : deletedPodcastId});
      // delete image and audio from AWS bucket s3
      const audio_deleted_command ={
          Bucket : process.env.bucketaudios_name,
          Key    : podcastName,
      }
      const image_deleted_command = {
        Bucket : process.env.bucketimages_name,
        Key    : imageName,
      }
      const imageDeleter  = new DeleteObjectCommand(image_deleted_command);
      const audioDeleter  = new DeleteObjectCommand(audio_deleted_command);
      // send command 
      await S3.send(imageDeleter);
      await S3.send(audioDeleter);
      // =============< define new cache for the delete podcast section
      const data_cache = await redisClientCache.get("podcast");
      if(data_cache){
          const converter = JSON.parse(data_cache);
          const final_data = converter.filter((data)=>{
            return data._id != deletedPodcastId;
          });
           // set the expiry time for the new podcast list
         await redisClientCache.setEx("podcast",60*60,JSON.stringify(final_data));
      }
     // ======================<< end of new define cache
      // after delete the podcast from the storage return success of deleteing the podcast
      return "delete success" ;
    }else{
      return "fail to delete since there is no data in the database." ;
    }
}
//==================================================
// get all data from database
//==================================================

async function ListAllPodcast(){
   
    // ================<< define the new cache before the podcasts are returned to the client
    const data_cache = await redisClientCache.get("podcast");
    if(data_cache){
        const converter = JSON.parse(data_cache);
        return converter;
    }else{
       // get all available podcast in db
        const data = await podcastModel.find({});
        // before returning all the podacasts to the client save it the cache first
        redisClientCache.setEx("podcast",60*60,JSON.stringify(data));
        // return dall the data to client
        return data ;
    }
    
}

//==================================================
// get all data of a particular podcaster 
//===================================================
async function ListPodcastByPodcaster(podcaster_id){
    // check the cache wether this request is already cached
    //================================
    //  || podcasterpodcast || is the name defined of the podcast of a particualr podcast stored in redis
    //================================
    const data_cache = await redisClientCache.get("podcasterpodcast");
    if(data_cache){
        const converter = JSON.parse(data_cache);
        // return the parsing dat to client 
        return converter;
    }else{
        // find the podcaster id 
        const id_podcaster = await signupModel.findOne({_id : podcaster_id });
        if(id_podcaster){
            // get id to find all available podcast own by that user
            const data = await podcastModel.find({podcasterId : id_podcaster._id});
            // before returning the result to the client save it the redis cache
            redisClientCache.setEx("podcasterpodcast",60*60,JSON.stringify(data));
            // return all the data to the client request
            return data;
        }else{
            return "No data";
        }
    }
    
}

//==================================================
// get all data of a particular podcaster 
//===================================================
async function ListPodcastByCategory(category_type){
  // get id to find all available podcast own by that user
  //==============================
  // || categorypodcast || is the name defined for the category podcast in the redis cache
  //==============================
  const data_cache = await redisClientCache.get("categorypodcast");
  // check if the the podcast of this categorey is alrady existed
  if(data_cache){
      const converter = JSON.parse(dat_cache);
      // return the rsult of the client
      return converter;
  }else{
      const category = await categoryModel.findOne({categoryType : category_type});
      if(category){
        const data = await podcastModel.find({podcastCategoryName : category_type});
        // before return the data to the client save them to the cache first
        redisClientCache.setEx("categorypodcast",60*60,JSON.stringify(data));
        // return all the data to the client request
        return data;
      }else{
        return "No this type of category";
      }
  }
 
}
//==================================================
// get all podcaster
//===================================================
async function ListAllPodcaster(){
  // get id to find all available podcast own by that user
  //====================================================
  // podcast is the name defined in the redis cache 
  // ===================================================
  const data_cache = await redisClientCache.get("podcaster");
  if(data_cache){
      const converter = JSON.parse(data_cache);
      // after getting all data from the cache parsing 
      return converter;
  }else{
    const data = await signupModel.find({role : "podcaster"});
    // before returning the result to the client set it to cache first
    redisClientCache.setEx("podcaster",60*60,JSON.stringify(data));
    // return all the data to the client request
    return data;
  }

}
//==================================================
// get all category
//===================================================
async function ListAllCategory(){
  // get id to find all available podcast own by that user
  // catgory is the defined in the cache of redis server cache
  const data_cache = await redisClientCache.get("category");
  if(data_cache){
      const converter = JSON.parse(data_cache);
      // return all the data to the 
      return converter;
  }else{
    const data = await categoryModel.find({});
    // set the category to the cache before sending to stored in the cache
    redisClientCache.setEx("category",60*60,JSON.stringify(data));
    // return all the data to the client request
    return data;
  }
  
}
//=====================================
// Delete podcaster 
//=====================================
async function DeletePodcaster(podcaster_id){
  // find that id in database
  const podcaster = await signupModel.findOne({_id : podcaster_id});
  if(podcaster){
      const real_id = podcaster._id;
      // delete all podcasts related to this podcaster
      const podcasts = await podcastModel.find({podcasterId : real_id});
      // loop through that array 
      if(podcasts.length > 0){
          for(let podcast of podcasts){
            const audio_deleter = new DeleteObjectCommand({
              Bucket : process.env.bucketaudios_name,
              Key    : podcast.audioName,
            })
            const image_deleter = new DeleteObjectCommand({
              Bucket : process.env.bucketimages_name,
              Key : podcast.imageName,
            })
            // send the command to delete from Bucket
            await S3.send(audio_deleter);
            await S3.send(image_deleter);
        }
        //  after completely delete from storage let delete it from database
        await podcastModel.deleteMany({podcasterId : real_id});
        // after completely delete the podcast please get start deleting that podcaster from db
        await signupModel.deleteOne({_id : real_id});
        // return the result of the given task when it is completed 
        return "delete podcaster success";

      }else{
        return "No data";
      }

    }else{
        return "No data";
    }
}
//=====================================
// Delete category
//=====================================
async function DeleteCategory(category_id){
  // find if has that category
  const category = await categoryModel.findOne({_id : category_id});
  if(category){
    // find all the podcasts related to this category
    const podcasts = await podcastModel.find({podcastCategoryId : category._id});
    // if has the data 
    if(podcasts.length >0){
       // delete all the podcast from aws 
       for(let podcast of podcasts){
            const audio_deleter = new DeleteObjectCommand({
              Bucket : process.env.bucketaudios_name,
              Key    : podcast.audioName,
            })
            const image_deleter = new DeleteObjectCommand({
              Bucket : process.env.bucketimages_name,
              Key : podcast.imageName,
            })
            // send the command to delete from Bucket
            await S3.send(audio_deleter);
            await S3.send(image_deleter);
        }
        // delete all podcast related to this category
         await podcastModel.deleteMany({podcastCategoryId : category._id});
        // after delete all podcast in aws , let move to delete in category
        await categoryModel.deleteOne({_id : category._id});
        // delete that category in the cache as well
        const data_cache = await redisClientCache.get("category");
        if(data_cache){
            const converter = JSON.parse(data_cache);
            const new_data = converter.filter((data)=>{
              return data._id == category._id
            })
            // set the new data to the cache
            redisClientCache.setEx("category",60*60,JSON.stringify(new_data));
        }
        return "delete category success";
    }else{
      return "No data";
    }
  }else{
    return "No data";
  }
}
//=====================================
// update category
//=====================================
async function UpdateCategory(category_id,category_name){
  // find if has that category
  const category = await categoryModel.findOne({_id : category_id});
  if(category){
    // find all the podcasts related to this category
    const podcasts = await podcastModel.find({podcastCategoryId : category._id});
    // if has the data 
    if(podcasts.length >0){
        // update the all the podcast related to this category
         await podcastModel.updateMany({podcastCategoryId : category._id},{podcastCategoryName : category_name});
        // after delete all podcast in aws , let move to delete in category
        await categoryModel.updateOne({_id : category._id},{categoryType : category_name});
        // const the category in cache 
        const category_data = await categoryModel.findOne({_id : category_id});
        const data_cache = await redisClientCache.get("category");
        if(data_cache){
            const converter = JSON.parse(data_cache);
            converter.map((data)=>{
                  if(data._id == category_id){
                        data = category_data;
                  }
            });
            redisClientCache.setEx("category",60*60,JSON.stringify(converter));
        }
        return "update category success";
    }else{
      return "No data";
    }
  }else{
    return "No data";
  }
}
//=====================================
// ban podcaster 
//=====================================
async function BanPodcaster(podcaster_id){
  // find that podcaster in database
  const podcaster = await signupModel.findOne({_id : podcaster_id});
  if(podcaster){
    // find all the podcast related to this podcaster 
    try{
      const podcasts = await podcastModel.find({podcasterId : podcaster._id});
      if(podcasts.length>0){
         // loop through and sent it to ban all
         await podcastModel.updateMany({podcasterId : podcaster._id},{ban : "banned"});
         // after ban to all the podcast let bann to that user account
         await signupModel.updateOne({_id : podcaster._id},{ban : "banned"});
         // return the reult to the user
         return "Bann podcaster success";
      }else{
        return "No podcast";
      }
    }catch(e){
      return e.message;
    }
  }else{
    return "No data";
  }
}
//=====================================
// unban podcaster 
//=====================================
async function DisbanPodcaster(podcaster_id){
    // find that podcaster in database
  const podcaster = await signupModel.findOne({_id : podcaster_id});
  if(podcaster){
    // find all the podcast related to this podcaster 
    try{
      const podcasts = await podcastModel.find({podcasterId : podcaster._id});
      if(podcasts.length>0){
         // loop through and sent it to ban all
         await podcastModel.updateMany({podcasterId : podcaster._id},{ban : "disbanned"});
         // after ban to all the podcast let bann to that user account
         await signupModel.updateOne({_id : podcaster._id},{ban : "disbanned"});
         // return the reult to the user
         return "Disbann podcaster success";
      }else{
        return "No podcast";
      }
    }catch(e){
      return e.message;
    }
  }else{
    return "No data";
  }
};
//=====================================
// ban podcast 
//=====================================
async function Banpodcast(podcast_id){
  const podcast = await podcastModel.findOne({_id : podcast_id});
  if(podcast){
    // please bann to that podcast
    await podcastModel.updateOne({_id : podcast._id},{ban : "banned"});
    return "Podcast banned success";
  }else{
    return "No data";
  }
}
//=====================================
// Disban podcast 
//=====================================
async function Disbanpodcast(podcast_id){
  const podcast = await podcastModel.findOne({_id : podcast_id});
  if(podcast){
    // please bann to that podcast
    await podcastModel.updateOne({_id : podcast._id},{ban : "disbanned"});
    return "Podcast disbanned success";
  }else{
    return "No data";
  }
}
//===================================
// podcasst auto generate url 
//===================================
async function RegenerateUrlAllPodcast(){
    // get all podcast from database 
    const data = await podcastModel.find({});
    // predefine command 
    
    // after get all data let generate images url first 
    if(data !=  null){
      
      for( let podcast of data){
        const imgCommand = new GetObjectCommand({
          Bucket : process.env.bucketimages_name,
          Key    : podcast.imageName,
        }) ;
        const audioCommand = new GetObjectCommand({
          Bucket : process.env.bucketaudios_name,
          Key    : podcast.audioName,
        })
        const imgUrl = await getSignedUrl(S3,imgCommand,{expiresIn : 3600});
        const audioUrl = await getSignedUrl(S3,audioCommand,{expiresIn : 3600});
        // after ge image url please insert to that podcast
        const update = await podcastModel.updateOne({_id : podcast._id},{imageUrl : imgUrl,podcastUrl : audioUrl});
      }
      // set all the podcast regenerated url to the cache
      const allPodcasts = await podcastModel.find({});
      redisClientCache.setEx("podcast",3600,JSON.stringify(allPodcasts));
    }else{
        return "No data"
    }  
}

// podcaster upload profile 
async function uploadProfile(file , email,filename,file_type){
    // check if the user login or already exist 
    const user = await signupModel.findOne({email : email});
    if(user){
      // check the type of file upload 
      if(file_type == null){
        return {
          error: true,
          message : "this type is not allowed"
      }
      }else{
          // if the file type is passed prepare s3 code to upload 
          try{
            const profilename = filename();
            const response_profile = await S3.send(new PutObjectCommand({
              Bucket : process.env.bucketprofile_name,
              Key    : profilename,
              Body   : file.buffer,
              ContentType : file_type
            }));
            // get the response 
            if(response_profile){
                // get the data back from the server storage 
                const profileCommand = new GetObjectCommand({
                  Bucket : process.env.bucketprofile_name,
                  Key    : profilename,
                  ContentType : file_type
                })
                // find url respectively
                const profileUrl = await getSignedUrl(S3,profileCommand,{expiresIn : 3600});
                // write data the database
                const profile = new podcasterProfileModel({
                  podcasterId : user._id,
                  profileName : profilename,
                  profileUrl : profileUrl
                });
                const resutl = await profile.save();
                  return {
                    error: false,
                    message : "profile is uploaded successfully"
                  }
            }else{
              return {
                error: true,
                message : "profile is not uploaded, because there is some problem"
              }
            }    
          }catch(e){
              return {
                  error : true,
                  message : e.message
              }
          }

      }
    }else{
      return {
        error: true,
        message : "please login before upload your profile"
     }
    }
}
// update profile 
// podcaster upload profile 
async function updateProfile(file , email,filename,file_type){
  // check if the user login or already exist 
  const user = await signupModel.findOne({email : email});
  if(user){
    // check the type of file upload 
    if(file_type == null){
      return {
        error: true,
        message : "this type is not allowed"
    }
    }else{
        // if the file type is passed prepare s3 code to upload 
          const profilename = filename();
          const profile = await podcasterProfileModel.findOne({podcasterId : user._id});
          try{
          if(profile){
            console.log("has the profile");
             // delete the prevous profile 
             console.log(process.env.bucketprofile_name);
             const delete_profile = new DeleteObjectCommand({
              Bucket : process.env.bucketprofile_name,
              Key    : profile.profileName,
            });
            await S3.send(delete_profile); 
          }else{
            return {
                error : true,
                message : "No this profile podcaster"
            }

          }
        // pushing new profile to storeage  
          const response_profile = await S3.send(new PutObjectCommand({
            Bucket : process.env.bucketprofile_name,
            Key    : profilename,
            Body   : file.buffer,
            ContentType : file_type
          }));
          // get the response 
          if(response_profile){
              // get the data back from the server storage 
              const profileCommand = new GetObjectCommand({
                Bucket : process.env.bucketprofile_name,
                Key    : profilename,
                ContentType : file_type
              })
              // find url respectively
              const profileUrl = await getSignedUrl(S3,profileCommand,{expiresIn : 3600});
              // write data the database
              const profile = await  podcasterProfileModel.updateOne({
                podcasterId : user._id
              },{
                profileName : profilename,
                profileUrl : profileUrl
              });
              if(profile){
                return {
                  error: false,
                  message : "profile is updated successfully"
                }
              }
               
          }else{
            return {
              error: true,
              message : "profile is not uploaded, because there is some problem"
            }
          }    
        }catch(e){
            return {
                error : true,
                status : "error",
                message : e.message
            }
        }

    }
  }else{
    return {
      error: true,
      message : "please login before upload your profile"
   }
  }
}

//************************************************** */
// export global use
//************************************************** */
module.exports = {updateProfile,uploadProfile,UploadSrc,ListAllPodcast,ListAllCategory,ListAllPodcaster,RegenerateUrlAllPodcast,ListPodcastByCategory,ListPodcastByPodcaster,updatePodcast,DeletePodcast,DeletePodcaster,DeleteCategory,BanPodcaster,DisbanPodcaster,Banpodcast,Disbanpodcast,UpdateCategory};