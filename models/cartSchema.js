const mongoose=require("mongoose");
const {Schema}=mongoose;

const cartSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    items:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            default:1,
            min:1
        },
        price:{
            type:Number,
            required:true
        },
        maxQuantity:{
            type:Number,
            required:true
        }
    }],
    createdAt:{
        type:Date,
        default:Date.now
    },
    updateAt:{
        type:Date,
        default:Date.now
    }
},{timestamps:true});

const Cart=mongoose.model("Cart",cartSchema);
module.exports=Cart;