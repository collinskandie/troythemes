const express = require("express");
const router = express.Router();
const multer = require("multer");
const unzipper = require("unzipper");
const fs = require("fs");
const path = require("path");
const { Template } = require("../models");
const { title } = require("process");

const upload = multer({ dest: "temp_zips/" });

// Upload Form (Optional UI)
router.get("/upload", (req, res) => {
  res.render("upload-theme", { title: "Upload Theme" });
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

// Preview Route
router.get("/preview/:slug", async (req, res) => {
  const { slug } = req.params;
  const template = await Template.findOne({ where: { slug } });

  if (!template) return res.status(404).send("Template not found");

  res.render("preview", { slug: template.slug });
});

module.exports = router;
