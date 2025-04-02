const User=require("../../models/userSchema");
const Wishlist=require("../../models/wishlistSchema")


const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: "products.productId",
            });

        const wishlistProducts = wishlist && wishlist.products ? wishlist.products : [];

        res.render("wishlist", {
            wishlist: wishlistProducts,
        });
    } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).send("Internal Server Error");
    }
};

const addToWishlist=async(req,res)=>{
    try {
        const productId=req.body.productId;
        const userId=req.session.user;

        let wishlist=await Wishlist.findOne({userId:userId});
        if(!wishlist){
            wishlist=new Wishlist({
                userId:userId,
                products:[]
            });
        }
        const productExists=wishlist.products.some(item=>
            item.productId.toString()===productId
        );
        if(productExists){
            return res.status(200).json({success:false, message:"Product already in wishlist"});
        }
        wishlist.products.push({productId:productId,addedOn: new Date()});
        await wishlist.save();
        return res.status(200).json({success:true,message:"Product added to wishlist"});
    } catch (error) {
        console.error("Error adding to wishlist:",error);
        return res.status(500).json({success:false,message:"Server error"});
    }
}

const removeWishlist=async(req,res)=>{
    try {
        const {productId}=req.body;
        const userId=req.user._id;

        await Wishlist.updateOne(
            {userId},
            {$pull:{products:{productId}}}
        )
        res.json({success:true});
    } catch (error) {
        console.error("Error removing from wishlist:",error);
        res.json({success:false});
    }
}

module.exports={
    getWishlist,
    addToWishlist,
    removeWishlist
}