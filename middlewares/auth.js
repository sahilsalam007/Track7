const User=require("../models/userSchema");


const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    req.user = data;  // ✅ Set req.user with the user object
                 // Debug log
                    next();
                } else {
                    res.redirect("/login");
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware", error);
                res.status(500).send("Internal Server Error");
            });
    } else {
        res.redirect("/login");
    }
};


const isSessionAdmin=(req,res,next)=>
    {
        if(req.session.admin)
        {
            next()
        }
        else
        {
            res.redirect("/admin/login")
        }
};
    

const adminAuth=(req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next();
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in adminAuth middleware",error);
        res.status(500).send("Internal Server Error")
    })
};


const session=async(req, res, next) => {
    try{
        const user=await User.findById(req.session.user)
        res.locals.user = user || null;  // Set user from session
        next();
    }catch(error){
        console.log(error.message)
    }
};

module.exports={
    userAuth,
    adminAuth,
    isSessionAdmin,
    session
}