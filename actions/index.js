const axios = require("axios").default;
const jwt = require("jsonwebtoken");
const endpoint = "https://online-food-recipe-app.herokuapp.com/v1/graphql";
const header = {
  "content-type": "application/json",
  "x-hasura-admin-secret": process.env.ADMIN_SECRET,
};

const CREATE_USER_OPERATION = `
mutation($username:String!, $email:String!, $password:String!, $refreshToken:String!){
  insert_users_one(object:{name:$username, email:$email, password:$password, refreshToken:$refreshToken}){
    id
    name
    email
  }
}
`;
const GET_USER_EMAIL_OPERATION = `
query($email:String!){
  users(where:{email:{_eq:$email}}){
    id
    name
    email
    password
  }
}
`;
const GET_USER_REF_TOKEN_OPERATION = `
query($refreshToken:String!){
  users(where:{refreshToken:{_eq:$refreshToken}}){
    id
    name
    email
  }
}
`;

const SET_USER_REFRESH_TOKEN_OPERATION = `
mutation($id:uuid!, $refreshToken:String!){
  update_users_by_pk(pk_columns:{id:$id}, _set:{refreshToken:$refreshToken}){
    id
    name
    email
  }
}
`;
const REMOVE_REF_TOKEN = `
mutation($id:uuid!){
  update_users_by_pk(pk_columns:{id:$id}, _set:{refreshToken:null}){
    id
    name
    email
  }
}
`;

const execute = async (variables, operation) => {
  const graphQLQuery = {
    query: operation,
    variables: variables,
  };
  let bool = true;
  while (bool) {
    const fetchResponse = await axios({
      url: endpoint,
      headers: header,
      method: "post",
      data: graphQLQuery,
    }).catch((err) => {});
    if (fetchResponse) {
      bool = false;
      return fetchResponse.data;
    }
  }
};

const generateAccessToken = (data) => {
  if (data.user) {
    const accessToken = jwt.sign(
      {
        name: data.user.name,
        "https://hasura.io/jwt/claims": {
          "x-hasura-allowed-roles": [
            "editor",
            "user",
            "mod",
            "appuser",
            "admin",
          ],
          "x-hasura-default-role": "admin",
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      }
    );
    return accessToken;
  } else {
    const accessToken = jwt.sign(
      {
        "https://hasura.io/jwt/claims": {
          "x-hasura-allowed-roles": ["editor", "user", "mod", "annony"],
          "x-hasura-default-role": "annony",
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "15m",
      }
    );
    return accessToken;
  }
};
const generateRefreshToken = (data) => {
  const refreshToken = jwt.sign(data, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  return refreshToken;
};

module.exports = {
  CREATE_USER_OPERATION,
  GET_USER_EMAIL_OPERATION,
  GET_USER_REF_TOKEN_OPERATION,
  SET_USER_REFRESH_TOKEN_OPERATION,
  REMOVE_REF_TOKEN,
  execute,
  generateAccessToken,
  generateRefreshToken,
};
