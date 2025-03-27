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
            enum: ["Pending", "paid", "failed", "refunded", "processing", "Processing"], // Added "Processing"
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
        enum: ["Pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "return-requested", "returned", "Processing","paid","completed"], // Added "Processing"
        default: "pending"
    },
})
const Order=mongoose.model("Order",orderSchema);
module.exports=Order;