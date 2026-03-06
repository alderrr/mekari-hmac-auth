# Mekari HMAC Authentication CLI

This project provides a command-line tool for generating Mekari HMAC
authentication headers and performing API requests to Mekari services.

The tool is written in Node.js and compiled into a standalone Windows
executable using `pkg`. It is designed to be called from systems that
cannot easily generate HMAC signatures, such as Progress OpenEdge 10.2.

## Purpose

Progress OpenEdge 10.2 does not provide built-in support for HMAC SHA256
or modern REST integrations. This tool acts as a bridge between OpenEdge
and Mekari APIs by:

1.  Accepting API parameters via command line arguments
2.  Generating the required HMAC authentication signature
3.  Sending the HTTP request to the Mekari API
4.  Returning the response

This allows legacy systems to interact with Mekari APIs without
implementing cryptographic logic inside OpenEdge.

## Architecture

The integration flow works as follows:

Progress OpenEdge\
→ OS-COMMAND\
→ mekari-hmac-auth.exe\
→ Mekari API

The executable performs the HMAC signing and HTTP request.

## Requirements

- Node.js 16
- npm
- pkg (for building the executable)

Install pkg globally:

    npm install -g pkg

## Installation

Clone the repository:

    git clone https://github.com/your-repository/mekari-hmac-auth.git
    cd mekari-hmac-auth

Install dependencies:

    npm install

## Build the Executable

To compile the CLI into a Windows executable:

    pkg main.js --targets node16-win-x64 --output mekari-hmac-auth

This will generate:

    mekari-hmac-auth.exe

## Command Line Usage

The executable accepts the following parameters:

    mekari-hmac-auth.exe METHOD PATH_WITH_QUERY CLIENT_ID CLIENT_SECRET BASE_URL

Example:

    mekari-hmac-auth.exe POST "/v2/klikpajak/v1/efaktur/out?auto_approval=false" CLIENT_ID CLIENT_SECRET https://api.mekari.com

Example response:

    { message: 'Unauthorized' }
    401
    {
      date: 'Wed, 04 Mar 2026 09:49:34 GMT',
      content-type: 'application/json; charset=utf-8'
    }

## Redirecting Output to File

To save the response to a file:

    mekari-hmac-auth.exe POST "/v2/klikpajak/v1/efaktur/out?auto_approval=false" CLIENT_ID CLIENT_SECRET https://api.mekari.com > response.txt 2>&1

The response will be written to:

    response.txt

## Example Integration with Progress OpenEdge

Below is an example `.p` program that runs the executable and reads the
response.

```progress
DEFINE VARIABLE exe-path      AS CHARACTER NO-UNDO.
DEFINE VARIABLE res-path      AS CHARACTER NO-UNDO.
DEFINE VARIABLE cmd           AS CHARACTER NO-UNDO.
DEFINE VARIABLE response      AS LONGCHAR  NO-UNDO.
DEFINE VARIABLE line          AS CHARACTER NO-UNDO.

exe-path = "C:\integration\mekari-hmac-auth.exe".
res-path = "C:\integration\response.txt".

cmd = 'cmd /c ""'
    + exe-path + '" '
    + '"POST" '
    + '"/v2/klikpajak/v1/efaktur/out?auto_approval=false" '
    + '"CLIENT_ID" '
    + '"CLIENT_SECRET" '
    + '"https://api.mekari.com" '
    + '> "' + res-path + '" 2>&1"'.

OS-COMMAND SILENT VALUE(cmd).

INPUT FROM VALUE(res-path).
response = "".

REPEAT:
    IMPORT UNFORMATTED line NO-ERROR.
    IF ERROR-STATUS:ERROR THEN LEAVE.
    response = response + line + CHR(10).
END.

INPUT CLOSE.

MESSAGE response VIEW-AS ALERT-BOX.
```

## Notes

- `cmd /c` is required so Windows command redirection (`>`) works when
  executed from OpenEdge.
- `2>&1` ensures both stdout and stderr are captured.
- The executable should output only API responses to simplify parsing.

## Security Considerations

Avoid hardcoding API credentials inside the OpenEdge program or the
executable. Consider using:

- environment variables
- encrypted configuration files
- secure credential storage

## License

MIT License.
