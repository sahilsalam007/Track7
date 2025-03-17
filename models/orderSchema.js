const mongoose=require("mongoose");
const {Schema}=mongoose;
const {v4:uuidv4}=require("uuid");

const orderSchema=new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderedItems:[{
     product:{
        type:Schema.Types.ObjectId,
        ref:"Product",
        required:true
     },
     quantity:{
        type:Number,
        required:true
     },
     price:{
        type:Number,
        default:0
     }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },finalAmount:{
        type:Number,
        required:true
    },
    address: { 
        addressType: String,
        name: String,
        city: String,
        landMark: String,
        state: String,
        pincode: Number,
        phone: String,
        altPhone: String
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        required:true,
        enum:["Pending","Processing","Shipped","Delivered","Cancelled","Return Request","Returned"]
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    paymentMethod: {
        type: String,
        required: true,
        default:"COD"
    }
})
const Order=mongoose.model("Order",orderSchema);
module.exports=Order;