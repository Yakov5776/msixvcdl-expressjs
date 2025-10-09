require('dotenv').config({ quiet: true });
const express = require("express");
const cors = require('cors');
const fs = require("fs").promises;
const path = require("path");
const msixvcRoutes = require("./routes/msixvc");
const authMiddleware = require("./middleware/authMiddleware");
const CONFIG = require("./config");

const app = express();
const PORT = process.env.PORT || 3001;

async function getLastCommitId() {
  try {
    const headPath = path.join(process.cwd(), '.git', 'HEAD');
    const headContent = await fs.readFile(headPath, 'utf8');

    // If HEAD is in a detached state, it directly contains the commit hash
    if (!headContent.startsWith('ref: ')) {
      return headContent.trim();
    }

    // If HEAD points to a branch, extract the branch name
    const branchRef = headContent.trim().substring(5); // Remove "ref: "
    const branchPath = path.join(process.cwd(), '.git', branchRef);
    const commitId = await fs.readFile(branchPath, 'utf8');
    return commitId.trim();

  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Error getting last commit ID:', error);
    return null;
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS behavior: use whitelist if defined, if not defined, then only allow all if public mode, or disable otherwise
if (CONFIG.corsWhitelist) {
  const corsOptions = {
    origin: function (origin, callback) {
      const allowed = !origin || CONFIG.corsWhitelist.indexOf(origin) !== -1;
      return callback(null, allowed);
    },
    optionsSuccessStatus: 204
  };
  app.use(cors(corsOptions));
} else if (CONFIG.publicMode) app.use(cors());

// Apply authentication middleware
app.use(authMiddleware.createAuthMiddleware());

app.use("/msixvc", msixvcRoutes);

app.get("/", async (req, res) => {
  const commitId = await getLastCommitId();
  res.json({
    message: "MSIXVC Download Service",
    commitId : commitId || 'unknown',
    publicMode: CONFIG.publicMode,
    endpoints: {
      login: "/msixvc/login",
      callback: "/msixvc/callback",
      download: "/msixvc/:identifier (supports both contentId and productId)"
    }
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Login at: http://localhost:${PORT}/msixvc/login`);
  });
}

module.exports = app;
