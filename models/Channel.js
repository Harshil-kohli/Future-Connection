import mongoose from "mongoose";

const channelSchema = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"user", required:true},
    name:{type:String, required:true, unique: true},
    description:{type:String, default:"No description added."},
    visibility:{type:String, default:"private"},
},{timestamps:true})

channelSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.Channel || mongoose.model("Channel",channelSchema)

