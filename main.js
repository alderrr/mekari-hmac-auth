const axios = require("axios");
const crypto = require("crypto");

const method = process.argv[2];
const pathWithQuery = process.argv[3];
const clientId = process.argv[4];
const clientSecret = process.argv[5];
const baseUrl = process.argv[6] || "https://api.mekari.com";

/**
 * Generate authentication headers based on method and path
 */
function generate_headers(method, pathWithQueryParam) {
  let datetime = new Date().toUTCString();
  let requestLine = `${method} ${pathWithQueryParam} HTTP/1.1`;
  let payload = [`date: ${datetime}`, requestLine].join("\n");
  let signature = crypto
    .createHmac("SHA256", clientSecret)
    .update(payload)
    .digest("base64");

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Date: datetime,
    Authorization: `hmac username="${clientId}", algorithm="hmac-sha256", headers="date request-line", signature="${signature}"`,
  };
}

const options = {
  method: method,
  url: `${baseUrl}${pathWithQuery}`,
  headers: {
    ...generate_headers(method, pathWithQuery),
    "X-Idempotency-Key": "1234",
  },
};

axios(options)
  .then(function (response) {
    console.log(response.data);
  })
  .catch(function (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
      // http.ClientRequest in node.js
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log("Error", error.message);
    }
  });
