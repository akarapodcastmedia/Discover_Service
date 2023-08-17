const Joi = require('joi');

const podcastValidation = (body) => {
    const schema = Joi.object().keys({
        title : Joi.string().min(3).max(30).required(),
        category : Joi.string().label("category").required(),
        description : Joi.string().required()
        
    });
    // validate schema 
    return schema.validate(body);
}

const podcasterCategoriesValidation = (body) =>{
    const schema = Joi.object().keys({
        categoryId  : Joi.string().required()
    })
    return schema.validate(body);
}
const categoryValidation = (body) => {
    const schema = Joi.object().keys({
        categoryType : Joi.string().required()
    })
    return schema.validate(body);
}

module.exports = {
    podcastValidation,
    podcasterCategoriesValidation,
    categoryValidation
}