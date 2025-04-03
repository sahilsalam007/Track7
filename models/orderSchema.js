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
     },
     productStatus:{
        type:String,
        enum:['Confirmed','Processing','Shipped','Delivered','Cancelled','Return-Request','Returned','Pending'],
        default:'Confirmed'
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
   
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    payment: {
        method: {
            type: String,
            enum: ["cod", "razorpay","wallet"],
            default: "cod"
        },
        status: {
            type: String,
            enum: ["Pending", "Paid", "Failed", "refunded", "processing", "Processing"], 
            default: "Pending"
        },
        razorpayDetails: {
            paymentId: String,
            orderId: String,
            signature: String
        }
    },
    status: {
        type: String,
        enum: ["Pending", "confirmed", "processing", "shipped", "Delivered", "cancelled", "return-requested", "returned","Failed"],
        default: "pending"
    },
})
const Order=mongoose.model("Order",orderSchema);
module.exports=Order;