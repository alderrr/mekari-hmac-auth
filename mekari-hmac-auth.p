/*DEFINE INPUT PARAMETER exe-path         AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER http-method      AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER pathquery        AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER client-id        AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER client-secret    AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER base-url         AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER cmd              AS CHARACTER NO-UNDO.
DEFINE OUTPUT PARAMETER response        AS LONGCHAR  NO-UNDO.*/

DEFINE VARIABLE dir-path        AS CHARACTER NO-UNDO.
DEFINE VARIABLE body-path       AS CHARACTER NO-UNDO.
DEFINE VARIABLE exe-path        AS CHARACTER NO-UNDO.
DEFINE VARIABLE res-path        AS CHARACTER NO-UNDO.
DEFINE VARIABLE output-dir      AS CHARACTER NO-UNDO.

DEFINE VARIABLE http-method     AS CHARACTER NO-UNDO.
DEFINE VARIABLE pathquery       AS CHARACTER NO-UNDO.
DEFINE VARIABLE client-id       AS CHARACTER NO-UNDO.
DEFINE VARIABLE client-secret   AS CHARACTER NO-UNDO.
DEFINE VARIABLE base-url        AS CHARACTER NO-UNDO.

DEFINE VARIABLE delay-seconds   AS CHARACTER NO-UNDO.

DEFINE VARIABLE cmd             AS CHARACTER NO-UNDO.
DEFINE VARIABLE response        AS LONGCHAR  NO-UNDO.
DEFINE VARIABLE lines           AS CHARACTER NO-UNDO.

dir-path        = "C:\ALDER\CODE\PROJECTS\Mekari\mekari-hmac-auth\".
exe-path        = dir-path + "mekari-hmac-auth.exe".
body-path       = dir-path + "body.txt".
res-path        = dir-path + "response.txt".
output-dir      = dir-path + "downloads".

http-method     = "POST".
pathquery       = "/v2/esign/v1/documents/stamp".       /*Example*/
client-id       = ""                                    /*"YOUR_CLIENT_ID"*/.
client-secret   = ""                                    /*"YOUR_CLIENT_SECRET"*/.
base-url        = "https://sandbox-api.mekari.com".     /*https://api.mekari.com | https://sandbox-api.mekari.com*/

delay-seconds   = "60".

/*Prepare response file*/
OUTPUT TO VALUE(res-path).
PUT UNFORMATTED "".
OUTPUT CLOSE.

/*Build command*/
cmd = 'cmd /c ""'
    + exe-path + '" '
    + '"' + http-method + '" '
    + '"' + pathquery + '" '
    + '"' + client-id + '" '
    + '"' + client-secret + '" '
    + '"' + base-url + '" '
    + '"' + body-path + '" '
    + '"' + output-dir + '" '
    + '"' + delay-seconds + '" '
    + '> "' + res-path + '" 2>&1"'.

OS-COMMAND SILENT VALUE(cmd).

INPUT FROM VALUE(res-path) NO-ECHO.
response = "".
REPEAT:
    IMPORT UNFORMATTED lines NO-ERROR.
    IF ERROR-STATUS:ERROR THEN LEAVE.
    response = response + lines + CHR(10).
END.
INPUT CLOSE.

/*Comment for Production*/
MESSAGE STRING(response)
    VIEW-AS ALERT-BOX INFO BUTTONS OK.
