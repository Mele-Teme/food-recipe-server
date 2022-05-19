const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const credential = require("./middleware/credential");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const imgbbUploader = require("imgbb-uploader");
const app = express();
const port = 5000;
app.use(credential);
app.use(
  cors({ origin: ["https://food-recipe-mt.netlify.app"], credentials: true })
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.json());
app.use(cookieParser());

const {
  CREATE_USER_OPERATION,
  GET_USER_EMAIL_OPERATION,
  SET_USER_REFRESH_TOKEN_OPERATION,
  GET_USER_REF_TOKEN_OPERATION,
  REMOVE_REF_TOKEN,
  execute,
  generateAccessToken,
  generateRefreshToken,
} = require("./actions");
const bcrypt = require("bcryptjs/dist/bcrypt");
const { resolve } = require("path");

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const { data, errors } = await execute(
    {
      email,
    },
    GET_USER_EMAIL_OPERATION
  );
  // hasura Errors
  if (errors) {
    return res.json({ success: false, error: errors });
  }

  if (data.users.length !== 0) {
    const accessToken = generateAccessToken({
      user: { username: data.users[0].name, email },
    });
    const hPass = data.users[0].password;

    if (bcrypt.compareSync(password, hPass)) {
      const refreshToken = generateRefreshToken({
        username: data.users[0].name,
        email,
      });
      res.cookie("jwt", refreshToken, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "none",
        secure: true,
      });

      const updateResponse = await execute(
        {
          id: data.users[0].id,
          refreshToken,
        },
        SET_USER_REFRESH_TOKEN_OPERATION
      );

      if (updateResponse.errors)
        return res.json({ success: false, error: errors });

      return res.json({ success: true, user: data.users[0], accessToken });
    } else
      return res.json({
        success: false,
        error: "Email doesn't match with password",
      });
  }
  res.json({ success: false, error: "Please Register First" });
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hPass = bcrypt.hashSync(password, 10);

  const refreshToken = generateRefreshToken({ username, email });

  const { data, errors } = await execute(
    {
      username,
      email,
      password: hPass,
      refreshToken,
    },
    CREATE_USER_OPERATION
  );

  // hasura Errors
  if (errors) {
    return res.json({ success: false, error: errors });
  }

  res.cookie("jwt", refreshToken, {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "none",
    secure: true,
  });
  const accessToken = generateAccessToken({
    user: data.insert_users_one,
  });
  res.json({ success: true, user: data.insert_users_one, accessToken });
});

app.get("/refresh", async (req, res) => {
  let accessToken = generateAccessToken({ user: null });
  const cookies = req.cookies;
  if (!cookies?.jwt)
    return res.json({
      success: false,
      error: "You Are Not Authorized",
      accessToken,
    });

  const refreshToken = cookies.jwt;

  // data
  const { data, errors } = await execute(
    { refreshToken },
    GET_USER_REF_TOKEN_OPERATION
  );

  if (errors)
    // // If Server Error
    return res.json({ success: false, error: errors, accessToken });

  // if (!foundUser) res.sendStatus(403); // Forbidden
  if (data.users.length == 0) {
    return res.json({ success: false, error: "Forbidden", accessToken });
  }

  //   evaluate jwt
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "none",
        secure: true,
      });
      return res.json({ success: false, error: "Cookie Expired", accessToken });
    }
    accessToken = generateAccessToken({ user: data.users[0] });

    res.json({ success: true, user: data.users[0], accessToken });
  });
});

app.get("/logout", async (req, res) => {
  let accessToken = generateAccessToken({ user: null });
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.json({ success: true, accessToken });
  const refreshToken = cookies.jwt;
  res.clearCookie("jwt", { httpOnly: true, sameSite: "none", secure: true });

  const { data, errors } = await execute(
    { refreshToken },
    GET_USER_REF_TOKEN_OPERATION
  );

  if (errors)
    return res.json({ Success: false, error: "Forbidden", accessToken });

  if (data.users.length == 0) {
    res.clearCookie("jwt", { httpOnly: true, sameSite: "none", secure: true });
    return res.json({ success: true, accessToken });
  }

  const { data: dataR, errors: errorsR } = await execute(
    { id: data.users[0].id },
    REMOVE_REF_TOKEN
  );

  if (errorsR) return res.json({ success: false, accessToken });
  res.json({ success: true, accessToken });
});

app.post("/imgUrl", async (req, res) => {
  try {
    const { fname, fstr64 } = req.body;

    const base64str = () =>
      new Promise((resolve) => {
        return setTimeout(() => {
          resolve(fstr64);
        }, 1000);
      });

    return await imgbbUploader({
      apiKey: process.env.UPLOADER_KEY,
      base64string: await base64str(),
      name: fname,
      timeout: 3000,
    })
      .then((result) => {
        return res.json({ success: true, imgUrl: result.url });
      })
      .catch((e) => {
        return res.json({
          success: false,
          imgUrl:
            "https://static.sciencelearn.org.nz/images/images/000/000/560/original/Good_Food_Display_-_NCI_Visuals_Online.jpg?1522295345",
        });
      });
  } catch (error) {
    return res.json({
      success: false,
      imgUrl:
        "https://static.sciencelearn.org.nz/images/images/000/000/560/original/Good_Food_Display_-_NCI_Visuals_Online.jpg?1522295345",
    });
  }
});

app.listen(process.env.PORT || port, () =>
  console.log(`Server is listening on port:` + port)
);
