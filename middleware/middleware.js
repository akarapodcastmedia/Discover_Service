require("dotenv").config();
const jwt = require("jsonwebtoken");

const TokenValidator = async(req,res,next)=>{
    // check token input 
    const token = req.header("Authorization");
    console.log(token);
    if(token){
        // check if the token in the format of bearer 
        try{
            // check if it is actually bearer token 
            const bearer = token.split(" ")[0];
            console.log(bearer);
            if(bearer=="bearer"){
                // get token 
                const access = token.split(" ")[1];
                console.log("hellow");
                console.log(access);
                jwt.verify(access,process.env.PROGRAM_TOKEN_SECRET,(error,user)=>{
                    if(error){
                        return res.json({
                            error : true,
                            message : error.message
                        })
                    }else{
                        console.log(user);
                        if(user.role != null){
                            const role = user.role;
                            const scope = user.scope;
                            if(role == "podcaster" || role == "admin" || (scope=="desktop" && role=="user") || (scope=="mobile" && role=="user")){
                                req.email = user.email;
                                req.role  = user.role;
                                req.username = user.username;
                                req.user  = user.user;
                                req.scope = user.scope;
                                next();
                            }else{
                                return res.json({
                                    error : true ,
                                    message :"Your role is not allowed"
                                })
                            }
                        }else{
                            return res.json({
                                error : true ,
                                message : "You are not allowed , please login"
                            })
                        }
                    }
                })
            }else{
                return res.json({
                    error : true,
                    message : "require bearer token format"
                })
            }
        }catch(e){
            return res.json({
                error : true,
                message : e.message
            })
        }
    }else{
        return res.json({
            error : true,
            message : "require token ..."
        })
    }
}
module.exports =  {
    TokenValidator
}