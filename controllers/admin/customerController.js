const User=require("../../models/userSchema");


const customerInfo=async(req,res)=>{
    try{
             let search ="";
             if(req.query.search){
                search=req.query.search;
             }  
             let page=1;
             if(req.query.page){
                page=req.query.page
             }
             const limit=10;
             const userData=await User.find({
                isAdmin:false,
                $or:[
                    {name:{$regex:".*"+search+".*"}},
                    {email:{$regex:".*"+search+".*"}}
                ],
             })
             .limit(limit)
             .skip((page-1)*limit)
             .exec();
             
             const count=await User.find({
                isAdmin:false,
                $or:[
                    {name:{$regex:".*"+search+".*"}},
                    {email:{$regex:".*"+search+".*"}}
                ],
             }).countDocuments();
             const totalPages = count > 0 ? Math.ceil(count / limit) : 1;
             res.status(200).render("customers", { 
                data: userData, 
                totalPages: totalPages, 
                currentPage: page ,
                search : search
            });
    }
    catch(error){
        console.error(error);
        res.status(500).send("Server Error");
    }
};


const customerBlocked=async (req,res)=>{
    try{
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        
        res.status(200).redirect("/admin/users");
    }catch(error){
        res.status(500).redirect("/pageerror")
    }
};


 const customerunBlocked=async (req,res)=>{
    try{
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.status(200).redirect("/admin/users")
    }catch(error){
        res.status(500).redirect("/pageerror")
    }
};


module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked
}