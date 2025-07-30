const mongoose=require("mongoose");
const {Schema}=mongoose;

const userSchema=new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:false,
        sparse:true,
        default:null
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true,
    },
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart: [{
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        quantity: Number
      }],
    wallet:[{
        type:Schema.Types.ObjectId,
        ref:"Wishlist"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referralCode: {
        type: String,
        unique: true,
        default: function () {
          const namePart = this.name ? this.name.substring(0, 3).toUpperCase() : "USR";
          const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
          return `${namePart}${randomPart}`;
  }
}
,
    referredBy: {
        type: mongoose.Types.ObjectId,
        ref :"User",
        default : null,
    },
    redeemed:{
        type:Boolean,
        default:false
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
})


const User=mongoose.model("User",userSchema);
module.exports=User;