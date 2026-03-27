import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const POWERSHELL_TIMEOUT_SECONDS = 30;
const MAX_BUFFER_BYTES = 20 * 1024 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

const encodePowerShellScript = (script: string) =>
  Buffer.from(script, "utf16le").toString("base64");

const escapeSingleQuotes = (value: string) => value.replace(/'/g, "''");

const normalizeBody = (body: BodyInit | null | undefined) => {
  if (typeof body === "string") {
    return body;
  }

  if (body === null || body === undefined) {
    return "";
  }

  return String(body);
};

const toHeaderMap = (headers: HeadersInit | undefined) =>
  Object.fromEntries(new Headers(headers ?? {}).entries());

async function invokePowerShellRequest(
  url: string,
  method: string,
  headers: HeadersInit | undefined,
  body: BodyInit | null | undefined,
) {
  const payload = JSON.stringify({
    url,
    method,
    headers: toHeaderMap(headers),
    body: normalizeBody(body),
  });
  const payloadBase64 = Buffer.from(payload, "utf8").toString("base64");
  const script = `
$raw = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${escapeSingleQuotes(payloadBase64)}'))
$data = $raw | ConvertFrom-Json
$headers = @{}
if ($data.headers) {
  $data.headers.PSObject.Properties | ForEach-Object {
    $headers[$_.Name] = [string]$_.Value
  }
}
try {
  $response = Invoke-WebRequest -UseBasicParsing -Uri $data.url -Method $data.method -Headers $headers -Body $data.body -TimeoutSec ${POWERSHELL_TIMEOUT_SECONDS}
  $result = @{
    status = [int]$response.StatusCode
    body = [string]$response.Content
  } | ConvertTo-Json -Compress
  Write-Output $result
} catch {
  if ($_.Exception.Response) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $content = $reader.ReadToEnd()
    $result = @{
      status = [int]$_.Exception.Response.StatusCode
      body = [string]$content
    } | ConvertTo-Json -Compress
    Write-Output $result
    exit 0
  }

  throw
}
`;

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-EncodedCommand", encodePowerShellScript(script)],
    {
      maxBuffer: MAX_BUFFER_BYTES,
      windowsHide: true,
    },
  );

  const parsed = JSON.parse(stdout.trim()) as {
    status: number;
    body: string;
  };

  return new Response(parsed.body, {
    status: parsed.status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function solanaRpcFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (process.platform !== "win32") {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error("Solana RPC request timed out.")),
      DEFAULT_FETCH_TIMEOUT_MS,
    );

    const upstreamSignal = init?.signal;

    if (upstreamSignal) {
      if (upstreamSignal.aborted) {
        controller.abort(upstreamSignal.reason);
      } else {
        upstreamSignal.addEventListener(
          "abort",
          () => controller.abort(upstreamSignal.reason),
          { once: true },
        );
      }
    }

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return invokePowerShellRequest(
    url,
    init?.method ?? "GET",
    init?.headers,
    init?.body,
  );
}
