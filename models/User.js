import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{type:String, required:true},
    email:{type:String, required:true},
    password:{type:String, default:null},
    provider:{type:String,default:"credentials"},
    image:{type:String,default:null},
    emailVerified:{type:Date,default:null}
},{timestamps:true})

export default mongoose.models?.User || mongoose.model("User",userSchema)