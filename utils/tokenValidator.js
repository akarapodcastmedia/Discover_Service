const jwt = require("jsonwebtoken");
const tokenValidator = (req,res,next) => {
    const token_auth = req.header("Authorization"); 
    if(token_auth){
        try{
            const validatedToken = token_auth.split(" ")[1];
                jwt.verify(validatedToken,process.env.PROGRAM_TOKEN_SECRET,(error,data)=>{
                    if(error){
                        return res.json({
                            error : true,
                            message : "incorrect token provided or token has expired."
                        })
                    }else{
                        // passing some user credential
                        console.log(data) ;
                        req.credential = data;
                        next();
                    }
                })    
        }catch(e){
            return res.json({
                error : true,
                message : e.message
            })
        }
        
    }else{
        return res.json({
            error : true,
            message :  "No token provide , the process is not allowed"
        })
    }
}
module.exports = {tokenValidator};