const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "dist")));

// MySQL database connection
const db = mysql.createConnection({
  host: "127.0.0.1", // Replace with your MySQL host
  port: "3306",
  user: "tryout", // Replace with your MySQL username
  password: "Superman1431$", // Replace with your MySQL password
  database: "canadian_outlet_adcenter", // Replace with your database name
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    throw err;
  }
  console.log("MySQL connected...");
});

// Serve index.html on root request
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Example route to fetch all products
app.get("/api/products", (req, res) => {
  const sql = "SELECT * FROM Techwave1"; // Adjust table name as needed
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching products:", err);
      return res.status(500).send(err);
    }
    res.json(results);
  });
});

// Route to fetch titles from Techwave1 table
app.get("/title", (req, res) => {
  const sql = "SELECT Title FROM Techwave1"; // Adjust table name as needed
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching titles:", err);
      return res.status(500).send(err);
    }
    res.json(results);
  });
});

// Route to fetch all titles from all tables
app.get("/allTitles", async (req, res) => {
  try {
    const tables = await getTableNames();
    const results = await Promise.all(
      tables.map((table) => fetchTitlesFromTable(table))
    );
    const allTitles = results.flat();
    res.json(allTitles);
  } catch (error) {
    console.error("Error fetching all titles:", error);
    res.status(500).send(error.toString());
  }
});

// Function to get table names
async function getTableNames() {
  return new Promise((resolve, reject) => {
    db.query("SHOW TABLES", (err, tables) => {
      if (err) return reject(err);
      const tableNames = tables.map((row) => Object.values(row)[0]);
      resolve(tableNames);
    });
  });
}

// Function to fetch titles from a specific table
async function fetchTitlesFromTable(table) {
  return new Promise((resolve, reject) => {
    db.query(`SELECT Product_id, Title FROM ${table}`, (err, results) => {
      if (err) return reject(err);
      // Append table name to Product_id to create a unique ID
      const titlesWithUniqueIds = results.map((result) => ({
        uniqueId: `${table}-${result.Product_id}`,
        ...result,
      }));
      resolve(titlesWithUniqueIds);
    });
  });
}

// Endpoint to fetch table names
app.get("/tableNames", async (req, res) => {
  try {
    const tables = await getTableNames();
    res.json(tables);
  } catch (error) {
    console.error("Error fetching table names:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to fetch titles for a specific table
app.get("/titles/:tableName", async (req, res) => {
  const tableName = req.params.tableName;
  try {
    const titles = await fetchTitlesFromTable(tableName);
    res.json(titles);
  } catch (error) {
    console.error(`Error fetching titles for table '\`${table}\`':`, error);
    res.status(500).json({
      error: `Internal server error fetching titles for table '\`${table}\`'`,
    });
  }
});

// Function to fetch titles for a specific table from MySQL
function getTitles(tableName) {
  return new Promise((resolve, reject) => {
    const query = `SELECT Title FROM \`${table}\``; // Adjust SQL query as per your table structure
    db.query(query, (error, results) => {
      if (error) {
        reject(error);
      } else {
        const titles = results.map((row) => ({ Title: row.Title })); // Assuming 'Title' is the column name
        resolve(titles);
      }
    });
  });
}

app.get("/ad/:uniqueId", (req, res) => {
  const uniqueId = req.params.uniqueId;
  const [table, id] = uniqueId.split("-");
  const sql = `SELECT * FROM ${table} WHERE Product_id = ?`;
  db.query(sql, [id], (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results[0]); // Assuming there's only one result
  });
});

const validateData = (req, res, next) => {
  const fields = {
    Condition: "string",
    Description: "string",
    Images_FolderName: "string",
    laptop_Screen_Size: "string",
    Phone: "bigint", // Conceptual reference for phone number
    PhoneBrand: "string",
    PhoneBrandCarrier: "string",
    Price: "number",
    Product_id: "number",
    Size: "string",
    Tablet_Brand: "string",
    Tags: "string",
    Title: "string",
    Type: "string",
  };

  const errors = [];

  for (const [key, type] of Object.entries(fields)) {
    if (req.body.hasOwnProperty(key)) {
      let value = req.body[key];

      // Convert string to number if the type is 'bigint' or 'number'
      if (type === "bigint" || type === "number") {
        value = Number(value);
        req.body[key] = value; // Update the req.body with the converted value
      }

      if (type === "string" && typeof value !== "string") {
        errors.push(`${key} should be a string`);
      }

      if (
        type === "bigint" &&
        (typeof value !== "number" || value.toString().length < 10)
      ) {
        errors.push(`${key} should be a number with at least 10 digits`);
      }

      // Check for numeric characters in brand and carrier fields
      if (
        type === "string" &&
        (key === "PhoneBrand" ||
          key === "PhoneBrandCarrier" ||
          key === "Tablet_Brand")
      ) {
        if (/\d/.test(value)) {
          errors.push(`${key} should not contain numbers`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

app.put("/ad/:uniqueId", validateData, (req, res) => {
  const uniqueId = req.params.uniqueId;
  const [table, id] = uniqueId.split("-");
  const updatedData = req.body; // Assuming the updated data is sent in the request body

  // Construct SQL query to update data in the specified table
  const setClause = Object.keys(updatedData)
    .map((field) => `\`${field}\` = ?`)
    .join(", ");

  const values = Object.values(updatedData);
  values.push(id);

  const sql = `UPDATE \`${table}\` SET ${setClause} WHERE \`Product_id\` = ?`;

  // Execute the query to update data
  db.query(sql, values, (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.status(200).send("Data updated successfully");
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
