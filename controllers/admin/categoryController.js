const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");

const categoryInfo = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({
      name: { $regex: ".*" + search + ".*", $options: "i" },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments({
      name: { $regex: ".*" + search + ".*", $options: "i" },
    });

    const totalPages = Math.ceil(totalCategories / limit);

    res.status(200).render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
      search: search,
    });
  } catch (error) {
    console.error(error);
    res.status(500).redirect("/pageerror");
  }
};

const addCategory = async (req, res) => {
  const { name, description } = req.body;
  try {
    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }
    const newCategory = new Category({
      name,
      description,
    });

    await newCategory.save();
    return res
      .status(201)
      .json({ success: true, message: "Category added successfully" });
  } catch (error) {
    console.log("Error while adding category",error);
    return res.status(500).json({
      success: false,
      error: "Internal Server error",
    });
  }
};

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }

    category.categoryOffer = percentage;
    await category.save();

    const products = await Product.find({ category: categoryId });

    for (const product of products) {
      const regularPrice = Number(product.regularPrice);
      const productOffer = product.productOffer || 0;
      const highestOffer = Math.max(productOffer, percentage);
      const newSalesPrice = Math.floor(regularPrice * (1 - highestOffer / 100));

      product.salesPrice = newSalesPrice;
      await product.save();
    }

    res.json({ status: true, message: "Category offer applied successfully" });
  } catch (error) {
    console.error("Error in addCategoryOffer:", error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res
        .status(404)
        .json({ status: false, message: "Category not found" });
    }
    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });

    if (products.length > 0) {
      for (const product of products) {
        product.salesPrice += Math.floor(
          product.regularPrice * (percentage / 100)
        );
        product.productOffer = 0;
        await product.save();
      }
    }
    category.categoryOffer = 0;
    await category.save();
    res.json({ status: true });
  } catch (error) {
    console.log("Error while removing category offer",error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

const getListCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.status(200).redirect("/admin/category");
  } catch (error) {
    console.log("Error while listing category",error);
    res.status(500).redirect("/pageerror");
  }
};

const getUnlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.status(200).redirect("/admin/category");
  } catch (error) {
    console.log("Error while unlisting category",error);
    res.status(500).redirect("/pageerror");
  }
};

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findOne({ _id: id });
    res.status(200).render("edit-category", { category: category });
  } catch (error) {
    console.log("Error while editing Category",error);
    res.status(500).redirect("/pageerror");
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    if (!categoryName || !description) {
      return res
        .status(400)
        .json({ error: "Category name and description are required" });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: `^${categoryName}$`, $options: "i" },
    });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description: description },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ success: true, message: "Category updated successfully!" });
  } catch (error) {
    console.log("Error while editing category",error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
};
