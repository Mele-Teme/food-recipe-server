
const allowedOrigins = ["https://food-recipe-mt.netlify.app/"];
const credential = (req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Credentials", true);
  }
  next();
};

module.exports = credential;
