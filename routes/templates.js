const express = require("express");
const router = express.Router();
const multer = require("multer");
const unzipper = require("unzipper");
const fs = require("fs");
const path = require("path");
const { Template, Transaction, Order } = require("../models");
const upload = multer({ dest: "temp_zips/" });

router.get("/test", (req, res) => {
  res.send("Templates test route working.");
});
router.get("/upload", (req, res) => {
  res.render("upload-theme", { title: "Upload Theme" });
});
router.get("/admin/list", async (req, res) => {
  // Fetch all templates from the database
  try {
    const templates = await Template.findAll();
    res.render("template-list", {
      title: "Template List",
      templates: templates,
      message: null, // or any message you want to display
    });
    console.log(templates);
  } catch (error) {
    console.error("Error fetching templates: ", error);
    res.status(500).send("Error fetching templates.");
  }
});
router.get("/admin/orders", async (req, res) => {
  try {
    const orders = await Order.findAll();
    res.render("orders", {
      title: "Orders",
      orders: orders,
      message: null, // or any message you want to display
    });
    console.log(orders);
  } catch (error) {
    console.error("Error fetching orders: ", error);
    res.status(500).send(error);
  }
});
router.get("/admin/payments", async (req, res) => {
  try {
    const payments = await Transaction.findAll();
    console.log(payments);

    res.render("payments", {
      title: "Payments",
      payments: payments,
      message: null, // or any message you want to display
    });
    console.log(payments);
  } catch (error) {
    console.error("Error fetching orders: ", error);
    res.status(500).send("Error fetching orders.");
  }
});
router.post(
  "/themes/upload",
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, description, category, cost } = req.body;
      const thumbnail = req.files["thumbnail"]
        ? req.files["thumbnail"][0]
        : null;
      const file = req.files["file"] ? req.files["file"][0] : null;

      // Validate required fields
      if (!name || !description || !category || !file) {
        return res
          .status(400)
          .send("All fields (name, description, category, file) are required.");
      }
      const destDir = path.join(__dirname, "..", "uploads", "thumbnails");
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const ext = path.extname(thumbnail.originalname);
      const thumbnailFilename = `${thumbnail.filename}${ext}`;
      const thumbnailFullPath = path.join(destDir, thumbnailFilename);

      fs.renameSync(thumbnail.path, thumbnailFullPath);

      // Define file paths for saving
      //   const thumbnailPath = thumbnail
      //   ? `/uploads/thumbnails/${thumbnail.filename}`
      //     : null;

      const zipDestDir = path.join(__dirname, "..", "uploads", "themes");
      if (!fs.existsSync(zipDestDir)) {
        fs.mkdirSync(zipDestDir, { recursive: true });
      }

      const zipExt = path.extname(file.originalname); // e.g. ".zip"
      const zipFilenameWithExt = `${file.filename}${zipExt}`;
      const zipDestPath = path.join(zipDestDir, zipFilenameWithExt);
      const zipFolderName = path.basename(
        file.originalname,
        path.extname(file.originalname)
      ); // "cool-theme"

      fs.renameSync(file.path, zipDestPath);

      const filePath = `/uploads/themes/${zipFilenameWithExt}`;

      const dbThumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
      const previewPath = "public/themes/" + zipFolderName; // Save the path of the preview folder

      // Save the theme data to the database
      const newTemplate = await Template.create({
        name,
        description,
        category,
        cost,
        image: dbThumbnailPath,
        previewPath: previewPath,
        zipPath: zipFolderName, // Save the path of the zip file
      });

      // Optionally, unzip the file if it's a zip file
      //   if (file.mimetype === "application/zip") {
      if (zipExt === ".zip") {
        const extractPath = path.join(
          __dirname,
          "..",
          "public",
          "themes",
          String(newTemplate.id)
        );
        fs.mkdirSync(extractPath, { recursive: true });

        const stream = fs
          .createReadStream(zipDestPath)
          .pipe(unzipper.Extract({ path: extractPath }));

        stream.on("close", () => {
          console.log("Extraction complete");
          res.render("upload-theme", {
            title: "Upload Theme",
            message: "Theme uploaded successfully!", // or null
          });
        });

        stream.on("error", (err) => {
          console.error("Error during extraction: ", err);
          res.status(500).send("Error extracting theme.");
        });
      }
    } catch (err) {
      console.error("Error uploading theme: ", err);
      res.status(500).send("Error uploading theme. Please try again.");
    }
  }
);
router.post("/edit/:id", async (req, res) => {
  try {
    const { name, description, category, cost } = req.body;
    const { id } = req.params;

    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).send("Template not found");
    }

    // Update the template in the database
    await Template.update(
      { name, description, category, cost },
      { where: { id } }
    );

    res.redirect("/templates/admin/list");
  } catch (error) {
    res.status(500).send("Error updating template.");
  }
});
router.post("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the template by ID
    const template = await Template.findByPk(id);
    if (!template) {
      return res.status(404).send("Template not found");
    }

    // Delete the template from the database
    await Template.destroy({ where: { id } });

    res.redirect("/templates/admin/list");
  } catch (error) {
    res.status(500).send("Error deleting template.");
  }
});
// Preview Route
router.get("/preview/:slug", async (req, res) => {
  const { slug } = req.params;
  const template = await Template.findOne({ where: { slug } });

  if (!template) return res.status(404).send("Template not found");

  res.render("preview", { slug: template.slug });
});

module.exports = router;
