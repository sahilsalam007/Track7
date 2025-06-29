const User=require("../models/userSchema");
const mongoose=require('mongoose');


const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    req.user = data;
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
   if(req.session.admin && mongoose.Types.ObjectId.isValid(req.session.admin)){
     User.findById(req.session.admin)
    .then((admin)=>{
        if(admin){
            next();
        }else{
            req.session.destroy();
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Error in adminAuth middleware",error);
        res.status(500).send("Internal Server Error")
    })
}else{
    
    res.redirect("/admin/login")
}
};


const session = async (req, res, next) => {
    try {
        if (req.session.user) {
            const user = await User.findById(req.session.user);

            if (!user || user.isBlocked) {
                req.session.destroy(() => {
                    res.locals.user = null; // 🧹 Don't pass any user to views
                    return res.redirect('/');
                });
            } else {
                res.locals.user = user; // ✅ only if user is valid & not blocked
                next();
            }
        } else {
            res.locals.user = null;
            next();
        }
    } catch (error) {
        console.log("Error in session middleware:", error.message);
        res.status(500).send("Internal Server Error");
    }
};


module.exports={
    userAuth,
    adminAuth,
    isSessionAdmin,
    session
}