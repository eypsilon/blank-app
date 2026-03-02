import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { importJWK, jwtVerify } from 'jose';
import { Environment } from './constants.js';
dotenv.config();
const app = express();
const PORT = 50143;

app.use(cors());

app.use(express.json());
console.log('CORS enabled');
console.log('Environment', process.env.API_ENVIRONMENT);

/**
 * This is a simple example of how to maintain the mapping between a tenant ID from THIS application and the JTL Platform tenant ID.
 * In a real application, you would probably want to use a database or some other persistent storage.
 * The key is the tenant ID from THIS application and the value is the JTL Platform tenant ID.
 */
const myMappingDatabase = new Map<string, string>();

app.get('/', async (_req, res) => {
  res.send('Hello from TypeScript + Express!');
});

app.post('/connect-tenant', async (req, res) => {
  const { sessionToken } = req.body;

  // Verify the session token & extract the payload
  const sessionTokenPayload = await verifySessionTokenAndExtractPayload(sessionToken);

  // the tenant ID can be read from header with authorization or from the JWT or whatever your backend will do
  // in this example we just use the current time as tenant ID
  const tenantId = new Date().getTime().toString();

  // Store the mapping in the database
  myMappingDatabase.set(tenantId, sessionTokenPayload.tenantId);

  res.send(`The tenant ID is ${tenantId} and the JTL Platform tenant ID is ${sessionTokenPayload.tenantId}`);

  res.end();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const wellKnownEndpoint = `https://api${Environment}.jtl-cloud.com/account/.well-known/jwks.json`;
async function verifySessionTokenAndExtractPayload(sessionToken: string): Promise<SessionTokenPayload> {
  // Fetch the JWKS
  const jwt = await getJwt();
  const response = await fetch(wellKnownEndpoint, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });
  const jwks = await response.json();
  const key = jwks.keys[0];
  // Convert the JWK to a CryptoKey
  const publicKey = await importJWK(key, 'EdDSA');

  try {
    const { payload } = await jwtVerify(sessionToken, publicKey);
    console.log('✅ Token is valid:', payload);
    return payload as SessionTokenPayload;
  } catch (err) {
    console.error('❌ Invalid token:', err);
  }
}

type SessionTokenPayload = {
  userId: string;
  tenantId: string;
};

/**
 * Get the authentication endpoint URL for the specified environment.
 * @param env 'prod' | '.dev' | '.beta' | '.qa'
 * @returns The authentication endpoint URL.
 */
const getAuthEndpoint = (env: string) => {
  if (env === 'prod' || env === '.beta') return `https://auth.jtl-cloud.com/oauth2/token`;
  return `https://auth${env}.jtl-cloud.com/oauth2/token`;
};

/**
 * This function can be removed once we have exposed the endpoint to public.
 */
export async function getJwt(): Promise<string> {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  console.log('clientId', clientId);
  console.log('clientSecret', clientSecret ? `${clientSecret.slice(0, 3)}***${clientSecret.slice(-3)}` : 'undefined');
  if (!clientId || !clientSecret) {
    throw new Error('CLIENT_ID and CLIENT_SECRET must be defined in .env file');
  }
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(getAuthEndpoint(Environment), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authString}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();

  if (response.ok) {
    return data.access_token;
  } else {
    throw new Error(`Failed to fetch JWT (${response.status}): ${data.error}`);
  }
}

app.all('/erp-info/:tenantId/:endpoint', async (req: Request, res: Response) => {
  try {
    // Get parameters from the URL and the body if available
    const urlTenantId = req.params.tenantId;
    const urlEndpoint = req.params.endpoint;
    const method = req.method;

    // For POST, PUT, PATCH, check for tenantId and endpoint in the request body
    let tenantId = urlTenantId;
    let endpoint = urlEndpoint;
    let bodyToSend = req.body;

    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
      // Extract _tenantId and _endpoint from body if present
      if (req.body._tenantId) {
        tenantId = req.body._tenantId;
      }

      if (req.body._endpoint) {
        endpoint = req.body._endpoint;
      }

      // Create a new copy of the body without _tenantId and _endpoint
      const { _tenantId, _endpoint, ...cleanedBody } = req.body;
      bodyToSend = cleanedBody;
    }

    // Get JWT for authentication
    const jwt = await getJwt();

    // Set up request options
    const options: RequestInit = {
      method: method,
      headers: {
        'X-Tenant-ID': tenantId,
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    };

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(bodyToSend);
    }

    // Call the JTL Platform API

    const erpInfoResponse = await fetch(`https://api${Environment}.jtl-cloud.com/erp/${endpoint}`, options);

    // Check if the response is OK and return the appropriate response
    if (erpInfoResponse.ok) {
      const data = await erpInfoResponse.json();
      res.json(data);
    } else {
      const errorText = await erpInfoResponse.text();
      res.status(erpInfoResponse.status).send(errorText);
    }
  } catch (error) {
    console.error('Error in /erp-info route:', error);
    res.status(500).json({
      error: 'Failed to fetch ERP info',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
