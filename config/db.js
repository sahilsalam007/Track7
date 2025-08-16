// connect a Node.js application to a MongoDB database
const mongoose=require("mongoose");
require("dotenv").config();

const connectDB=async ()=>{
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("DB Connected");
    }catch(error){
        console.log("DB Connected error",error.message);
        process.exit(1);
    }
}
module.exports=connectDB;