const fs = require("fs");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");

/*
  CLI argument order:

  process.argv[2]  = method
  process.argv[3]  = pathWithQuery
  process.argv[4]  = clientId
  process.argv[5]  = clientSecret
  process.argv[6]  = baseUrl
  process.argv[7]  = bodyPath
  process.argv[8]  = outputDir
  process.argv[9] = delaySeconds
*/

function cleanArg(value) {
  if (value === undefined || value === null) return value;

  return String(value).trim().replace(/^"+/, "").replace(/"+$/, "");
}

function cleanOutputDir(value) {
  let cleaned = cleanArg(value);

  if (!cleaned) return cleaned;

  /*
    Avoid trailing slash/backslash issue from OpenEdge/cmd.
    Correct: C:\folder\downloads
    Wrong  : C:\folder\downloads\
  */
  while (cleaned.length > 3 && /[\\\/]$/.test(cleaned)) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

const method = cleanArg(process.argv[2]);
const pathWithQuery = cleanArg(process.argv[3]);
const clientId = cleanArg(process.argv[4]);
const clientSecret = cleanArg(process.argv[5]);
const baseUrl = cleanArg(process.argv[6]) || "https://api.mekari.com";
const bodyPath = cleanArg(process.argv[7]);
const outputDir = cleanOutputDir(process.argv[8]) || process.cwd();
const delaySeconds = Number(cleanArg(process.argv[9]) || 60);

function validateRequiredArgs() {
  const missing = [];

  if (!method) missing.push("method");
  if (!pathWithQuery) missing.push("pathWithQuery");
  if (!clientId) missing.push("clientId");
  if (!clientSecret) missing.push("clientSecret");
  if (!baseUrl) missing.push("baseUrl");

  if (missing.length > 0) {
    throw new Error(`Missing required argument(s): ${missing.join(", ")}`);
  }

  if (isNaN(delaySeconds) || delaySeconds <= 0) {
    throw new Error("delaySeconds must be a number greater than 0");
  }
}

/*
  Generate Mekari HMAC authentication headers.
*/
function generate_headers(method, pathWithQueryParam) {
  const datetime = new Date().toUTCString();
  const requestLine = `${method} ${pathWithQueryParam} HTTP/1.1`;
  const payload = [`date: ${datetime}`, requestLine].join("\n");

  const signature = crypto
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

function readBodyFromFile(bodyPath) {
  if (!bodyPath) return undefined;

  if (!fs.existsSync(bodyPath)) {
    throw new Error(`Body file not found: ${bodyPath}`);
  }

  const rawBody = fs.readFileSync(bodyPath, "utf-8").trim();

  if (!rawBody) return undefined;

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error(`Invalid JSON body file: ${error.message}`);
  }
}

function saveStreamToFile(response, outputPath) {
  const writer = fs.createWriteStream(outputPath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(outputPath));
    writer.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStatus(status) {
  if (!status) return "";
  return String(status).toLowerCase().trim();
}

function getStampingStatus(responseData) {
  return responseData?.data?.attributes?.stamping_status;
}

function getGeneralStatus(responseData) {
  return responseData?.data?.attributes?.status;
}

function getSigningStatus(responseData) {
  return responseData?.data?.attributes?.signing_status;
}

function isCompletedStatus(status) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "done" ||
    normalized === "finished" ||
    normalized === "stamped"
  );
}

function isWaitingStatus(status) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "" ||
    normalized === "none" ||
    normalized === "in_progress" ||
    normalized === "in progress" ||
    normalized === "processing" ||
    normalized === "pending" ||
    normalized === "queued" ||
    normalized === "created" ||
    normalized === "waiting"
  );
}

function isFailedStatus(status) {
  const normalized = normalizeStatus(status);

  return (
    normalized === "failed" ||
    normalized === "fail" ||
    normalized === "error" ||
    normalized === "rejected" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  );
}

async function getDocumentDetail(documentId) {
  const detailMethod = "GET";
  const detailPath = `/v2/esign/v1/documents/${documentId}`;

  const detailResponse = await axios({
    method: detailMethod,
    url: `${baseUrl}${detailPath}`,
    headers: generate_headers(detailMethod, detailPath),
  });

  return detailResponse.data;
}

async function waitUntilStampingCompleted(documentId, firstResponseData) {
  let latestData = firstResponseData;
  let attempt = 1;

  while (true) {
    const stampingStatus = getStampingStatus(latestData);
    const signingStatus = getSigningStatus(latestData);
    const generalStatus = getGeneralStatus(latestData);

    /*
      Important:
      For eMeterai, we only trust stamping_status.

      Expected:
        none    = not ready yet / keep checking
        success = ready / download allowed
        failed  = stop with error
    */
    const effectiveStatus = stampingStatus;

    if (isCompletedStatus(effectiveStatus)) {
      return {
        completed: true,
        attempts_used: attempt,
        waited: attempt > 1,
        final_status: effectiveStatus || null,
        final_stamping_status: stampingStatus || null,
        final_signing_status: signingStatus || null,
        final_general_status: generalStatus || null,
        final_response: latestData,
      };
    }

    if (isFailedStatus(effectiveStatus)) {
      throw new Error(
        `Document stamping failed. stamping_status=${stampingStatus}, signing_status=${signingStatus}, status=${generalStatus}`,
      );
    }

    /*
      If stamping_status is: none / empty / pending / in_progress
      then keep waiting forever until success or failed.
    */
    await sleep(delaySeconds * 1000);
    attempt = attempt + 1;
    latestData = await getDocumentDetail(documentId);
  }
}

function isPlainJsonData(value) {
  if (value === null) return true;

  if (typeof value === "string") return true;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;

  if (Array.isArray(value)) return true;

  if (typeof value === "object") {
    /*
      Avoid circular JSON errors from stream/socket objects.
    */
    if (value.pipe && typeof value.pipe === "function") return false;
    if (value.readable !== undefined) return false;
    if (value._httpMessage) return false;
    if (value.socket) return false;

    return value.constructor === Object;
  }

  return false;
}

function buildSafeErrorResponse(error) {
  if (error.response) {
    return {
      success: false,
      status: error.response.status,
      statusText: error.response.statusText,
      data: isPlainJsonData(error.response.data)
        ? error.response.data
        : "[Non-JSON response data omitted]",
      headers: error.response.headers,
      message: error.message,
    };
  }

  return {
    success: false,
    message: error.message,
  };
}

async function main() {
  validateRequiredArgs();

  const body = readBodyFromFile(bodyPath);

  /*
    Step 1:
    POST stamping request.
  */
  const firstOptions = {
    method: method,
    url: `${baseUrl}${pathWithQuery}`,
    headers: {
      ...generate_headers(method, pathWithQuery),
      "X-Idempotency-Key": crypto.randomUUID(),
    },
  };

  if (body !== undefined) {
    firstOptions.data = body;
  }

  const firstResponse = await axios(firstOptions);

  const documentId = firstResponse.data?.data?.id;

  const filename =
    firstResponse.data?.data?.attributes?.filename || `${documentId}.pdf`;

  if (!documentId) {
    throw new Error("Document ID not found in POST response");
  }

  /*
    Step 2:
    Poll document detail:
      GET /v2/esign/v1/documents/{id}

    It will retry based on:
      maxAttempts
      delaySeconds
  */
  const pollingResult = await waitUntilStampingCompleted(
    documentId,
    firstResponse.data,
  );

  /*
    Step 3:
    Download only after stamping_status is completed/success.
  */
  const downloadMethod = "GET";
  const downloadPath = `/v2/esign/v1/documents/${documentId}/download`;

  const downloadResponse = await axios({
    method: downloadMethod,
    url: `${baseUrl}${downloadPath}`,
    headers: generate_headers(downloadMethod, downloadPath),
    responseType: "stream",
  });

  /*
    Step 4:
    Save PDF file.
  */
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, filename);

  await saveStreamToFile(downloadResponse, outputPath);

  /*
    Step 5:
    Print final JSON to response.txt through OpenEdge redirection.
  */
  console.log(
    JSON.stringify(
      {
        success: true,
        document_id: documentId,
        filename: filename,
        file_path: outputPath,

        post_response: firstResponse.data,

        polling_result: {
          attempts_used: pollingResult.attempts_used,
          waited: pollingResult.waited,
          delay_seconds: delaySeconds,
          final_status: pollingResult.final_status,
          final_stamping_status: pollingResult.final_stamping_status,
          final_signing_status: pollingResult.final_signing_status,
        },

        final_document_response: pollingResult.final_response,

        download_response: {
          status: downloadResponse.status,
          statusText: downloadResponse.statusText,
          content_type: downloadResponse.headers["content-type"] || null,
          content_length: downloadResponse.headers["content-length"] || null,
          download_path: downloadPath,
        },
      },
      null,
      2,
    ),
  );
}

main().catch(function (error) {
  console.log(JSON.stringify(buildSafeErrorResponse(error), null, 2));
});
