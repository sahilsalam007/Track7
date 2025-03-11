const mongoose=require("mongoose");
const {Schema}=mongoose;

const productSchema=new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    brand:{       
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salesPrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:0
    },
    maxPurchaseQuantity:{
        type:Number,
        default:10
    },
    color:{
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isListed:{
        type:Boolean,
        default:true
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discontinued"],
        required:true,
        default:"Available"
    },
},  {timestamps:true});

productSchema.virtual("inStock").get(function(){
    return this.quantity > 0 && this.status ==="Available";
})

const Product=mongoose.model("Product",productSchema)
module.exports=Product;