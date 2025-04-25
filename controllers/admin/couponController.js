const Coupon=require("../../models/couponSchema");
const mongoose=require("mongoose")

const loadCoupon = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const [coupons, totalCoupons] = await Promise.all([
            Coupon.find({}).sort({createdOn:-1}).skip(skip).limit(limit),
            Coupon.countDocuments()
        ]);

        const totalPages = Math.ceil(totalCoupons / limit);

        return res.status(200).render("coupon", {
            coupons,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        return res.status(500).redirect("/pageerror");
    }
};


const createCoupon=async(req,res)=>{
    try {
        const data={
            couponName:req.body.couponName,
            startDate:new Date(req.body.startDate +"T00:00:00"),
            endDate:new Date(req.body.endDate + "T00:00:00"),
            offerPrice:parseInt(req.body.offerPrice),
            minimumPrice:parseInt(req.body.minimumPrice)
        }
        const newCoupon=new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expireOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        });
        await newCoupon.save();
        return res.status(201).redirect("/admin/coupon");
    } catch (error) {
        res.status(500).redirect("/pageerror")
    }
};


const editCoupon=async(req,res)=>{
    try {
        const id=req.query.id;
        const findCoupon=await Coupon.findOne({_id:id});
        res.render("edit-coupon",{
            findCoupon:findCoupon,
        })
    } catch (error) {
      return res.status(500).redirect("/pageerror")
    }
};


const updateCoupon=async(req,res)=>{
    try {
        const couponId=req.body.couponId;
        const oid=new mongoose.Types.ObjectId(couponId);
        const selectedCoupon=await Coupon.findOne({_id:oid});
        if(selectedCoupon){
            const startDate=new Date(req.body.startDate);
            const endDate=new Date(req.body.endDate);
            const updatedCoupon=await Coupon.updateOne(
                {_id:oid},
                {
                    $set:{
                        name:req.body.couponName,
                        createdOn:startDate,
                        expireOn:endDate,
                        offerPrice:parseInt(req.body.offerPrice),
                        minimumPrice:parseInt(req.body.minimumPrice)
                    },
                },{new:true}
            );
            if(updatedCoupon !==null){
                return res.status(200).send("Coupon updated successfully")
            }else{
                return res.status(404).send("Coupon update failed ")
            }
        }
    } catch (error) {
       return res.status(500).redirect("/pageerror")
    }
};


const deleteCoupon=async(req,res)=>{
    try {
        const id=req.query.id;
        await Coupon.deleteOne({_id:id});
        res.status(200).send({success:true,message:"Coupon deleted successfully"})
    } catch (error) {
        console.error("Error in deleteing coupon:",error);
        res.status(500).send({success:false,message:"Failed to delete coupon"})
    }

};


module.exports={
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon
}