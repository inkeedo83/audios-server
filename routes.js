import { Router } from "express";
import sqlite3 from "sqlite3";
import multer from "multer";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();
// Create and connect to the SQLite database
const db = new sqlite3.Database("app.db");

// Create the Audio table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    genre TEXT,
    imageFile BLOB,
    audioFile BLOB
  )
`);

// Configure multer for handling file uploads
const storage = multer.memoryStorage(); // Store the file in memory
const upload = multer({ storage: storage });

const getDefaultImage = () => {
  // Read the default image from assets (replace 'default-image.jpg' with your default image path)
  const defaultImagePath = join("./", "assets", "default-image.jpg");
  return readFileSync(defaultImagePath);
};

const middleware = (req, res, next) => {
  let errMsg = "";
  if (!req.files || !req.files["audioFile"]) {
    errMsg = "Audio file required";
    return res.status(400).json({ error: errMsg });
  } else if (!req.body.title || req.body.title === "") {
    errMsg = "Title field required";
    return res.status(400).json({ error: errMsg });
  } else if (!req.body.genre || req.body.genre === "") {
    errMsg = "Genre Field required";
    return res.status(400).json({ error: errMsg });
  }

  if (!req.files["imageFile"]) {
    req.files["imageFile"] = [{ buffer: getDefaultImage() }];
  }

  next();
};

const idMiddleware = (req, res, next) => {
  const { id } = req.params;
  const condition = !id || isNaN(Number(id)) || Number(id) <= 0;
  if (condition) return res.status(400).json({ error: "Invalid id value" });
  next();
};

// Routes for Audio
// Get all audio entries
router.get("/audio", (req, res) => {
  db.all(
    "SELECT id, title, genre, imageFile, audioFile FROM audio",
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get a single audio entry by ID
router.get("/audio/:id", idMiddleware, (req, res) => {
  const { id } = req.params;
  db.get(
    "SELECT id, title, genre, imageFile, audioFile FROM audio WHERE id = ?",
    [id],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: "Audio entry not found" });
        return;
      }
      res.json(row);
    }
  );
});

// Create a new audio entry with an audio file upload
router.post(
  "/audio",
  upload.fields([
    { name: "audioFile", maxCount: 1 },
    { name: "imageFile", maxCount: 1 },
  ]),
  middleware,
  (req, res) => {
    const { title, genre } = req.body;
    const audioFile = req.files["audioFile"][0].buffer;
    const imageFile = req.files["imageFile"][0].buffer;

    db.run(
      "INSERT INTO audio (title, genre, audioFile, imageFile) VALUES (?, ?, ?, ?)",
      [title, genre, audioFile, imageFile],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({
          id: this.lastID,
          title,
          genre,
          imageFile,
          audioFile,
        });
      }
    );
  }
);

// Update an audio entry by ID
router.put(
  "/audio/:id",
  idMiddleware,
  upload.single("imageFile"),
  (req, res) => {
    const { id } = req.params;
    const imageFile = req.file ? req.file.buffer : null;
    const { title, genre } = req.body;

    const fields = [];
    const queryArr = [];

    if (imageFile) {
      queryArr.push("imageFile = ?");
      fields.push(imageFile);
    }

    if (title) {
      queryArr.push("title = ?");
      fields.push(title);
    }

    if (genre) {
      queryArr.push("genre = ?");
      fields.push(genre);
    }

    if (fields.length > 0) {
      fields.push(id);
      const query = `UPDATE audio SET ${queryArr.join(", ")} WHERE id = ?`;
      db.run(query, fields, (err) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
      });
    }

    db.get(
      "SELECT id, title, genre, imageFile, audioFile FROM audio WHERE id = ?",
      [id],
      (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!row) {
          res.status(404).json({ error: "Audio entry not found" });
          return;
        }
        res.json(row);
      }
    );
  }
);

// Delete an audio entry by ID
router.delete("/audio/:id", idMiddleware, (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM audio WHERE id = ?", [id], (err) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    res.json({ message: "Audio entry deleted successfully" });
  });
});

export { router, db };
