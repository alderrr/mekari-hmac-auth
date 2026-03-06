/*DEFINE INPUT PARAMETER exe-path         AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER http-method      AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER pathquery        AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER client-id        AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER client-secret    AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER base-url         AS CHARACTER NO-UNDO.
DEFINE INPUT PARAMETER cmd              AS CHARACTER NO-UNDO.
DEFINE OUTPUT PARAMETER response        AS LONGCHAR  NO-UNDO.*/

DEFINE VARIABLE dir-path        AS CHARACTER NO-UNDO.
DEFINE VARIABLE exe-path        AS CHARACTER NO-UNDO.
DEFINE VARIABLE res-path        AS CHARACTER NO-UNDO.
DEFINE VARIABLE http-method     AS CHARACTER NO-UNDO.
DEFINE VARIABLE pathquery       AS CHARACTER NO-UNDO.
DEFINE VARIABLE client-id       AS CHARACTER NO-UNDO.
DEFINE VARIABLE client-secret   AS CHARACTER NO-UNDO.
DEFINE VARIABLE base-url        AS CHARACTER NO-UNDO.
DEFINE VARIABLE cmd             AS CHARACTER NO-UNDO.
DEFINE VARIABLE response        AS LONGCHAR  NO-UNDO.

dir-path        = "C:\ALDER\CODE\PROJECTS\Mekari\mekari-hmac-auth\".
exe-path        = dir-path + "mekari-hmac-auth.exe".
res-path        = dir-path + "response.txt".

http-method     = "POST".
pathquery       = "/v2/klikpajak/v1/efaktur/out?auto_approval=false".
client-id       = "YOUR_CLIENT_ID".
client-secret   = "YOUR_CLIENT_SECRET".
base-url        = "https://api.mekari.com".

OUTPUT TO VALUE(res-path).
PUT UNFORMATTED "".
OUTPUT CLOSE.

cmd = 'cmd /c ""'
    + exe-path + '" '
    + '"' + http-method + '" '
    + '"' + pathquery + '" '
    + '"' + client-id + '" '
    + '"' + client-secret + '" '
    + '"' + base-url + '" '
    + '> "' + res-path + '" 2>&1"'.

OS-COMMAND SILENT VALUE(cmd).

INPUT FROM VALUE(res-path) NO-ECHO.
response = "".
REPEAT:
    DEFINE VARIABLE line AS CHARACTER NO-UNDO.
    IMPORT UNFORMATTED line NO-ERROR.
    IF ERROR-STATUS:ERROR THEN LEAVE.
    response = response + line + CHR(10).
END.
INPUT CLOSE.

MESSAGE STRING(response)
    VIEW-AS ALERT-BOX INFO BUTTONS OK.
