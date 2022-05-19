const allowedOrigins = require("./allowedOrigines");
const corsOptions = { origin: allowedOrigins, credentials: true };

module.exports = corsOptions;
