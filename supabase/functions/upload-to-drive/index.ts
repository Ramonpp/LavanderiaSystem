import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

// Auxiliar para gerar o token JWT do Google Service Account usando Web Crypto
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa: ServiceAccountKey = JSON.parse(serviceAccountJson);
  
  // Limpar a chave privada PEM para o formato adequado do importKey (PKCS8)
  const pemHeader = "-----BEGIN PRIVATE KEY-----\n";
  const pemFooter = "\n-----END PRIVATE KEY-----";
  
  let pemContents = sa.private_key;
  // Extrair o conteúdo interno da chave PEM se ela tiver cabeçalhos
  if (pemContents.includes(pemHeader)) {
    const startIdx = pemContents.indexOf(pemHeader) + pemHeader.length;
    const endIdx = pemContents.indexOf(pemFooter);
    pemContents = pemContents.substring(startIdx, endIdx);
  }
  // Remover quebras de linha e espaços em branco
  pemContents = pemContents.replace(/\s/g, "");

  // Converter base64 para ArrayBuffer
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  // Importar a chave privada no formato PKCS8
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Montar o cabeçalho e claims do JWT
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: sa.token_uri,
    exp: now + 3600, // Expira em 1 hora
    iat: now,
  };

  const base64UrlEncode = (str: string) => {
    return btoa(str)
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const stringToSign = `${encodedHeader}.${encodedClaimSet}`;

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(stringToSign)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${stringToSign}.${encodedSignature}`;

  // Obter o Token de Acesso do Google
  const response = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao obter token do Google: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Procura ou cria uma pasta no Google Drive e retorna o ID dela
async function getOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName.replace(
    /'/g,
    "\\'"
  )}' and '${parentFolderId}' in parents and trashed = false`;

  // 1. Procurar se a pasta já existe
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id)`;
  
  const searchResponse = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchResponse.ok) {
    const errText = await searchResponse.text();
    throw new Error(`Erro ao buscar pasta '${folderName}': ${errText}`);
  }

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 2. Se não existir, criar a pasta
  const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    }),
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`Erro ao criar pasta '${folderName}': ${errText}`);
  }

  const createData = await createResponse.json();
  return createData.id;
}

serve(async (req) => {
  // Tratar requisição de preflight do CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const googleCreds = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    const parentFolderId = Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID");

    if (!googleCreds || !parentFolderId) {
      return new Response(
        JSON.stringify({ error: "Configurações GOOGLE_SERVICE_ACCOUNT ou GOOGLE_DRIVE_PARENT_FOLDER_ID ausentes no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar FormData com os campos e o arquivo
    const formData = await req.formData();
    const clientName = formData.get("clientName") as string;
    const dateStr = formData.get("date") as string; // Ex: 2026-06-20
    const file = formData.get("file") as File;

    if (!clientName || !dateStr || !file) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios ausentes: clientName, date ou file." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter o Token de Acesso do Google
    const accessToken = await getGoogleAccessToken(googleCreds);

    // 1. Obter ou criar a pasta correspondente à data (ex: YYYY-MM-DD)
    const dateFolderId = await getOrCreateFolder(accessToken, dateStr, parentFolderId);

    // 2. Obter ou criar a pasta correspondente ao cliente dentro da pasta da data
    const clientFolderId = await getOrCreateFolder(accessToken, clientName, dateFolderId);

    // 3. Fazer o Upload do arquivo na pasta do cliente
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileArrayBuffer);
    
    // Upload Multipart (metadados + binário do arquivo na mesma requisição)
    const boundary = "------MultipartBoundary" + Math.random().toString(36).substring(2);
    
    const metadata = {
      name: file.name,
      parents: [clientFolderId],
    };

    const textEncoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Adicionar parte dos metadados
    parts.push(textEncoder.encode(`--${boundary}\r\n`));
    parts.push(textEncoder.encode(`Content-Type: application/json; charset=UTF-8\r\n\r\n`));
    parts.push(textEncoder.encode(JSON.stringify(metadata) + `\r\n`));
    
    // Adicionar parte do arquivo
    parts.push(textEncoder.encode(`--${boundary}\r\n`));
    parts.push(textEncoder.encode(`Content-Type: ${file.type || "image/jpeg"}\r\n\r\n`));
    parts.push(fileBytes);
    parts.push(textEncoder.encode(`\r\n--${boundary}--\r\n`));

    // Somar o tamanho total de bytes
    let totalLength = 0;
    for (const part of parts) {
      totalLength += part.length;
    }

    const requestBody = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      requestBody.set(part, offset);
      offset += part.length;
    }

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(totalLength),
      },
      body: requestBody,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Erro de upload na API do Google Drive: ${errorText}`);
    }

    const uploadData = await uploadResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileId: uploadData.id,
        message: "Foto enviada com sucesso para o Google Drive."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido ao processar upload." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
